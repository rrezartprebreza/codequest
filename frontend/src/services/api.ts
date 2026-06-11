import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import type { LearningState } from './learningEngine';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:9090/api/v1';
const API_TIMEOUT_MS = 60000;
const AUTH_TIMEOUT_MS = 240000;
const BACKEND_WARMUP_TIMEOUT_MS = 240000;
const LOGOUT_TIMEOUT_MS = 5000;
const API_ORIGIN = API_BASE.replace(/\/api\/v1\/?$/, '');
const ACCESS_TOKEN_KEY  = 'codequest_access_token';
const REFRESH_TOKEN_KEY = 'codequest_refresh_token';
// Old single-token key (pre-V12). Cleared on first load so legacy users re-auth cleanly.
const LEGACY_TOKEN_KEY  = 'codequest_auth_token';
if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_TOKEN_KEY);

const api = axios.create({
  baseURL: API_BASE,
  timeout: API_TIMEOUT_MS,
});

// Separate instance for AI-backed calls that can take 60–120 s (Ollama)
const aiApi = axios.create({
  baseURL: API_BASE,
  timeout: 180000, // 3 minutes
});

// ── Token storage + interceptors ────────────────────────────────────────────

export const getAuthToken = (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY);
const getRefreshToken = (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY);

export const setTokens = (tokens: { accessToken: string; refreshToken: string } | null): void => {
  if (tokens) {
    localStorage.setItem(ACCESS_TOKEN_KEY,  tokens.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

/** Back-compat shim — some call sites still call setAuthToken(null) to clear. */
export const setAuthToken = (token: string | null): void => {
  if (token === null) setTokens(null);
  else localStorage.setItem(ACCESS_TOKEN_KEY, token);
};

// Listeners called when authentication is unrecoverably gone (refresh failed too).
// App.tsx subscribes and resets state so the user goes back to onboarding.
type AuthExpiredListener = () => void;
const authExpiredListeners = new Set<AuthExpiredListener>();
export const onAuthExpired = (listener: AuthExpiredListener): (() => void) => {
  authExpiredListeners.add(listener);
  return () => authExpiredListeners.delete(listener);
};
const notifyAuthExpired = () => {
  setTokens(null);
  authExpiredListeners.forEach(listener => {
    try { listener(); } catch { /* ignore */ }
  });
};

const attachToken = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
};
api.interceptors.request.use(attachToken);
aiApi.interceptors.request.use(attachToken);

// ── Single-flight refresh-on-401 ────────────────────────────────────────────
// When any request returns 401, we try to rotate the refresh token ONCE. While
// rotation is in flight, every other 401 awaits the same promise (no thundering
// herd of refresh calls). On success we re-issue the original request with the
// new access token. On failure we surface the auth-expired event.

let refreshInFlight: Promise<string> | null = null;
// Use a bare axios instance to avoid recursing into our own interceptor.
const authApi = axios.create({ baseURL: API_BASE, timeout: AUTH_TIMEOUT_MS });
const refreshAxios = axios.create({ baseURL: API_BASE, timeout: API_TIMEOUT_MS });

const warmBackend = async (): Promise<void> => {
  if (typeof fetch === 'undefined') return;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), BACKEND_WARMUP_TIMEOUT_MS);

  try {
    await fetch(`${API_ORIGIN}/`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch {
    // Continue to the real auth request so the app can surface the actual API error.
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const doRefresh = async (): Promise<string> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token available.');
  const res = await refreshAxios.post('/auth/refresh', { refreshToken });
  const data = (res.data?.data ?? res.data) as {
    accessToken: string;
    refreshToken: string;
    accessExpiresAtEpochMs: number;
  };
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
};

type RetriableConfig = AxiosRequestConfig & { _retry?: boolean };

// 401 from these endpoints means "bad credentials", not "session expired" —
// firing the global auth-expired event here would flash a misleading
// "session expired" toast at someone who just mistyped their password.
const isCredentialEndpoint = (url?: string): boolean => {
  if (!url) return false;
  return url.endsWith('/players/login') || url.endsWith('/players') || url.includes('/auth/');
};

const handleResponseError = async (error: AxiosError): Promise<unknown> => {
  const status   = error.response?.status;
  const original = error.config as RetriableConfig | undefined;

  if (status === 401 && isCredentialEndpoint(original?.url)) {
    return Promise.reject(error);
  }

  // Only retry once, only on 401, only when we still have a refresh token.
  if (status !== 401 || !original || original._retry || !getRefreshToken()) {
    if (status === 401) notifyAuthExpired();
    return Promise.reject(error);
  }
  // Don't try to refresh on a failed refresh call itself.
  if (original.url?.endsWith('/auth/refresh')) {
    notifyAuthExpired();
    return Promise.reject(error);
  }

  original._retry = true;
  try {
    if (!refreshInFlight) refreshInFlight = doRefresh().finally(() => { refreshInFlight = null; });
    const newAccess = await refreshInFlight;
    original.headers = original.headers ?? {};
    (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;
    // Replay through the correct axios instance based on the original timeout config.
    const targetClient = (original.timeout ?? 0) > 60000 ? aiApi : api;
    return targetClient.request(original);
  } catch (refreshError) {
    notifyAuthExpired();
    return Promise.reject(refreshError);
  }
};
api.interceptors.response.use(undefined,   error => handleResponseError(error as AxiosError));
aiApi.interceptors.response.use(undefined, error => handleResponseError(error as AxiosError));

export type PlayerLevel = 'BEGINNER' | 'INTERMEDIATE' | 'SENIOR' | 'MASTER';
export type Verdict = 'CORRECT' | 'PARTIAL' | 'WRONG';
export type PracticeMode =
  | 'BUG_HUNT'
  | 'TEST_FIRST'
  | 'OUTPUT_TRACING'
  | 'EDGE_CASE_RESCUE'
  | 'WORKED_EXAMPLE';

export type Misconception =
  | 'off_by_one_inclusive'
  | 'wrong_boundary_condition'
  | 'missing_null_guard'
  | 'wrong_branch_logic'
  | 'assignment_vs_comparison'
  | 'premature_return'
  | 'async_not_awaited'
  | 'mutation_in_iteration'
  | 'type_coercion_surprise'
  | 'wrong_default_value'
  | 'copy_paste_bug'
  | 'did_not_change_logic';

export const MISCONCEPTION_LABELS: Record<Misconception, string> = {
  off_by_one_inclusive:     'Off-by-one (inclusive vs exclusive)',
  wrong_boundary_condition: 'Wrong boundary condition',
  missing_null_guard:       'Missing null / empty guard',
  wrong_branch_logic:       'Wrong branch logic',
  assignment_vs_comparison: 'Assignment used as comparison',
  premature_return:         'Premature return',
  async_not_awaited:        'Async value not awaited',
  mutation_in_iteration:    'Mutation while iterating',
  type_coercion_surprise:   'Type-coercion surprise',
  wrong_default_value:      'Wrong default value',
  copy_paste_bug:           'Copy-paste leftover',
  did_not_change_logic:     "Didn't change the logic",
};

export const misconceptionLabel = (key?: string | null): string | null => {
  if (!key) return null;
  return (MISCONCEPTION_LABELS as Record<string, string>)[key] ?? null;
};

export interface Player {
  id: string;
  username: string;
  email: string;
  preferredLanguage: string;
  programmingLanguage: string;
  level: PlayerLevel;
  currentXp: number;
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
}

export interface Challenge {
  id: string;
  topic: string;
  difficulty: PlayerLevel;
  programmingLanguage: string;
  practiceMode: PracticeMode;
  buggyCode: string;
  hint: string;
  xpReward: number;
  missionBrief: string;
  successCriteria: string;
  reflectionPrompt: string;
  // Only populated when practiceMode === 'WORKED_EXAMPLE'.
  correctCode?: string | null;
  bugExplanation?: string | null;
}

export interface StudyCompleteResponse {
  xpEarned: number;
  streakBonusXp: number;
  dailyGoalBonusXp: number;
  engagement: EngagementState;
}

export interface EvaluationResponse {
  verdict: Verdict;
  feedback: string;
  xpEarned: number;
  encouragement: string;
  correctCode: string | null;
  streakBonusXp: number;
  dailyGoalBonusXp: number;
  engagement: EngagementState;
  misconception: string | null;
}

export type ProgressStatus = 'LOCKED' | 'ACTIVE' | 'COMPLETED';

export interface ProgressionNode {
  nodeId: string;
  title: string;
  topic: string;
  difficulty: PlayerLevel;
  practiceMode: PracticeMode;
  learningObjective: string;
  xpReward: number;
  orderIndex: number;
  status: ProgressStatus;
  starsEarned: number;
}

export interface ProgressionState {
  playerId: string;
  activeNodeId: string | null;
  completedCount: number;
  totalCount: number;
  nodes: ProgressionNode[];
}

export interface EngagementState {
  heartsRemaining: number;
  maxHearts: number;
  minutesUntilNextHeart: number;
  nextHeartRefillAtEpochMs: number;
  dailyGoalProgress: number;
  dailyGoalTarget: number;
  dailyGoalCompleted: boolean;
  streak: number;
  longestStreak: number;
  streakBonusXp: number;
  dailyGoalBonusXp: number;
}

export type QuestType = 'DAILY_PRACTICE' | 'BUG_HUNTER' | 'LESSON_PATH';

export interface DailyQuest {
  type: QuestType;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardXp: number;
  completed: boolean;
  claimed: boolean;
}

export interface QuestBoard {
  playerId: string;
  questDate: string;
  quests: DailyQuest[];
}

export type League = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  username: string;
  totalXp: number;
  currentStreak: number;
  league: League;
  currentPlayer: boolean;
}

export interface LeaderboardResponse {
  league: League;
  entries: LeaderboardEntry[];
}

export type ClassroomRole = 'STUDENT' | 'TEACHER';

export interface ClassroomResponse {
  id: string;
  name: string;
  ownerPlayerId: string;
  joinCode: string;
  memberCount: number;
  role: ClassroomRole;
  createdAt: string;
}

export interface ClassroomMemberStat {
  playerId: string;
  username: string;
  role: ClassroomRole;
  level: PlayerLevel;
  totalXp: number;
  currentStreak: number;
  attemptsLast7Days: number;
  correctRateLast7Days: number;
  topMisconception: string | null;
  weakestSkill: string | null;
  joinedAt: string;
}

export interface MisconceptionCount { misconception: string; count: number; }
export interface SkillCount { category: string; attempts: number; avgConfidence: number; }

export interface ClassroomDashboard {
  classroom: ClassroomResponse;
  totalStudents: number;
  activeStudentsLast7Days: number;
  avgCorrectRateLast7Days: number;
  commonMisconceptions: MisconceptionCount[];
  weakSkills: SkillCount[];
  members: ClassroomMemberStat[];
}

export const createClassroom = async (data: { ownerPlayerId: string; name: string }): Promise<ClassroomResponse> => {
  const res = await api.post('/classrooms', data);
  return unwrap(res.data);
};

export const joinClassroom = async (data: { playerId: string; joinCode: string }): Promise<ClassroomResponse> => {
  const res = await api.post('/classrooms/join', data);
  return unwrap(res.data);
};

export const listClassrooms = async (playerId: string): Promise<ClassroomResponse[]> => {
  const res = await withRetry(() => api.get(`/classrooms/player/${playerId}`), 1);
  return unwrap(res.data);
};

export const getClassroomDashboard = async (classroomId: string, _teacherId: string): Promise<ClassroomDashboard> => {
  // teacherId is now resolved server-side from the JWT — we ignore the parameter
  // to keep the call sites' arity unchanged for now.
  const res = await withRetry(() => api.get(`/classrooms/${classroomId}/dashboard`), 1);
  return unwrap(res.data);
};

export interface AttemptItem {
  challengeId: string;
  topic: string;
  bugPattern: string;
  verdict: Verdict;
  misconception: string | null;
  hintLevel: number;
  durationSec: number;
  createdAt: string;
}

export interface TutorMessageItem {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface ChallengeTranscript {
  challengeId: string;
  topic: string;
  messages: TutorMessageItem[];
}

export interface StudentDeepDive {
  playerId: string;
  username: string;
  level: PlayerLevel;
  totalXp: number;
  currentStreak: number;
  recentAttempts: AttemptItem[];
  recentTranscripts: ChallengeTranscript[];
}

export const getStudentDeepDive = async (classroomId: string, studentId: string): Promise<StudentDeepDive> => {
  const res = await withRetry(
    () => api.get(`/classrooms/${classroomId}/students/${studentId}/deep-dive`),
    1,
  );
  return unwrap(res.data);
};

export interface AssignmentResponse {
  id: string;
  classroomId: string;
  classroomName: string;
  title: string;
  description: string;
  targetTopic: string | null;
  targetPracticeMode: PracticeMode | null;
  targetCount: number;
  dueAt: string;
  createdAt: string;
  // populated only on the player/student endpoint
  completedCount: number | null;
  completed: boolean | null;
  overdue: boolean | null;
}

export const createAssignment = async (classroomId: string, data: {
  teacherId: string;
  title: string;
  description?: string;
  targetTopic?: string | null;
  targetPracticeMode?: PracticeMode | null;
  targetCount?: number;
  dueAt: string;
}): Promise<AssignmentResponse> => {
  const res = await api.post(`/assignments/classroom/${classroomId}`, data);
  return unwrap(res.data);
};

export const listAssignmentsForClassroom = async (classroomId: string): Promise<AssignmentResponse[]> => {
  const res = await withRetry(() => api.get(`/assignments/classroom/${classroomId}`), 1);
  return unwrap(res.data);
};

export const listAssignmentsForPlayer = async (playerId: string): Promise<AssignmentResponse[]> => {
  const res = await withRetry(() => api.get(`/assignments/player/${playerId}`), 1);
  return unwrap(res.data);
};

export type ErrorCategory = 'network' | 'auth' | 'validation' | 'server' | 'unknown';

export interface AppError extends Error {
  category: ErrorCategory;
  status?: number;
}

interface ApiEnvelope<T> {
  data: T;
}

const unwrap = <T>(response: ApiEnvelope<T>): T => response.data;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const categoryFromStatus = (status?: number): ErrorCategory => {
  if (!status) return 'network';
  if (status === 401 || status === 403) return 'auth';
  if (status >= 400 && status < 500) return 'validation';
  if (status >= 500) return 'server';
  return 'unknown';
};

const shouldRetry = (error: unknown): boolean => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  const status = error.response.status;
  return status >= 500;
};

const withRetry = async <T>(task: () => Promise<T>, retries = 1): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt === retries || !shouldRetry(error)) {
        throw error;
      }
      await delay(300 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unknown retry error');
};

export const normalizeAppError = (error: unknown): AppError => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const apiMessage = error.response?.data?.error?.message;
    const timeoutMessage = error.code === 'ECONNABORTED' || error.message.toLowerCase().includes('timeout')
      ? 'The server is still waking up. Please wait a moment and try again.'
      : '';
    return {
      name: 'AppError',
      message: typeof apiMessage === 'string' && apiMessage.trim()
        ? apiMessage
        : timeoutMessage || error.message || 'Request failed',
      category: categoryFromStatus(status),
      status,
    };
  }

  if (error instanceof Error) {
    return {
      name: 'AppError',
      message: error.message,
      category: 'unknown',
    };
  }

  return {
    name: 'AppError',
    message: 'Unknown error',
    category: 'unknown',
  };
};

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  const normalized = normalizeAppError(error);
  return normalized.message || fallback;
};

