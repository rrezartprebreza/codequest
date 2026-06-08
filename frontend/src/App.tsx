import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import {
  BookOpen,
  Brain,
  ArrowUpRight,
  CheckCircle2,
  Code2,
  Eye,
  Flame,
  FolderOpen,
  GraduationCap,
  Heart,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  PlayCircle,
  RefreshCw,
  Route,
  Search,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  X,
  Youtube,
} from 'lucide-react';
import {
  AssignmentResponse,
  Challenge,
  claimQuest,
  completeProgressionNode,
  DailyQuest,
  EngagementState,
  generateChallenge,
  getApiErrorMessage,
  getEngagement,
  getLeaderboard,
  getLearningState,
  getPlayer,
  getMyPrivacy,
  getProgression,
  getQuests,
  LeaderboardResponse,
  listAssignmentsForPlayer,
  onAuthExpired,
  Player,
  PlayerLevel,
  PracticeMode,
  PrivacySettings,
  ProgressionNode,
  ProgressionState,
  ProgressStatus,
  QuestBoard,
  logout as serverLogout,
  setAuthToken,
  setSessionChallenge,
  updateMyPrivacy,
} from './services/api';
import ChatWindow from './components/Chat/ChatWindow';
import ChallengePanel from './components/Challenge/ChallengePanel';
import OnboardingModal from './components/Layout/OnboardingModal';
import LeagueTable from './components/Layout/LeagueTable';
import XPBar from './components/XPBar/XPBar';
import ClassroomDrawer from './components/Classroom/ClassroomDrawer';
import {
  buildChallengeReason,
  buildReviewPlan,
  buildSmartLearningPlan,
  categoryLabel,
  emptyLearningState,
  EvaluationEvent,
  getLearningSummary,
  getSkillInsights,
  hasSeenChallengeFingerprint,
  LearningState,
  loadLearningState,
  saveLearningState,
  suggestDifficulty,
  suggestFocusTopic,
  updateLearningState,
} from './services/learningEngine';
import {
  buildYoutubeEmbedUrl,
  buildNodeLearningContent,
  buildYoutubeSearchUrl,
} from './services/pathContent';
import type { VideoResource } from './services/pathContent';
import {
  completeNodeLearningSession,
  getDueReviewCards,
  getNodePathProgress,
  loadPathProgressState,
  markVideoWatched,
  PathProgressState,
  savePathProgressState,
  scoreExercise,
} from './services/pathProgress';

type AppPhase = 'booting' | 'onboarding' | 'loading' | 'ready' | 'error';
type SideDrawer = 'dashboard' | 'plan' | 'history' | 'portfolio' | 'league' | 'classroom' | 'settings' | null;
type Workspace = 'path' | 'practice';

const FOCUS_CHIPS = ['Loops', 'Recursion', 'Arrays', 'SQL', 'Async'];

const PRACTICE_MODES: Array<{ id: PracticeMode; label: string; icon: ReactNode }> = [
  { id: 'BUG_HUNT',         label: 'Bug hunt',     icon: <Search size={14} /> },
  { id: 'TEST_FIRST',       label: 'Test first',   icon: <CheckCircle2 size={14} /> },
  { id: 'OUTPUT_TRACING',   label: 'Tracing',      icon: <Eye size={14} /> },
  { id: 'EDGE_CASE_RESCUE', label: 'Edge cases',   icon: <Target size={14} /> },
  { id: 'WORKED_EXAMPLE',   label: 'Worked ex.',   icon: <BookOpen size={14} /> },
];

const SESSION_ID = (() => {
  const key = 'codequest_session_id';
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessionStorage.setItem(key, id);
  return id;
})();