export interface AuthResult {
  player: Player;
  accessToken: string;
  refreshToken: string;
  accessExpiresAtEpochMs: number;
  passwordSet: boolean;
}

const storeAuth = (result: AuthResult): AuthResult => {
  setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  return result;
};

export const registerPlayer = async (data: {
  username: string; email: string; password: string;
  programmingLanguage: string; level: PlayerLevel;
}): Promise<AuthResult> => {
  await warmBackend();
  const res = await authApi.post('/players', data);
  return storeAuth(unwrap(res.data) as AuthResult);
};

export const loginPlayer = async (identifier: string, password?: string): Promise<AuthResult> => {
  await warmBackend();
  const res = await authApi.post('/players/login', { identifier, password: password || undefined });
  return storeAuth(unwrap(res.data) as AuthResult);
};

export const logout = async (): Promise<void> => {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  setTokens(null);
  // Best-effort — if the server is unreachable we already cleared local state.
  if (refreshToken) {
    try { await axios.post(`${API_BASE}/auth/logout`, { refreshToken }, { timeout: LOGOUT_TIMEOUT_MS }); } catch { /* ignore */ }
  }
};

export const setMyPassword = async (newPassword: string): Promise<Player> => {
  const res = await api.post('/players/me/set-password', { newPassword });
  return unwrap(res.data);
};

export interface PrivacySettings {
  tutorMessagesOptIn: boolean;
}

export const getMyPrivacy = async (): Promise<PrivacySettings> => {
  const res = await api.get('/players/me/privacy');
  return unwrap(res.data);
};

export const updateMyPrivacy = async (settings: PrivacySettings): Promise<PrivacySettings> => {
  const res = await api.patch('/players/me/privacy', settings);
  return unwrap(res.data);
};

export const getPlayer = async (id: string): Promise<Player> => {
  const res = await withRetry(() => api.get(`/players/${id}`), 1);
  return unwrap(res.data);
};

export const getProgression = async (playerId: string): Promise<ProgressionState> => {
  const res = await withRetry(() => api.get(`/progression/${playerId}`), 1);
  return unwrap(res.data);
};

export const getEngagement = async (playerId: string): Promise<EngagementState> => {
  const res = await withRetry(() => api.get(`/engagement/${playerId}`), 1);
  return unwrap(res.data);
};

export const completeProgressionNode = async (playerId: string, stars = 3): Promise<ProgressionState> => {
  const res = await api.post(`/progression/${playerId}/complete`, { stars });
  return unwrap(res.data);
};

export const getQuests = async (playerId: string): Promise<QuestBoard> => {
  const res = await withRetry(() => api.get(`/quests/${playerId}`), 1);
  return unwrap(res.data);
};