export default function App() {
  const [phase, setPhase] = useState<AppPhase>('booting');
  const [phaseError, setPhaseError] = useState('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [challengeReason, setChallengeReason] = useState('');
  const [focusTopic, setFocusTopic] = useState(() => localStorage.getItem('codequest_focus_topic') ?? '');
  const [selectedPracticeMode, setSelectedPracticeMode] = useState<PracticeMode>(() => (
    (localStorage.getItem('codequest_practice_mode') as PracticeMode) || 'BUG_HUNT'
  ));
  const [queuedTutorPrompt, setQueuedTutorPrompt] = useState('');
  const [learningState, setLearningState] = useState<LearningState>(() => emptyLearningState());
  const [progression, setProgression] = useState<ProgressionState | null>(null);
  const [engagement, setEngagement] = useState<EngagementState | null>(null);
  const [quests, setQuests] = useState<QuestBoard | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardResponse | null>(null);
  const [assignments, setAssignments] = useState<AssignmentResponse[]>([]);
  const [drawer, setDrawer] = useState<SideDrawer>(null);
  const [workspace, setWorkspace] = useState<Workspace>('path');

  const requestSerialRef = useRef(0);
  const humanLanguage = player?.preferredLanguage ?? navigator.language.split('-')[0] ?? 'en';
  const tutorSessionId = player ? `${SESSION_ID}_${player.id}` : SESSION_ID;
  const challengeStorageKey = player ? `codequest_challenge_${player.id}` : '';
  const loadingChallenge = phase === 'loading';
  const showOnboarding = phase === 'onboarding';

  useEffect(() => {
    localStorage.setItem('codequest_focus_topic', focusTopic);
  }, [focusTopic]);

  useEffect(() => {
    localStorage.setItem('codequest_practice_mode', selectedPracticeMode);
  }, [selectedPracticeMode]);

  useEffect(() => {
    if (!challengeStorageKey || !challenge) return;
    sessionStorage.setItem(challengeStorageKey, JSON.stringify(challenge));
  }, [challenge, challengeStorageKey]);

  useEffect(() => {
    if (!player) return;
    saveLearningState(player.id, learningState);
  }, [player?.id, learningState]);

  const generateAndBindChallenge = useCallback(async (
    targetPlayer: Player,
    languageOverride?: string,
    learningOverride?: LearningState,
    progressionOverride?: ProgressionState | null,
    topicOverride?: string,
    practiceModeOverride?: PracticeMode,
  ) => {
    const requestId = ++requestSerialRef.current;
    const targetTutorSessionId = `${SESSION_ID}_${targetPlayer.id}`;

    setPhase('loading');
    setPhaseError('');

    const activeLearning = learningOverride ?? learningState;
    const activeProgression = progressionOverride ?? progression;
    const latestEngagement = await getEngagement(targetPlayer.id).catch(() => engagement);
    if (requestId === requestSerialRef.current && latestEngagement) {
      setEngagement(latestEngagement);
    }
    const activeNode = activeProgression?.nodes.find(node => node.status === 'ACTIVE') ?? null;
    const requestedDifficulty = activeNode?.difficulty ?? suggestDifficulty(targetPlayer.level, activeLearning);
    const fallbackFocus = suggestFocusTopic(activeLearning);
    const topic = topicOverride || focusTopic.trim() || activeNode?.topic || fallbackFocus || undefined;
    const practiceMode = practiceModeOverride || activeNode?.practiceMode || selectedPracticeMode;

    try {
      let generated: Challenge | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const candidate = await generateChallenge(
          targetPlayer.id,
          targetPlayer.programmingLanguage,
          requestedDifficulty,
          topic,
          practiceMode,
        );

        if (!hasSeenChallengeFingerprint(activeLearning, candidate) || attempt === 2) {
          generated = candidate;
          break;
        }
      }

      if (!generated) throw new Error('Challenge generation failed');
      if (requestId !== requestSerialRef.current) return;

      setChallenge(generated);
      setChallengeReason(buildChallengeReason(activeLearning, generated, topicOverride));
      setPhase('ready');

      await setSessionChallenge(
        targetTutorSessionId,
        generated.id,
        generated.buggyCode,
        generated.programmingLanguage,
        generated.practiceMode,
        generated.missionBrief,
        generated.successCriteria,
        generated.reflectionPrompt,
        requestedDifficulty,
        languageOverride ?? targetPlayer.preferredLanguage ?? humanLanguage,
      ).catch(() => {});
    } catch (error) {
      if (requestId !== requestSerialRef.current) return;
      setPhaseError(getApiErrorMessage(error, 'Failed to generate challenge. Check your connection.'));
      setPhase('error');
    }
  }, [engagement, focusTopic, humanLanguage, learningState, progression, selectedPracticeMode]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const savedId = localStorage.getItem('codequest_player_id');
      if (!savedId) {
        if (active) setPhase('onboarding');
        return;
      }

      try {
        const loadedPlayer = await getPlayer(savedId);
        const loadedTutorSessionId = `${SESSION_ID}_${loadedPlayer.id}`;
        if (!active) return;
        setPlayer(loadedPlayer);

        const [loadedProgression, loadedEngagement, loadedQuests, loadedLeaderboard, loadedLearning, loadedAssignments] = await Promise.all([
          getProgression(loadedPlayer.id),
          getEngagement(loadedPlayer.id),
          getQuests(loadedPlayer.id),
          getLeaderboard(loadedPlayer.id),
          loadPlayerLearningState(loadedPlayer.id),
          listAssignmentsForPlayer(loadedPlayer.id).catch(() => [] as AssignmentResponse[]),
        ]);
        if (!active) return;
        setProgression(loadedProgression);
        setEngagement(loadedEngagement);
        setQuests(loadedQuests);
        setLeaderboard(loadedLeaderboard);
        setLearningState(loadedLearning);
        setAssignments(loadedAssignments);

        const restored = restoreChallenge(loadedPlayer.id);
        if (restored) {
          setChallenge(restored);
          setChallengeReason(buildChallengeReason(loadedLearning, restored));
          setPhase('ready');
          setWorkspace('path');
          void setSessionChallenge(
            loadedTutorSessionId,
            restored.id,
            restored.buggyCode,
            restored.programmingLanguage,
            restored.practiceMode,
            restored.missionBrief,
            restored.successCriteria,
            restored.reflectionPrompt,
            loadedPlayer.level,
            loadedPlayer.preferredLanguage ?? humanLanguage,
          ).catch(() => {});
          return;
        }

        setPhase('ready');
        setWorkspace('path');
      } catch (error) {
        localStorage.removeItem('codequest_player_id');
        if (!active) return;
        setPhaseError(getApiErrorMessage(error, 'Failed to load your account.'));
        setPhase('onboarding');
      }
    };

    void load();
    return () => { active = false; };
    // generateAndBindChallenge has stable refs on player + state; load() should run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOnboardingComplete = async (
    playerId: string,
    _username: string,
    _lang: string,
    _level: PlayerLevel,
    placementFocus?: string,
  ) => {
    try {
      const loadedPlayer = await getPlayer(playerId);
      const [loadedProgression, loadedEngagement, loadedQuests, loadedLeaderboard, loadedLearning, loadedAssignments] = await Promise.all([
        getProgression(loadedPlayer.id),
        getEngagement(loadedPlayer.id),
        getQuests(loadedPlayer.id),
        getLeaderboard(loadedPlayer.id),
        loadPlayerLearningState(loadedPlayer.id),
        listAssignmentsForPlayer(loadedPlayer.id).catch(() => [] as AssignmentResponse[]),
      ]);
      setPlayer(loadedPlayer);
      setProgression(loadedProgression);
      setEngagement(loadedEngagement);
      setQuests(loadedQuests);
      setLeaderboard(loadedLeaderboard);
      setLearningState(loadedLearning);
      setAssignments(loadedAssignments);
      if (placementFocus) setFocusTopic(placementFocus);
      setPhase('ready');
      setWorkspace('path');
    } catch (error) {
      setPhaseError(getApiErrorMessage(error, 'Failed to complete onboarding.'));
      setPhase('onboarding');
      toast.error('Failed to load player. Try again.');
    }
  };

  const handleReset = () => {
    if (player) {
      sessionStorage.removeItem(`codequest_challenge_${player.id}`);
      localStorage.removeItem(`codequest_learning_${player.id}`);
      localStorage.removeItem(`codequest_path_progress_${player.id}`);
    }
    localStorage.removeItem('codequest_player_id');
    // Fire-and-forget: revoke the refresh-token family on the server.
    // Clears local tokens immediately regardless of network outcome.
    void serverLogout();
    setAuthToken(null);
    setPlayer(null);
    setChallenge(null);
    setChallengeReason('');
    setProgression(null);
    setEngagement(null);
    setQuests(null);
    setLeaderboard(null);
    setAssignments([]);
    setLearningState(emptyLearningState());
    setWorkspace('path');
    setPhase('onboarding');
    setPhaseError('');
  };

  // Listen for 401 from any API call — token expired or invalid → bounce to onboarding.
  useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      toast.error('Your session has expired. Please sign in again.');
      handleReset();
    });
    return unsubscribe;
    // handleReset captures setters which are stable; safe to mount once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEvaluated = (event: EvaluationEvent) => {
    setLearningState(prev => updateLearningState(prev, event));
  };

  const handleChallengeComplete = async (stars: number) => {
    if (!player) return;
    try {
      const updatedProgression = await completeProgressionNode(player.id, stars).catch(() => progression);
      setProgression(updatedProgression ?? null);
      const [refreshedPlayer, refreshedEngagement, refreshedQuests, refreshedLeaderboard] = await Promise.all([
        getPlayer(player.id),
        getEngagement(player.id),
        getQuests(player.id),
        getLeaderboard(player.id),
      ]);
      setPlayer(refreshedPlayer);
      setEngagement(refreshedEngagement);
      setQuests(refreshedQuests);
      setLeaderboard(refreshedLeaderboard);
      setChallenge(null);
      setChallengeReason('');
      setWorkspace('path');
      setPhase('ready');
      toast.success('Node practice complete. Continue from the learning path.');
    } catch (error) {
      setPhaseError(getApiErrorMessage(error, 'Failed to refresh your progress.'));
      setPhase('error');
    }
  };

  const handleSubmissionResolved = async () => {
    if (!player) return;
    const [nextQuests, nextLeaderboard, nextAssignments] = await Promise.all([
      getQuests(player.id).catch(() => null),
      getLeaderboard(player.id).catch(() => null),
      listAssignmentsForPlayer(player.id).catch(() => null),
    ]);
    if (nextQuests) setQuests(nextQuests);
    if (nextLeaderboard) setLeaderboard(nextLeaderboard);
    if (nextAssignments) setAssignments(nextAssignments);
  };

  const claimQuestReward = async (quest: DailyQuest) => {
    if (!player) return;
    try {
      const updated = await claimQuest(player.id, quest.type);
      setQuests(updated);
      const refreshedPlayer = await getPlayer(player.id);
      setPlayer(refreshedPlayer);
      const refreshedLeaderboard = await getLeaderboard(player.id);
      setLeaderboard(refreshedLeaderboard);
      toast.success(`Quest reward claimed: +${quest.rewardXp} XP`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not claim quest reward.'));
    }
  };

  const handleAskTutor = (prompt: string) => {
    setQueuedTutorPrompt(prompt);
  };

  const handleFocusChip = (topic: string) => {
    const next = focusTopic.toLowerCase() === topic.toLowerCase() ? '' : topic;
    setFocusTopic(next);
    if (next) toast.success(`Next missions will focus on ${next}`);
  };

  const startReviewSession = () => {
    if (!player) return;
    const plan = buildReviewPlan(learningState);
    if (!plan) {
      toast('Solve a few challenges first so CodeQuest can find weak topics.');
      return;
    }
    setFocusTopic(plan.topic);
    toast.success(plan.reason);
    setWorkspace('practice');
    void generateAndBindChallenge(player, player.preferredLanguage ?? humanLanguage, learningState, progression, plan.topic);
  };

  const learningSummary = useMemo(() => getLearningSummary(learningState), [learningState]);
  const skillInsights = useMemo(() => getSkillInsights(learningState), [learningState]);
  const smartPlan = useMemo(
    () => (player ? buildSmartLearningPlan(learningState, player.level, selectedPracticeMode) : null),
    [player, learningState, selectedPracticeMode],
  );

  return (
    <div className="flex h-screen flex-col bg-bg-0 text-ink">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-2)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-soft)',
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 500,
            boxShadow: 'var(--shadow-md)',
          },
          success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-0)' } },
          error:   { iconTheme: { primary: 'var(--danger)',  secondary: 'var(--bg-0)' } },
        }}
      />

      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      {drawer === 'league' && leaderboard && <LeagueTable data={leaderboard} onClose={() => setDrawer(null)} />}

      {player && (
        <>
          <TopBar
            player={player}
            engagement={engagement}
            challenge={challenge}
            loadingChallenge={loadingChallenge}
            workspace={workspace}
            onNewMission={() => {
              if (workspace === 'path') {
                setWorkspace('path');
                toast('Watch a tutorial and complete the quick check before practice.');
                return;
              }
              setWorkspace('practice');
              void generateAndBindChallenge(player);
            }}
            onOpenPath={() => setWorkspace('path')}
            onOpenSettings={() => setDrawer('settings')}
            onReset={handleReset}
          />

          {workspace === 'path' && progression && (
            <main className="flex-1 overflow-y-auto p-3 lg:overflow-hidden">
              <section className="mx-auto flex min-h-full max-w-[1500px] flex-col rounded-2xl border border-app-border bg-bg-1 p-4 shadow-sm lg:h-full lg:min-h-0 lg:overflow-hidden">
                <LearningPathContent
                  progression={progression}
                  player={player}
                  learningState={learningState}
                  tutorSessionId={tutorSessionId}
                  onStartNode={(node, video) => {
                    if (node.status === 'LOCKED') {
                      toast('Complete the active node before starting this one.');
                      return;
                    }
                    setFocusTopic(node.topic);
                    setSelectedPracticeMode(node.practiceMode);
                    setWorkspace('practice');
                    if (video) {
                      toast.success(`Mission based on: ${video.title}`);
                    }
                    void generateAndBindChallenge(
                      player,
                      undefined,
                      learningState,
                      progression,
                      video?.practiceFocus ?? node.topic,
                      node.practiceMode,
                    );
                  }}
                />
              </section>
            </main>
          )}

          {workspace === 'path' && !progression && (
            <main className="flex-1 overflow-hidden p-4">
              <section className="flex h-full rounded-2xl border border-app-border bg-bg-1 shadow-sm">
                <LoadingState />
              </section>
            </main>
          )}

          {workspace === 'practice' && (
            <main className="flex flex-1 gap-4 overflow-hidden p-4">
              <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-app-border bg-bg-1 shadow-sm">
                {phase === 'error' && (
                  <div className="mx-4 mt-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                    {phaseError || 'Something went wrong.'}
                    <button
                      onClick={() => void generateAndBindChallenge(player)}
                      className="ml-3 underline underline-offset-2"
                    >
                      Retry
                    </button>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto p-6">
                  {loadingChallenge && !challenge ? (
                    <LoadingState />
                  ) : challenge ? (
                    <ChallengePanel
                      challenge={challenge}
                      playerId={player.id}
                      humanLanguage={humanLanguage}
                      engagement={engagement}
                      challengeReason={challengeReason}
                      onEvaluated={handleEvaluated}
                      onEngagementChange={setEngagement}
                      onSubmissionResolved={handleSubmissionResolved}
                      onAskTutor={handleAskTutor}
                      onComplete={handleChallengeComplete}
                    />
                  ) : (
                    <EmptyState onStart={() => void generateAndBindChallenge(player)} />
                  )}
                </div>
              </section>

              <aside className="flex w-[400px] flex-shrink-0 flex-col overflow-hidden rounded-2xl border border-app-border bg-bg-1 shadow-sm">
                <ChatWindow
                  sessionId={tutorSessionId}
                  queuedPrompt={queuedTutorPrompt}
                  onQueuedPromptSent={() => setQueuedTutorPrompt('')}
                />
              </aside>
            </main>
          )}

          {drawer === 'dashboard' && (
            <Drawer title="Dashboard" onClose={() => setDrawer(null)}>
              <Sidebar
                player={player}
                engagement={engagement}
                quests={quests}
                skillInsights={skillInsights}
                selectedPracticeMode={selectedPracticeMode}
                onPracticeModeChange={setSelectedPracticeMode}
                focusTopic={focusTopic}
                onFocusChip={handleFocusChip}
                onClaimQuest={claimQuestReward}
                onReview={startReviewSession}
                progression={progression}
                onOpenPath={() => {
                  setWorkspace('path');
                  setDrawer(null);
                }}
                onOpenPlan={() => setDrawer('plan')}
                smartPlanHeadline={smartPlan?.headline}
                assignments={assignments}
                onOpenClassrooms={() => setDrawer('classroom')}
              />
            </Drawer>
          )}

          {drawer === 'plan' && smartPlan && (
            <Drawer title="Smart learning plan" onClose={() => setDrawer(null)}>
              <SmartPlanContent
                summary={smartPlan.summary}
                headline={smartPlan.headline}
                steps={smartPlan.steps.map(step => ({
                  id: step.id,
                  label: step.label,
                  title: step.title,
                  reason: step.reason,
                  minutes: step.estimatedMinutes,
                  topic: step.topic,
                  mode: step.practiceMode,
                }))}
                onStart={(topic, mode) => {
                  setFocusTopic(topic);
                  setSelectedPracticeMode(mode);
                  setDrawer(null);
                  setWorkspace('practice');
                  void generateAndBindChallenge(player, undefined, learningState, progression, topic, mode);
                }}
              />
            </Drawer>
          )}

          {drawer === 'history' && (
            <Drawer title="Recent attempts" onClose={() => setDrawer(null)}>
              <HistoryDrawerContent learningState={learningState} summary={learningSummary} />
            </Drawer>
          )}

          {drawer === 'portfolio' && (
            <Drawer title="Solved bugs" onClose={() => setDrawer(null)}>
              <PortfolioDrawerContent learningState={learningState} />
            </Drawer>
          )}

          {drawer === 'classroom' && (
            <ClassroomDrawer playerId={player.id} onClose={() => setDrawer(null)} />
          )}

          {drawer === 'settings' && (
            <Drawer title="Settings" onClose={() => setDrawer(null)}>
              <SettingsDrawerContent />
            </Drawer>
          )}
        </>
      )}

      {phase === 'booting' && !player && !showOnboarding && (
        <div className="flex h-full items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-ink-muted">
            <RefreshCw size={14} className="animate-spin text-accent" />
            Loading…
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Top bar
// ──────────────────────────────────────────────────────────────────────────

function TopBar({
  player,
  engagement,
  challenge,
  loadingChallenge,
  workspace,
  onNewMission,
  onOpenPath,
  onOpenSettings,
  onReset,
}: {
  player: Player;
  engagement: EngagementState | null;
  challenge: Challenge | null;
  loadingChallenge: boolean;
  workspace: Workspace;
  onNewMission: () => void;
  onOpenPath: () => void;
  onOpenSettings: () => void;
  onReset: () => void;
}) {
  const hearts = engagement?.heartsRemaining ?? 0;
  const maxHearts = engagement?.maxHearts ?? 5;
  const streak = engagement?.streak ?? player.currentStreak;
  const primaryLabel = workspace === 'path' ? 'Continue path' : 'New mission';

  return (
    <header className="flex flex-shrink-0 items-center justify-between border-b border-app-border bg-bg-0 px-4 py-3 lg:px-6">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-bg-0 shadow-sm">
          <Code2 size={16} />
        </div>
        <span className="text-[16px] font-bold tracking-tight text-ink">CodeQuest</span>
        <div className="ml-2 hidden h-5 w-px bg-app-border md:block" />
        <div className="hidden items-center gap-2 md:flex">
          {loadingChallenge ? (
            <span className="inline-flex items-center gap-2 text-xs text-ink-muted">
              <RefreshCw size={11} className="animate-spin text-accent" />
              Generating mission…
            </span>
          ) : challenge ? (
            <span className="inline-flex min-w-0 items-center gap-2 text-xs text-ink-muted">
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
              <span className="truncate font-medium text-ink">{challenge.topic}</span>
              <span className="hidden truncate xl:inline">· {challenge.difficulty.toLowerCase()} · {challenge.programmingLanguage}</span>
            </span>
          ) : (
            <span className="inline-flex min-w-0 items-center gap-2 text-xs text-ink-muted">
              <Route size={12} className="text-info" />
              Learning path
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Pill icon={<Sparkles size={11} />} tone="accent" title="Total XP">
          {player.totalXp.toLocaleString()}
        </Pill>
        <Pill icon={<Flame size={11} />} tone="warning" title="Streak">{streak}d</Pill>
        <Pill icon={<Heart size={11} />} tone="danger" title="Hearts">{hearts}/{maxHearts}</Pill>

        <div className="ml-1 hidden h-6 w-px bg-app-border md:block" />

        <IconButton title="Learning path" onClick={onOpenPath}><Route size={14} /></IconButton>
        <IconButton title="Settings" onClick={onOpenSettings}><SettingsIcon size={14} /></IconButton>
        <IconButton title="Sign out" onClick={onReset}><LogOut size={14} /></IconButton>

        <button
          onClick={onNewMission}
          disabled={loadingChallenge}
          className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg-0 transition-colors hover:bg-accent/85 disabled:opacity-50"
        >
          {loadingChallenge
            ? <><RefreshCw size={12} className="animate-spin" /> Generating</>
            : <><Sparkles size={12} /> {primaryLabel}</>}
        </button>
      </div>
    </header>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Sidebar
// ──────────────────────────────────────────────────────────────────────────

function Sidebar({
  player,
  engagement,
  quests,
  skillInsights,
  selectedPracticeMode,
  onPracticeModeChange,
  focusTopic,
  onFocusChip,
  onClaimQuest,
  onReview,
  progression,
  onOpenPath,
  onOpenPlan,
  smartPlanHeadline,
  assignments,
  onOpenClassrooms,
}: {
  player: Player;
  engagement: EngagementState | null;
  quests: QuestBoard | null;
  skillInsights: ReturnType<typeof getSkillInsights>;
  selectedPracticeMode: PracticeMode;
  onPracticeModeChange: (mode: PracticeMode) => void;
  focusTopic: string;
  onFocusChip: (topic: string) => void;
  onClaimQuest: (quest: DailyQuest) => void;
  onReview: () => void;
  progression: ProgressionState | null;
  onOpenPath: () => void;
  onOpenPlan: () => void;
  smartPlanHeadline?: string;
  assignments: AssignmentResponse[];
  onOpenClassrooms: () => void;
}) {
  const weakSkills = skillInsights.slice(0, 3);
  const activeNode = progression?.nodes.find(node => node.status === 'ACTIVE') ?? null;
  const pathProgress = progression ? Math.round((progression.completedCount / Math.max(1, progression.totalCount)) * 100) : 0;
  return (
    <div className="flex min-h-0 flex-col pb-4">
      <div className="mb-4">
        <XPBar player={player} engagement={engagement} compact />
      </div>

      <SidebarSection title="Learning path">
        <button
          onClick={onOpenPath}
          className="flex w-full items-start gap-2.5 rounded-xl border border-app-border bg-bg-2 px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-bg-3"
        >
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
            <Route size={13} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-ink">
              {activeNode ? activeNode.title : 'Build your path'}
            </span>
            <span className="mt-0.5 block text-[11px] text-ink-muted">
              {progression ? `${progression.completedCount}/${progression.totalCount} nodes · ${pathProgress}%` : 'Open path'}
            </span>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-bg-0">
              <span className="block h-full rounded-full bg-info transition-[width] duration-500" style={{ width: `${pathProgress}%` }} />
            </span>
          </span>
        </button>
      </SidebarSection>

      <SidebarSection title="Smart plan">
        <button
          onClick={onOpenPlan}
          className="flex w-full items-start gap-2.5 rounded-xl border border-app-border bg-bg-2 px-3 py-2.5 text-left transition-colors hover:border-accent/40 hover:bg-bg-3"
        >
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Brain size={13} />
          </span>
          <span className="min-w-0">
            <span className="block text-[12px] font-semibold text-ink">{smartPlanHeadline ?? 'Build a baseline'}</span>
            <span className="mt-0.5 block text-[11px] text-ink-muted">Open plan →</span>
          </span>
        </button>
      </SidebarSection>

      <SidebarSection title="Practice mode">
        <div className="grid grid-cols-2 gap-1.5">
          {PRACTICE_MODES.map(mode => {
            const active = selectedPracticeMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => onPracticeModeChange(mode.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors ${
                  active
                    ? 'border-accent/40 bg-accent/10 text-accent'
                    : 'border-app-border bg-bg-2 text-ink-muted hover:text-ink'
                }`}
              >
                {mode.icon}
                {mode.label}
              </button>
            );
          })}
        </div>
      </SidebarSection>

      <SidebarSection title="Focus topic">
        <div className="flex flex-wrap gap-1.5">
          {FOCUS_CHIPS.map(topic => {
            const active = focusTopic.toLowerCase() === topic.toLowerCase();
            return (
              <button
                key={topic}
                onClick={() => onFocusChip(topic)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-accent text-bg-0'
                    : 'bg-bg-2 text-ink-muted hover:text-ink'
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>
        {focusTopic && (
          <button
            onClick={() => onFocusChip(focusTopic)}
            className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-subtle hover:text-ink-muted"
          >
            <X size={10} /> Clear focus
          </button>
        )}
      </SidebarSection>

      {assignments.length > 0 && (
        <SidebarSection title="Assignments">
          <div className="space-y-1.5">
            {assignments.slice(0, 5).map(a => {
              const completed = a.completed === true;
              const overdue = a.overdue === true;
              const completedCount = a.completedCount ?? 0;
              const pct = Math.min(100, Math.round((completedCount / Math.max(1, a.targetCount)) * 100));
              const tone = completed ? 'bg-accent' : overdue ? 'bg-danger' : 'bg-warning';
              return (
                <div
                  key={a.id}
                  className="rounded-lg border border-app-border bg-bg-2 px-2.5 py-2"
                  title={`${a.classroomName} · due ${new Date(a.dueAt).toLocaleString()}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink">{a.title}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                      completed ? 'bg-accent/10 text-accent'
                        : overdue ? 'bg-danger/10 text-danger'
                        : 'bg-warning/10 text-warning'
                    }`}>
                      {completed ? '✓' : overdue ? 'overdue' : 'due'}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-[10px] text-ink-subtle">
                    {a.classroomName}
                    {a.targetTopic && ` · ${a.targetTopic}`}
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-0">
                    <div className={`h-full rounded-full transition-[width] duration-500 ${tone}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-ink-muted">
                    <span>{completedCount}/{a.targetCount}</span>
                    <span>{formatRelativeDue(a.dueAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {assignments.length > 5 && (
            <button
              onClick={onOpenClassrooms}
              className="mt-2 w-full text-[11px] text-ink-muted hover:text-ink"
            >
              View all in classrooms →
            </button>
          )}
        </SidebarSection>
      )}

      <SidebarSection title="Daily quests">
        <div className="space-y-1.5">
          {quests?.quests.map(quest => {
            const claimable = quest.completed && !quest.claimed;
            return (
              <button
                key={quest.type}
                onClick={() => claimable && onClaimQuest(quest)}
                disabled={!claimable}
                className="flex w-full items-center gap-2 rounded-lg border border-app-border bg-bg-2 px-2.5 py-2 text-left transition-colors enabled:hover:border-accent/30 disabled:cursor-default"
              >
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${
                  quest.claimed ? 'bg-ink-subtle' : quest.completed ? 'bg-accent' : 'bg-warning'
                }`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-ink">{quest.title}</span>
                  <span className="block truncate text-[11px] text-ink-muted">
                    {quest.claimed ? 'Claimed' : quest.completed ? 'Tap to claim' : `${quest.progress}/${quest.target}`}
                  </span>
                </span>
                <span className="text-[11px] font-semibold text-warning">+{quest.rewardXp}</span>
              </button>
            );
          }) ?? <p className="text-[11px] text-ink-subtle">No quests yet.</p>}
        </div>
      </SidebarSection>

      {weakSkills.length > 0 && (
        <SidebarSection title="Weak skills">
          <div className="space-y-1.5">
            {weakSkills.map(skill => (
              <div key={skill.category} className="rounded-lg border border-app-border bg-bg-2 px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-medium text-ink">{skill.label}</span>
                  <span className="font-mono text-[11px] text-ink-muted">{skill.confidence}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-0">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-500"
                    style={{ width: `${Math.max(skill.confidence, skill.attempts ? 6 : 0)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={onReview}
            className="mt-3 w-full rounded-lg border border-app-border bg-bg-2 px-2.5 py-2 text-[12px] font-medium text-ink transition-colors hover:border-accent/30 hover:text-accent"
          >
            Start review session
          </button>
        </SidebarSection>
      )}
    </div>
  );
}

function SidebarSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>{title}</p>
      {children}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Drawer
// ──────────────────────────────────────────────────────────────────────────

function Drawer({
  title,
  onClose,
  children,
  size = 'default',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: 'default' | 'wide';
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-bg-0/70 backdrop-blur-sm"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className={`flex h-full w-full flex-col border-l border-app-border bg-bg-1 animate-slide-up ${
        size === 'wide' ? 'max-w-[980px]' : 'max-w-[440px]'
      }`}>
        <header className="flex flex-shrink-0 items-center justify-between border-b border-app-border px-5 py-3.5">
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-bg-2 hover:text-ink"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function LearningPathContent({
  progression,
  player,
  learningState,
  tutorSessionId,
  onStartNode,
}: {
  progression: ProgressionState;
  player: Player;
  learningState: LearningState;
  tutorSessionId: string;
  onStartNode: (node: ProgressionNode, video?: VideoResource) => void;
}) {
  const defaultNodeId = progression.activeNodeId
    ?? progression.nodes.find(node => node.status !== 'COMPLETED')?.nodeId
    ?? progression.nodes[0]?.nodeId
    ?? null;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(defaultNodeId);
  const selectedNode = progression.nodes.find(node => node.nodeId === selectedNodeId) ?? progression.nodes[0] ?? null;
  const selectedContent = selectedNode
    ? buildNodeLearningContent(selectedNode, player.programmingLanguage, learningState)
    : null;
  const pathPct = Math.round((progression.completedCount / Math.max(1, progression.totalCount)) * 100);
  const [pathProgress, setPathProgress] = useState<PathProgressState>(() => loadPathProgressState(player.id));
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [pathCoachPrompt, setPathCoachPrompt] = useState('');
  const [lessonPanel, setLessonPanel] = useState<'info' | 'quiz' | 'coach'>('info');

  useEffect(() => {
    setPathProgress(loadPathProgressState(player.id));
  }, [player.id]);

  useEffect(() => {
    savePathProgressState(player.id, pathProgress);
  }, [player.id, pathProgress]);

  useEffect(() => {
    setSelectedVideoId(selectedContent?.videos[0]?.id ?? null);
  }, [selectedNode?.nodeId]);

  useEffect(() => {
    setLessonPanel('info');
  }, [selectedNode?.nodeId, selectedVideoId]);

  if (!selectedNode || !selectedContent) {
    return <p className="text-[13px] text-ink-muted">No path nodes are available yet.</p>;
  }

  const selectedVideo = selectedContent.videos.find(video => video.id === selectedVideoId) ?? selectedContent.videos[0];
  const nodeProgress = getNodePathProgress(pathProgress, selectedNode.nodeId);
  const selectedVideoWatched = nodeProgress.watchedVideoIds.includes(selectedVideo.id);
  const answeredQuizCount = selectedVideo.quiz
    .filter(question => typeof nodeProgress.exerciseAttempts[question.id]?.score === 'number')
    .length;
  const passedQuizCount = selectedVideo.quiz
    .filter(question => (nodeProgress.exerciseAttempts[question.id]?.score ?? 0) >= 80)
    .length;
  const quizComplete = selectedVideo.quiz.length > 0 && passedQuizCount === selectedVideo.quiz.length;
  const canCompleteLearning = selectedVideoWatched && quizComplete;
  const dueReviewCards = getDueReviewCards(pathProgress);
  const canPracticeSelectedVideo = selectedNode.status !== 'LOCKED' && canCompleteLearning;
  const gateLabel = !selectedVideoWatched
    ? 'Watch and mark the tutorial first'
    : !quizComplete
      ? 'Pass the tutorial quiz first'
      : 'Ready for practice';

  const handleMarkVideo = (videoId: string) => {
    setPathProgress(current => markVideoWatched(current, selectedNode.nodeId, videoId));
    toast.success('Video marked as watched.');
  };

  const handleAnswerQuiz = (questionId: string, selectedIndex: number, correctIndex: number) => {
    const correct = selectedIndex === correctIndex;
    setPathProgress(current => scoreExercise(current, selectedNode.nodeId, questionId, correct ? 100 : 30));
    if (correct) toast.success('Correct.');
    else toast('Not yet. Ask the coach or try again.');
  };

  const handleCompleteLearning = () => {
    if (!canCompleteLearning) {
      toast('Watch the tutorial and pass its quiz first.');
      return;
    }

    setPathProgress(current => {
      const quizContent = {
        ...selectedContent,
        exercises: selectedVideo.quiz.map(question => ({
          id: question.id,
          type: 'multiple_choice' as const,
          title: question.question,
          prompt: question.question,
          reviewPrompt: question.explanation,
          estimatedMinutes: 1,
        })),
      };
      const { state, result } = completeNodeLearningSession(current, selectedNode, quizContent);
      toast.success(`${result.score}% mastery · ${result.nextAction}`);
      return state;
    });
  };

  const handleStartPractice = () => {
    if (selectedNode.status === 'LOCKED') {
      toast('Complete the active node before starting this one.');
      return;
    }
    if (!selectedVideoWatched) {
      toast('Mark this tutorial as watched before practice.');
      return;
    }
    if (!quizComplete) {
      toast('Pass the tutorial quiz before practice.');
      return;
    }
    onStartNode(selectedNode, selectedVideo);
  };

  const sendPathCoachPrompt = (prompt: string) => {
    setPathCoachPrompt([
      `Learning path context: ${selectedNode.title}.`,
      `Tutorial: ${selectedVideo.title}.`,
      `Focus: ${selectedVideo.practiceFocus}.`,
      `Short explanation: ${selectedVideo.shortExplanation}`,
      prompt,
    ].join('\n'));
  };

  return (
    <div className="flex min-h-full flex-col gap-3 lg:h-full lg:min-h-0">
      <section className="flex-shrink-0 rounded-xl border border-app-border bg-bg-2 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tag">Learning path</span>
              <span className="tag">{player.programmingLanguage}</span>
              <span className="tag">{progression.completedCount}/{progression.totalCount} nodes</span>
            </div>
            <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.02em] text-ink">{selectedNode.title}</h2>
          </div>
          <button
            onClick={handleStartPractice}
            className={`inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
              canPracticeSelectedVideo
                ? 'bg-accent text-bg-0 hover:bg-accent/85'
                : 'border border-app-border bg-bg-1 text-ink-muted hover:border-warning/40 hover:text-warning'
            }`}
          >
            {selectedNode.status === 'LOCKED' ? <Lock size={13} /> : <PlayCircle size={13} />}
            {canPracticeSelectedVideo ? 'Practice video' : gateLabel}
          </button>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-0">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pathPct}%` }} />
        </div>
      </section>

      <div className="flex-shrink-0 overflow-x-auto rounded-xl border border-app-border bg-bg-2 p-2">
        <div className="flex min-w-max gap-2">
          {progression.nodes.map((node, index) => {
            const active = node.nodeId === selectedNode.nodeId;
            const locked = node.status === 'LOCKED';
            return (
              <button
                key={node.nodeId}
                onClick={() => {
                  if (locked) {
                    toast('Complete the active lesson before opening this node.');
                    return;
                  }
                  setSelectedNodeId(node.nodeId);
                }}
                aria-disabled={locked}
                className={`w-[170px] rounded-lg border px-3 py-2 text-left transition-colors ${
                  active
                    ? 'border-accent/50 bg-accent/10'
                    : locked
                      ? 'cursor-not-allowed border-app-border bg-bg-1 opacity-50'
                      : 'border-app-border bg-bg-1 hover:border-info/30 hover:bg-bg-3'
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[12px] font-semibold text-ink">{index + 1}. {node.title}</span>
                  <NodeStatusBadge status={node.status} />
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-ink-muted">{node.topic}</span>
              </button>
            );
          })}
        </div>
      </div>

      <section className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
        <div
          className="grid h-full min-h-0 min-w-[930px] gap-4"
          style={{ gridTemplateColumns: 'minmax(0, 1fr) 390px' }}
        >
          <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-app-border bg-bg-2">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-app-border px-4 py-3">
              <div>
                <p className="eyebrow">Tutorial</p>
                <h3 className="mt-1 text-[14px] font-semibold text-ink">{selectedVideo.title}</h3>
              </div>
              <Youtube size={18} className="text-danger" />
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-app-border bg-black">
                <iframe
                  key={selectedVideo.videoId}
                  src={buildYoutubeEmbedUrl(selectedVideo.videoId)}
                  title={selectedVideo.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
              <div className="mt-3 grid flex-shrink-0 gap-2 sm:grid-cols-3">
                {selectedContent.videos.map(video => {
                  const watched = nodeProgress.watchedVideoIds.includes(video.id);
                  const selected = selectedVideo.id === video.id;
                  return (
                    <button
                      key={video.id}
                      onClick={() => setSelectedVideoId(video.id)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-danger/40 bg-danger/10'
                          : watched ? 'border-accent/30 bg-accent/10' : 'border-app-border bg-bg-1 hover:border-info/30'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-semibold text-ink capitalize">{video.role}</span>
                        {watched ? <CheckCircle2 size={13} className="text-accent" /> : <PlayCircle size={13} className="text-ink-subtle" />}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-ink-muted">{video.durationHint}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </article>

          <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-app-border bg-bg-2">
            <div className="flex-shrink-0 border-b border-app-border px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Lesson panel</p>
                  <h3 className="mt-1 text-[14px] font-semibold text-ink">{lessonPanel === 'coach' ? 'AI coach' : lessonPanel === 'quiz' ? 'Tutorial quiz' : 'Video info'}</h3>
                </div>
                <span className="tag">{gateLabel}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {(['info', 'quiz', 'coach'] as const).map(panel => (
                  <button
                    key={panel}
                    onClick={() => setLessonPanel(panel)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold capitalize transition-colors ${
                      lessonPanel === panel
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : 'border-app-border bg-bg-1 text-ink-muted hover:text-ink'
                    }`}
                  >
                    {panel}
                  </button>
                ))}
              </div>
            </div>

            {lessonPanel === 'info' && (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="rounded-xl border border-app-border bg-bg-1 p-4">
                  <p className="text-[13px] leading-6 text-ink-muted">{selectedVideo.shortExplanation}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="tag capitalize">{selectedVideo.role}</span>
                    <span className="tag">{selectedVideo.channelHint}</span>
                    <span className="tag">{selectedVideo.durationHint}</span>
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  {selectedVideo.keyIdeas.map((idea, index) => (
                    <div key={idea} className="rounded-lg border border-app-border bg-bg-1 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Idea {index + 1}</p>
                      <p className="mt-1 text-[12px] leading-5 text-ink-muted">{idea}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-warning">Score 100% to unlock practice</p>
                  <p className="mt-2 text-[12px] leading-5 text-ink-muted">
                    Mark the tutorial watched, then pass the quiz. Current quiz: {passedQuizCount}/{selectedVideo.quiz.length} correct.
                  </p>
                </div>
                <div className="mt-4 grid gap-2">
                  <button
                    onClick={() => handleMarkVideo(selectedVideo.id)}
                    disabled={selectedVideoWatched}
                    className="rounded-lg border border-app-border bg-bg-1 px-3 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-accent/40 hover:text-accent disabled:opacity-50"
                  >
                    {selectedVideoWatched ? 'Tutorial watched' : 'Mark tutorial watched'}
                  </button>
                  <button
                    onClick={() => setLessonPanel('quiz')}
                    className="rounded-lg bg-danger px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-danger/85"
                  >
                    Take quiz
                  </button>
                  <button
                    onClick={() => {
                      setLessonPanel('coach');
                      sendPathCoachPrompt('Explain this tutorial in 4 short bullets for a beginner.');
                    }}
                    className="rounded-lg border border-app-border bg-bg-1 px-3 py-2 text-[12px] font-semibold text-ink transition-colors hover:border-info/40 hover:text-info"
                  >
                    Ask AI to explain
                  </button>
                </div>
              </div>
            )}

            {lessonPanel === 'quiz' && (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="mb-3 rounded-xl border border-app-border bg-bg-1 p-3">
                  <p className="text-[12px] font-semibold text-ink">{answeredQuizCount}/{selectedVideo.quiz.length} answered · {passedQuizCount}/{selectedVideo.quiz.length} correct</p>
                </div>
                <div className="space-y-3">
                  {selectedVideo.quiz.map((question, questionIndex) => {
                    const attempt = nodeProgress.exerciseAttempts[question.id];
                    const answered = typeof attempt?.score === 'number';
                    const correct = (attempt?.score ?? 0) >= 80;
                    return (
                      <div key={question.id} className="rounded-xl border border-app-border bg-bg-1 p-3">
                        <p className="text-[13px] font-semibold leading-5 text-ink">{questionIndex + 1}. {question.question}</p>
                        <div className="mt-2 grid gap-2">
                          {question.choices.map((choice, choiceIndex) => (
                            <button
                              key={choice}
                              onClick={() => handleAnswerQuiz(question.id, choiceIndex, question.correctIndex)}
                              className={`rounded-lg border px-3 py-2 text-left text-[12px] leading-5 transition-colors ${
                                correct && choiceIndex === question.correctIndex
                                  ? 'border-accent/40 bg-accent/10 text-accent'
                                  : 'border-app-border bg-bg-2 text-ink-muted hover:border-info/40 hover:text-info'
                              }`}
                            >
                              {choice}
                            </button>
                          ))}
                        </div>
                        {answered && (
                          <p className={`mt-2 text-[11px] leading-5 ${correct ? 'text-accent' : 'text-warning'}`}>
                            {correct ? 'Correct. ' : 'Try again. '}{question.explanation}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-2">
                  <button
                    onClick={handleCompleteLearning}
                    disabled={!canCompleteLearning}
                    className="rounded-lg bg-info px-3 py-2 text-[12px] font-semibold text-bg-0 transition-colors hover:bg-info/85 disabled:opacity-45"
                  >
                    Save quiz result
                  </button>
                  <button
                    onClick={handleStartPractice}
                    className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
                      canPracticeSelectedVideo
                        ? 'bg-accent text-bg-0 hover:bg-accent/85'
                        : 'border border-app-border bg-bg-1 text-ink-muted hover:border-warning/40 hover:text-warning'
                    }`}
                  >
                    {canPracticeSelectedVideo ? 'Start practice mission' : gateLabel}
                  </button>
                </div>
              </div>
            )}

            {lessonPanel === 'coach' && (
              <div className="flex min-h-0 flex-1 flex-col p-3">
                <div className="mb-2 grid flex-shrink-0 gap-2">
                  <button onClick={() => sendPathCoachPrompt('Explain this tutorial in 4 short bullets for a beginner.')} className="rounded-lg border border-app-border bg-bg-1 px-3 py-2 text-left text-[12px] font-semibold text-ink transition-colors hover:border-info/40 hover:text-info">Explain shortly</button>
                  <button onClick={() => sendPathCoachPrompt('Ask me one Socratic question to check whether I understood the tutorial.')} className="rounded-lg border border-app-border bg-bg-1 px-3 py-2 text-left text-[12px] font-semibold text-ink transition-colors hover:border-info/40 hover:text-info">Test my understanding</button>
                </div>
                <div className="min-h-0 flex-1">
                  <ChatWindow
                    sessionId={`${tutorSessionId}_path_${selectedNode.nodeId}`}
                    queuedPrompt={pathCoachPrompt}
                    onQueuedPromptSent={() => setPathCoachPrompt('')}
                  />
                </div>
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}

function PathStepCard({
  active,
  done,
  step,
  title,
  text,
}: {
  active: boolean;
  done: boolean;
  step: string;
  title: string;
  text: string;
}) {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${
      done
        ? 'border-accent/30 bg-accent/10'
        : active ? 'border-info/40 bg-info/10' : 'border-app-border bg-bg-1'
    }`}>
      <div className="flex items-start gap-3">
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[12px] font-semibold ${
          done ? 'bg-accent text-bg-0' : active ? 'bg-info text-bg-0' : 'bg-bg-3 text-ink-muted'
        }`}>
          {done ? <CheckCircle2 size={14} /> : step}
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] font-semibold text-ink">{title}</span>
          <span className="mt-1 block text-[11px] leading-4 text-ink-muted">{text}</span>
        </span>
      </div>
    </div>
  );
}

function NodeStatusBadge({ status }: { status: ProgressStatus }) {
  const className = status === 'COMPLETED'
    ? 'bg-accent/10 text-accent'
    : status === 'ACTIVE'
      ? 'bg-info/10 text-info'
      : 'bg-bg-3 text-ink-subtle';
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold lowercase ${className}`}>
      {status.toLowerCase()}
    </span>
  );
}

function SmartPlanContent({
  headline,
  summary,
  steps,
  onStart,
}: {
  headline: string;
  summary: string;
  steps: Array<{ id: string; label: string; title: string; reason: string; minutes: number; topic: string; mode: PracticeMode }>;
  onStart: (topic: string, mode: PracticeMode) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Personal coach</p>
        <h3 className="mt-1.5 text-[18px] font-semibold tracking-[-0.02em] text-ink">{headline}</h3>
        <p className="mt-2 text-[13px] leading-6 text-ink-muted">{summary}</p>
      </div>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <article key={step.id} className="rounded-xl border border-app-border bg-bg-2 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-accent/10 text-[12px] font-semibold text-accent">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow">{step.label} · {step.minutes} min</p>
                <p className="mt-1 text-[13px] font-semibold text-ink">{step.title}</p>
                <p className="mt-1.5 text-[12px] leading-6 text-ink-muted">{step.reason}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <span className="tag">{step.topic}</span>
                  <span className="tag capitalize">{step.mode.toLowerCase().replace(/_/g, ' ')}</span>
                  <button
                    onClick={() => onStart(step.topic, step.mode)}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-bg-0 transition-colors hover:bg-accent/85"
                  >
                    Start
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function HistoryDrawerContent({ learningState, summary }: {
  learningState: LearningState;
  summary: ReturnType<typeof getLearningSummary>;
}) {
  const attempts = learningState.attempts.slice(-20).reverse();
  if (!attempts.length) {
    return <p className="text-[13px] text-ink-muted">No attempts yet. Solve a challenge to build history.</p>;
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Attempts" value={`${summary.attempts}`} />
        <MiniStat label="Solved" value={`${summary.correctRate}%`} />
        <MiniStat label="Avg hints" value={`${summary.avgHintLevel}`} />
      </div>
      <div className="space-y-2">
        {attempts.map(attempt => (
          <article
            key={`${attempt.challengeId}-${attempt.timestamp}`}
            className="rounded-xl border border-app-border bg-bg-2 px-3 py-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-ink">{attempt.bugPattern}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {attempt.categories.map(categoryLabel).join(', ')} · {attempt.difficulty.toLowerCase()}
                </p>
              </div>
              <VerdictBadge verdict={attempt.verdict} />
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-ink-subtle">
              <span>{attempt.durationSec}s</span>
              <span>{attempt.hintLevel}/3 hints</span>
              <span>{attempt.attemptsOnChallenge} try</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PortfolioDrawerContent({ learningState }: { learningState: LearningState }) {
  const wins = learningState.attempts.filter(a => a.verdict === 'CORRECT').slice(-20).reverse();
  if (!wins.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-app-border bg-bg-2 p-8 text-center">
        <FolderOpen size={22} className="text-accent" />
        <p className="text-[13px] font-medium text-ink">No saved wins yet</p>
        <p className="max-w-xs text-[12px] leading-5 text-ink-muted">
          Solved bugs land here as a learner-facing history of patterns you've fixed.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {wins.map(attempt => (
        <article
          key={`${attempt.challengeId}-${attempt.timestamp}`}
          className="rounded-xl border border-app-border bg-bg-2 px-3 py-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-ink">{attempt.bugPattern}</p>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {attempt.categories.map(categoryLabel).join(', ')} · {attempt.difficulty.toLowerCase()}
              </p>
            </div>
            <VerdictBadge verdict="CORRECT" />
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <MiniStat label="Time" value={`${attempt.durationSec}s`} />
            <MiniStat label="Hints" value={`${attempt.hintLevel}/3`} />
            <MiniStat label="Tries" value={`${attempt.attemptsOnChallenge}`} />
          </div>
        </article>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Small primitives
// ──────────────────────────────────────────────────────────────────────────

type Tone = 'accent' | 'warning' | 'danger' | 'info';
const TONE_BG: Record<Tone, string> = {
  accent:  'bg-accent/10 text-accent',
  warning: 'bg-warning/10 text-warning',
  danger:  'bg-danger/10 text-danger',
  info:    'bg-info/10 text-info',
};

function Pill({ icon, children, tone, title }: { icon: ReactNode; children: ReactNode; tone: Tone; title?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${TONE_BG[tone]}`}
      title={title}
    >
      {icon}{children}
    </span>
  );
}

function IconButton({ children, onClick, title }: { children: ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-bg-2 hover:text-ink"
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-bg-0 px-2.5 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-subtle">{label}</p>
      <p className="mt-0.5 text-[13px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function SettingsDrawerContent() {
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    let active = true;
    void getMyPrivacy()
      .then(value => { if (active) setPrivacy(value); })
      .catch(error => toast.error(getApiErrorMessage(error, 'Could not load privacy settings.')))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const toggleOptIn = async () => {
    if (!privacy || saving) return;
    const next = { tutorMessagesOptIn: !privacy.tutorMessagesOptIn };
    setSaving(true);
    try {
      const updated = await updateMyPrivacy(next);
      setPrivacy(updated);
      toast.success(updated.tutorMessagesOptIn
        ? 'Tutor transcripts will be saved.'
        : 'Tutor transcripts will not be saved.');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not update privacy.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <section>
        <div className="mb-2 flex items-center gap-2 eyebrow">
          <Shield size={11} /> Privacy
        </div>
        <div className="rounded-xl border border-app-border bg-bg-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">Save tutor transcripts</p>
              <p className="mt-1 text-[12px] leading-5 text-ink-muted">
                When on, your coach conversations are saved (encrypted at rest, pruned after 90 days)
                so teachers in your classroom can see them in the deep-dive view. When off, your tutor
                still works live but nothing is stored long-term.
              </p>
            </div>
            <button
              onClick={toggleOptIn}
              disabled={loading || saving || !privacy}
              aria-pressed={privacy?.tutorMessagesOptIn ?? false}
              className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                privacy?.tutorMessagesOptIn ? 'bg-accent' : 'bg-bg-3'
              } disabled:opacity-50`}
              title={privacy?.tutorMessagesOptIn ? 'On — tap to opt out' : 'Off — tap to opt in'}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg-0 shadow transition-transform ${
                  privacy?.tutorMessagesOptIn ? 'translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center gap-2 eyebrow">
          <Shield size={11} /> About data retention
        </div>
        <div className="rounded-xl border border-app-border bg-bg-2 p-4 text-[12px] leading-5 text-ink-muted">
          Tutor messages older than 90 days are pruned automatically. Your challenge attempts and
          mastery progress are kept while your account exists. Closing your account is not yet
          available from the UI — contact your administrator.
        </div>
      </section>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: 'CORRECT' | 'PARTIAL' | 'WRONG' }) {
  const tone: Tone = verdict === 'CORRECT' ? 'accent' : verdict === 'PARTIAL' ? 'warning' : 'danger';
  return <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${TONE_BG[tone]}`}>{verdict}</span>;
}

// ──────────────────────────────────────────────────────────────────────────
// Empty + loading states
// ──────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <RefreshCw size={20} className="animate-spin" />
      </div>
      <div>
        <p className="text-[18px] font-semibold tracking-[-0.02em] text-ink">Building your mission…</p>
        <p className="mt-1.5 text-[13px] leading-6 text-ink-muted">
          Picking a bug tailored to your level, weak spots, and practice mode.
        </p>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <span key={i} className="h-1 w-10 overflow-hidden rounded-full bg-bg-2">
            <span className="block h-full w-full shimmer rounded-full" style={{ animationDelay: `${i * 0.2}s` }} />
          </span>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto flex h-full max-w-md flex-col items-center justify-center gap-5 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Code2 size={22} />
      </div>
      <div>
        <p className="text-[20px] font-semibold tracking-[-0.02em] text-ink">Ready to train?</p>
        <p className="mt-1.5 text-[13px] leading-6 text-ink-muted">
          Get a real debugging exercise with adaptive hints and a Socratic coach.
        </p>
      </div>
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-0 transition-colors hover:bg-accent/85"
      >
        <Sparkles size={14} />
        Start first mission
      </button>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Persistence helpers
// ──────────────────────────────────────────────────────────────────────────

function restoreChallenge(playerId: string): Challenge | null {
  const saved = sessionStorage.getItem(`codequest_challenge_${playerId}`);
  if (!saved) return null;
  try {
    const parsed = JSON.parse(saved) as Partial<Challenge>;
    if (!parsed.id || !parsed.topic || !parsed.programmingLanguage || !parsed.buggyCode) return null;
    return {
      ...parsed,
      difficulty: parsed.difficulty ?? 'BEGINNER',
      practiceMode: parsed.practiceMode ?? 'BUG_HUNT',
      hint: parsed.hint ?? '',
      xpReward: parsed.xpReward ?? 100,
      missionBrief: parsed.missionBrief ?? '',
      successCriteria: parsed.successCriteria ?? '',
      reflectionPrompt: parsed.reflectionPrompt ?? '',
    } as Challenge;
  } catch {
    return null;
  }
}

async function loadPlayerLearningState(playerId: string): Promise<LearningState> {
  try {
    return await getLearningState(playerId);
  } catch {
    return loadLearningState(playerId);
  }
}

function formatRelativeDue(iso: string): string {
  const dueMs = new Date(iso).getTime();
  if (Number.isNaN(dueMs)) return '';
  const diff = dueMs - Date.now();
  const abs = Math.abs(diff);
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  const past = diff < 0;
  if (abs >= day) {
    const days = Math.round(abs / day);
    return past ? `${days}d ago` : `in ${days}d`;
  }
  if (abs >= hour) {
    const hours = Math.round(abs / hour);
    return past ? `${hours}h ago` : `in ${hours}h`;
  }
  const minutes = Math.max(1, Math.round(abs / 60000));
  return past ? `${minutes}m ago` : `in ${minutes}m`;
}