export const claimQuest = async (playerId: string, questType: QuestType): Promise<QuestBoard> => {
  const res = await api.post(`/quests/${playerId}/claim/${questType}`);
  return unwrap(res.data);
};

export const getLeaderboard = async (playerId: string, limit = 20): Promise<LeaderboardResponse> => {
  const res = await withRetry(() => api.get(`/leaderboard/${playerId}`, { params: { limit } }), 1);
  return unwrap(res.data);
};

export const generateChallenge = async (
  playerId: string, programmingLanguage: string,
  difficulty: PlayerLevel, topic?: string, practiceMode?: PracticeMode
): Promise<Challenge> => {
  const res = await withRetry(() => aiApi.post(`/challenges/generate/${playerId}`, {
    programmingLanguage, difficulty, topic, practiceMode,
  }), 1);
  return unwrap(res.data);
};

export const markStudyComplete = async (data: {
  playerId: string;
  challengeId: string;
  reflectionNote?: string;
}): Promise<StudyCompleteResponse> => {
  const res = await api.post('/challenges/study-complete', data);
  return unwrap(res.data);
};

export const submitSolution = async (data: {
  playerId: string; challengeId: string;
  studentSolution: string; humanLanguage: string;
  hintLevel?: number; attemptsOnChallenge?: number;
  helpUsed?: string[]; durationSec?: number;
}): Promise<EvaluationResponse> => {
  const res = await aiApi.post('/challenges/submit', data);
  return unwrap(res.data);
};

export const getLearningState = async (playerId: string): Promise<LearningState> => {
  const res = await withRetry(() => api.get(`/learning/${playerId}`), 1);
  return unwrap(res.data);
};

export const setSessionChallenge = async (
  sessionId: string, challengeId: string, buggyCode: string,
  programmingLanguage: string, practiceMode: PracticeMode,
  missionBrief: string, successCriteria: string, reflectionPrompt: string,
  playerLevel: string, humanLanguage: string
): Promise<void> => {
  await withRetry(() => api.post(`/sessions/${sessionId}/challenge`, {
    challengeId, buggyCode, programmingLanguage, practiceMode, missionBrief, successCriteria, reflectionPrompt, playerLevel, humanLanguage
  }), 1);
};

export const streamTutorMessage = (
  sessionId: string, message: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: Error) => void,
  signal?: AbortSignal
): Promise<void> => {
  const buildHeaders = (): Record<string, string> => {
    const token = getAuthToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const openStream = (): Promise<Response> => fetch(`${API_BASE}/tutor/chat/${sessionId}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ message }),
    signal,
  });

  // Try once; if we get a 401, attempt to refresh the access token, then retry once.
  return openStream().then(async (initialResponse) => {
    let response: Response = initialResponse;
    if (response.status === 401 && getRefreshToken()) {
      try {
        if (!refreshInFlight) refreshInFlight = doRefresh().finally(() => { refreshInFlight = null; });
        await refreshInFlight;
        response = await openStream();
      } catch {
        notifyAuthExpired();
      }
    } else if (response.status === 401) {
      notifyAuthExpired();
    }
    if (!response.ok) {
      let responseMessage = '';
      try {
        const body = await response.json() as { error?: { message?: string } };
        responseMessage = body.error?.message ?? '';
      } catch {
        responseMessage = '';
      }

      const error: AppError = {
        name: 'AppError',
        message: responseMessage || `Tutor request failed: ${response.status}`,
        category: categoryFromStatus(response.status),
        status: response.status,
      };
      throw error;
    }
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // SSE spec: one event may carry SEVERAL `data:` lines, which the client must
    // join with "\n". The backend streams Flux<String>, so any model chunk that
    // contains a newline (blank lines between paragraphs, code fences) arrives as
    // multiple data: lines in one event. Emitting each line separately silently
    // strips every newline — markdown paragraphs and ``` blocks collapse.
    let eventData: string[] = [];
    let eventHasData = false;

    const flushEvent = () => {
      if (!eventHasData) return;
      const payload = eventData.join('\n');
      eventData = [];
      eventHasData = false;
      if (payload.trim() === '[DONE]') return;
      onChunk(payload);
    };

    const handleLine = (rawLine: string) => {
      const line = rawLine.replace(/\r$/, '');
      if (line.startsWith(':')) return;          // comment / keep-alive
      if (!line) { flushEvent(); return; }       // blank line = end of event

      if (line.startsWith('data:')) {
        // Do not strip leading spaces; some models stream them as word boundaries.
        eventData.push(line.slice(5));
        eventHasData = true;
        return;
      }

      // Non-SSE line (plain text fallback) — emit as-is.
      onChunk(line);
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        if (buffer) handleLine(buffer);
        flushEvent();
        onDone();
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      lines.forEach(handleLine);
    }
  }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return;
    }

    const normalized = normalizeAppError(error);
    onError(normalized);
  });
};
