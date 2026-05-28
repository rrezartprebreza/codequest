import type { Challenge, PlayerLevel, PracticeMode, Verdict } from './api';

const LEVELS: PlayerLevel[] = ['BEGINNER', 'INTERMEDIATE', 'SENIOR', 'MASTER'];
const MAX_ATTEMPTS = 200;
const MAX_FINGERPRINTS = 300;

const CATEGORY_LABELS: Record<string, string> = {
  conditionals: 'Conditionals',
  loops: 'Loops',
  arrays: 'Arrays',
  recursion: 'Recursion',
  strings: 'Strings',
  async: 'Async',
  null_safety: 'Null safety',
  sql: 'SQL',
  oop: 'OOP',
  functions: 'Functions',
  general: 'General debugging',
};

export interface AttemptRecord {
  challengeId: string;
  timestamp: number;
  categories: string[];
  bugPattern: string;
  verdict: Verdict;
  hintLevel: number;
  attemptsOnChallenge: number;
  helpUsed: string[];
  submissionChars: number;
  durationSec: number;
  difficulty: PlayerLevel;
  fingerprint: string;
}

export interface CategoryStat {
  attempts: number;
  correct: number;
  partial: number;
  wrong: number;
  confidence: number;
  nextReviewAt: number;
  lastSeenAt: number;
}

export interface LearningState {
  attempts: AttemptRecord[];
  categoryStats: Record<string, CategoryStat>;
  seenFingerprints: string[];
}

export interface LearningSummary {
  attempts: number;
  correctRate: number;
  partialRate: number;
  wrongRate: number;
  avgDurationSec: number;
  avgHintLevel: number;
  dueReviews: number;
}

export interface SkillInsight {
  category: string;
  label: string;
  confidence: number;
  attempts: number;
  status: 'New' | 'Needs practice' | 'Growing' | 'Strong';
  priority: number;
  nextAction: string;
}

export interface EvaluationEvent {
  challenge: Challenge;
  verdict: Verdict;
  hintLevel: number;
  attemptsOnChallenge: number;
  helpUsed: string[];
  submissionChars: number;
  durationSec: number;
}

export interface RubricItem {
  key: string;
  label: string;
  score: number;
}

export interface ReviewPlan {
  categories: string[];
  topic: string;
  reason: string;
}

export interface SmartLearningStep {
  id: 'warmup' | 'main' | 'reflect';
  label: string;
  title: string;
  reason: string;
  topic: string;
  practiceMode: PracticeMode;
  estimatedMinutes: number;
}

export interface SmartLearningPlan {
  headline: string;
  summary: string;
  primaryTopic: string;
  primaryMode: PracticeMode;
  confidenceLabel: string;
  steps: SmartLearningStep[];
}

export interface PostSolveRecap {
  pattern: string;
  rule: string;
  reflection: string;
  practicePrompt: string;
}

const EMPTY_STATE: LearningState = {
  attempts: [],
  categoryStats: {},
  seenFingerprints: [],
};

export function emptyLearningState(): LearningState {
  return {
    attempts: [],
    categoryStats: {},
    seenFingerprints: [],
  };
}

export const getLearningStorageKey = (playerId: string) => `codequest_learning_${playerId}`;

export function loadLearningState(playerId: string): LearningState {
  const raw = localStorage.getItem(getLearningStorageKey(playerId));
  if (!raw) return emptyLearningState();
  try {
    const parsed = JSON.parse(raw) as LearningState;
    if (!parsed || !Array.isArray(parsed.attempts) || !parsed.categoryStats || !Array.isArray(parsed.seenFingerprints)) {
      return emptyLearningState();
    }
    return parsed;
  } catch {
    return emptyLearningState();
  }
}

export function saveLearningState(playerId: string, state: LearningState) {
  localStorage.setItem(getLearningStorageKey(playerId), JSON.stringify(state));
}

export function getChallengeFingerprint(code: string): string {
  return code.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function hasSeenChallengeFingerprint(state: LearningState, challenge: Challenge): boolean {
  const fingerprint = getChallengeFingerprint(challenge.buggyCode);
  return state.seenFingerprints.includes(fingerprint);
}

export function inferCategories(challenge: Challenge): string[] {
  const text = `${challenge.topic} ${challenge.buggyCode}`.toLowerCase();
  const categories: string[] = [];

  const check = (regex: RegExp, category: string) => {
    if (regex.test(text)) categories.push(category);
  };

  check(/\bif\b|\belse\b|\bboolean\b|\bcondition\b|\blogic\b/, 'conditionals');
  check(/\bfor\b|\bwhile\b|\bloop\b/, 'loops');
  check(/\barray\b|\blist\b|\bindex\b|\bmap\b/, 'arrays');
  check(/\brecursion\b|\brecursive\b|\bbase case\b|\bcall stack\b/, 'recursion');
  check(/\bstring\b|\bchar\b|\bsubstring\b|\bconcat\b/, 'strings');
  check(/\basync\b|\bawait\b|\bpromise\b|\bcallback\b/, 'async');
  check(/\bnull\b|\bundefined\b|\boptional\b|\bnil\b/, 'null_safety');
  check(/\bsql\b|\bquery\b|\bjoin\b|\bselect\b|\bwhere\b/, 'sql');
  check(/\bclass\b|\bobject\b|\bconstructor\b|\bmethod\b/, 'oop');
  check(/\bfunction\b|\breturn\b|\bargument\b|\bparameter\b/, 'functions');

  return categories.length ? categories.slice(0, 3) : ['general'];
}

export function inferBugPattern(challenge: Challenge): string {
  const text = `${challenge.topic} ${challenge.buggyCode}`.toLowerCase();
  if (/\b<=\b|\b>=\b|\bindex\b|\blength\b|\bsize\b|\barray\b|\blist\b/.test(text)) return 'Boundary or index bug';
  if (/\bif\b|\belse\b|\bboolean\b|\bcondition\b|\b&&\b|\b\|\|\b/.test(text)) return 'Incorrect condition';
  if (/\bnull\b|\bundefined\b|\boptional\b|\bnil\b|none\b/.test(text)) return 'Missing empty-value guard';
  if (/\breturn\b|\bfunction\b|\bmethod\b/.test(text)) return 'Wrong return behavior';
  if (/\basync\b|\bawait\b|\bpromise\b|\bcallback\b/.test(text)) return 'Async ordering bug';
  if (/\bstring\b|\bsubstring\b|\btrim\b|\blower\b|\bupper\b/.test(text)) return 'String handling bug';
  return 'General logic bug';
}

export function updateLearningState(state: LearningState, event: EvaluationEvent): LearningState {
  const now = Date.now();
  const categories = inferCategories(event.challenge);
  const bugPattern = inferBugPattern(event.challenge);
  const fingerprint = getChallengeFingerprint(event.challenge.buggyCode);

  const record: AttemptRecord = {
    challengeId: event.challenge.id,
    timestamp: now,
    categories,
    bugPattern,
    verdict: event.verdict,
    hintLevel: event.hintLevel,
    attemptsOnChallenge: event.attemptsOnChallenge,
    helpUsed: event.helpUsed,
    submissionChars: event.submissionChars,
    durationSec: event.durationSec,
    difficulty: event.challenge.difficulty,
    fingerprint,
  };

  const nextAttempts = [...state.attempts, record].slice(-MAX_ATTEMPTS);
  const nextFingerprints = [...state.seenFingerprints, fingerprint].slice(-MAX_FINGERPRINTS);
  const nextCategoryStats = { ...state.categoryStats };

  const attemptScore = scoreAttempt(event.verdict, event.hintLevel, event.durationSec);
  for (const category of categories) {
    const prev = nextCategoryStats[category] ?? {
      attempts: 0,
      correct: 0,
      partial: 0,
      wrong: 0,
      confidence: 0.5,
      nextReviewAt: now,
      lastSeenAt: now,
    };

    const next: CategoryStat = {
      ...prev,
      attempts: prev.attempts + 1,
      correct: prev.correct + (event.verdict === 'CORRECT' ? 1 : 0),
      partial: prev.partial + (event.verdict === 'PARTIAL' ? 1 : 0),
      wrong: prev.wrong + (event.verdict === 'WRONG' ? 1 : 0),
      confidence: clamp01(prev.confidence * 0.75 + attemptScore * 0.25),
      nextReviewAt: now + reviewIntervalMs(event.verdict, event.hintLevel, event.attemptsOnChallenge),
      lastSeenAt: now,
    };
    nextCategoryStats[category] = next;
  }

  return {
    attempts: nextAttempts,
    categoryStats: nextCategoryStats,
    seenFingerprints: nextFingerprints,
  };
}

export function suggestDifficulty(baseLevel: PlayerLevel, state: LearningState): PlayerLevel {
  const recent = state.attempts.slice(-6);
  if (recent.length < 3) return baseLevel;

  const correctLowHint = recent.filter(item => item.verdict === 'CORRECT' && item.hintLevel <= 1).length;
  const wrongCount = recent.filter(item => item.verdict === 'WRONG').length;

  const recentConfidence = average(
    recent.flatMap(item => item.categories)
      .map(category => state.categoryStats[category]?.confidence ?? 0.5)
  );

  if (correctLowHint >= 4 && wrongCount === 0 && recentConfidence > 0.72) {
    return shiftLevel(baseLevel, 1);
  }
  if (wrongCount >= 3 || recentConfidence < 0.45) {
    return shiftLevel(baseLevel, -1);
  }
  return baseLevel;
}

export function getWeakestCategories(state: LearningState, count = 3): string[] {
  return Object.entries(state.categoryStats)
    .sort((a, b) => a[1].confidence - b[1].confidence)
    .slice(0, count)
    .map(([key]) => key);
}

export function getDueReviewCategories(state: LearningState, count = 3): string[] {
  const now = Date.now();
  return Object.entries(state.categoryStats)
    .filter(([, value]) => value.nextReviewAt <= now)
    .sort((a, b) => a[1].confidence - b[1].confidence)
    .slice(0, count)
    .map(([key]) => key);
}

export function suggestFocusTopic(state: LearningState): string | null {
  const dueCategories = getDueReviewCategories(state, 10);

  const weakest = dueCategories[0] ?? getWeakestCategories(state, 1)[0];
  if (!weakest) return null;
  return CATEGORY_LABELS[weakest] ?? weakest;
}

export function buildReviewPlan(state: LearningState): ReviewPlan | null {
  const categories = getDueReviewCategories(state, 3);
  const targetCategories = categories.length ? categories : getWeakestCategories(state, 3);
  if (!targetCategories.length) return null;

  const topic = targetCategories.map(categoryLabel).join(', ');
  const primary = targetCategories[0];
  const stats = state.categoryStats[primary];
  const reason = stats
    ? `${categoryLabel(primary)} needs review: ${Math.round(stats.confidence * 100)}% confidence after ${stats.attempts} attempt${stats.attempts === 1 ? '' : 's'}.`
    : `Practice ${categoryLabel(primary)} before moving on.`;

  return {
    categories: targetCategories,
    topic,
    reason,
  };
}

export function buildSmartLearningPlan(
  state: LearningState,
  baseLevel: PlayerLevel,
  selectedPracticeMode: PracticeMode
): SmartLearningPlan {
  const summary = getLearningSummary(state);
  const reviewPlan = buildReviewPlan(state);
  const insights = getSkillInsights(state, 4);
  const primaryInsight = insights[0];
  const primaryCategory = reviewPlan?.categories[0] ?? primaryInsight?.category ?? 'loops';
  const secondaryCategory = reviewPlan?.categories[1] ?? insights.find(item => item.category !== primaryCategory)?.category ?? 'arrays';
  const primaryTopic = categoryLabel(primaryCategory);
  const secondaryTopic = categoryLabel(secondaryCategory);
  const primaryMode = smartModeForCategory(primaryCategory, selectedPracticeMode);
  const secondaryMode = smartModeForCategory(secondaryCategory, primaryMode);

  if (summary.attempts === 0) {
    return {
      headline: 'Start with a clean baseline',
      summary: 'CodeQuest will learn from the first few attempts, then adapt difficulty, topic, and hint depth automatically.',
      primaryTopic: 'Loops',
      primaryMode: 'OUTPUT_TRACING',
      confidenceLabel: levelLabel(baseLevel),
      steps: [
        {
          id: 'warmup',
          label: 'Warm up',
          title: 'Trace one loop boundary',
          reason: 'A short trace gives the engine its first signal without overwhelming the learner.',
          topic: 'Loops',
          practiceMode: 'OUTPUT_TRACING',
          estimatedMinutes: 5,
        },
        {
          id: 'main',
          label: 'Main challenge',
          title: 'Fix one array edge case',
          reason: 'Arrays and boundaries are common early debugging patterns.',
          topic: 'Arrays',
          practiceMode: 'EDGE_CASE_RESCUE',
          estimatedMinutes: 10,
        },
        {
          id: 'reflect',
          label: 'Reflect',
          title: 'Name the missed input',
          reason: 'Reflection turns one solved bug into a reusable debugging habit.',
          topic: 'General debugging',
          practiceMode: 'BUG_HUNT',
          estimatedMinutes: 3,
        },
      ],
    };
  }

  const confidence = primaryInsight?.confidence ?? Math.round((1 - summary.wrongRate / 100) * 100);
  const hintSignal = summary.avgHintLevel >= 1.5
    ? `Average hint depth is ${summary.avgHintLevel}/3, so the next task should be guided.`
    : 'Hint usage is low enough to increase independence carefully.';
  const reviewSignal = summary.dueReviews > 0
    ? `${summary.dueReviews} skill${summary.dueReviews === 1 ? '' : 's'} due for review.`
    : 'No urgent review is due, so the plan can stretch difficulty.';

  return {
    headline: `${primaryTopic} is the next best move`,
    summary: `${reviewPlan?.reason ?? primaryInsight?.nextAction ?? 'The plan is based on recent attempts.'} ${hintSignal} ${reviewSignal}`,
    primaryTopic,
    primaryMode,
    confidenceLabel: `${confidence}% confidence`,
    steps: [
      {
        id: 'warmup',
        label: 'Warm up',
        title: `Trace ${primaryTopic.toLowerCase()} slowly`,
        reason: `Start with a small ${primaryTopic.toLowerCase()} case before editing code.`,
        topic: primaryTopic,
        practiceMode: primaryMode === 'TEST_FIRST' ? 'OUTPUT_TRACING' : primaryMode,
        estimatedMinutes: 5,
      },
      {
        id: 'main',
        label: 'Main challenge',
        title: `Solve ${secondaryTopic.toLowerCase()} with one hint max`,
        reason: `The next challenge mixes the weak area with ${secondaryTopic.toLowerCase()} to build transfer.`,
        topic: secondaryTopic,
        practiceMode: secondaryMode,
        estimatedMinutes: 12,
      },
      {
        id: 'reflect',
        label: 'Reflect',
        title: 'Write the bug pattern you missed',
        reason: 'This saves a memory students can reuse before the next challenge.',
        topic: primaryTopic,
        practiceMode: 'BUG_HUNT',
        estimatedMinutes: 3,
      },
    ],
  };
}

export function getSkillInsights(state: LearningState, count = 6): SkillInsight[] {
  const coreCategories = ['loops', 'arrays', 'recursion', 'async', 'oop', 'sql', 'conditionals', 'functions', 'general'];
  const knownCategories = Array.from(new Set([
    ...Object.keys(state.categoryStats),
    ...coreCategories,
  ]));

  return knownCategories
    .map(category => {
      const stat = state.categoryStats[category];
      const confidence = stat ? Math.round(stat.confidence * 100) : 0;
      const attempts = stat?.attempts ?? 0;
      const due = stat ? stat.nextReviewAt <= Date.now() : true;
      const priority = skillPriority(confidence, attempts, due);

      return {
        category,
        label: categoryLabel(category),
        confidence,
        attempts,
        status: skillStatus(confidence, attempts),
        priority,
        nextAction: skillNextAction(category, confidence, attempts, due),
      };
    })
    .sort((a, b) => b.priority - a.priority || a.confidence - b.confidence || a.label.localeCompare(b.label))
    .slice(0, count);
}

export function buildChallengeReason(state: LearningState, challenge: Challenge, explicitTopic?: string): string {
  if (explicitTopic?.trim()) {
    return `Focused practice: ${explicitTopic.trim()}.`;
  }

  const categories = inferCategories(challenge);
  const weakest = getWeakestCategories(state, 5);
  const overlap = categories.find(category => weakest.includes(category));
  if (overlap) {
    const stat = state.categoryStats[overlap];
    return stat
      ? `Practicing ${categoryLabel(overlap)} because your confidence is ${Math.round(stat.confidence * 100)}%.`
      : `Practicing ${categoryLabel(overlap)} based on your recent attempts.`;
  }

  const due = getDueReviewCategories(state, 1)[0];
  if (due) {
    return `Review is due for ${categoryLabel(due)}.`;
  }

  return `This challenge builds ${categories.map(categoryLabel).join(', ')} debugging skill.`;
}

function skillPriority(confidence: number, attempts: number, due: boolean): number {
  if (attempts === 0) return 70;
  const weakness = 100 - confidence;
  const dueBoost = due ? 28 : 0;
  const evidenceBoost = Math.min(attempts * 4, 18);
  return weakness + dueBoost + evidenceBoost;
}

function skillStatus(confidence: number, attempts: number): SkillInsight['status'] {
  if (attempts === 0) return 'New';
  if (confidence < 50) return 'Needs practice';
  if (confidence < 78) return 'Growing';
  return 'Strong';
}

function skillNextAction(category: string, confidence: number, attempts: number, due: boolean): string {
  const label = categoryLabel(category).toLowerCase();
  if (attempts === 0) return `Try one ${label} mission to establish a baseline.`;
  if (confidence < 50) return `Slow down and trace one failing ${label} case before editing.`;
  if (due) return `Do a short review mission to keep ${label} fresh.`;
  if (confidence < 78) return `Solve one more ${label} challenge with at most one hint.`;
  return `Increase difficulty or mix ${label} with another skill.`;
}

function smartModeForCategory(category: string, fallback: PracticeMode): PracticeMode {
  switch (category) {
    case 'arrays':
    case 'loops':
    case 'conditionals':
      return 'OUTPUT_TRACING';
    case 'null_safety':
    case 'strings':
    case 'async':
      return 'EDGE_CASE_RESCUE';
    case 'functions':
    case 'oop':
    case 'sql':
      return 'TEST_FIRST';
    default:
      return fallback || 'BUG_HUNT';
  }
}

function levelLabel(level: PlayerLevel): string {
  switch (level) {
    case 'BEGINNER':
      return 'baseline mode';
    case 'INTERMEDIATE':
      return 'intermediate pace';
    case 'SENIOR':
      return 'advanced pace';
    case 'MASTER':
      return 'mastery pace';
    default:
      return 'adaptive pace';
  }
}

export function buildPostSolveRecap(challenge: Challenge, hintLevel: number, attemptsOnChallenge: number): PostSolveRecap {
  const pattern = inferBugPattern(challenge);
  const categories = inferCategories(challenge).map(categoryLabel).join(', ');
  const effort = attemptsOnChallenge <= 1
    ? 'You solved it without needing repeated retries.'
    : `You solved it after ${attemptsOnChallenge} attempts, which is useful signal for review.`;

  return {
    pattern,
    rule: ruleForPattern(pattern),
    reflection: `${effort} Main skill: ${categories}. Hint depth used: ${hintLevel}/3.`,
    practicePrompt: practicePromptForPattern(pattern, challenge.programmingLanguage),
  };
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category;
}

export function validateSubmissionInput(solution: string, buggyCode: string): string | null {
  const normalizedSolution = normalizeForCompare(solution);
  const normalizedBuggy = normalizeForCompare(buggyCode);

  if (!normalizedSolution) return 'Write your solution first.';
  if (normalizedSolution.length < 8) return 'Solution is too short. Add a real fix.';
  if (normalizedSolution === normalizedBuggy) return 'Your fix matches the buggy code. Change the logic first.';
  if (!/[a-zA-Z]/.test(normalizedSolution)) return 'Use valid code text, not only symbols.';
  return null;
}

export function buildEvaluationRubric(
  verdict: Verdict,
  solution: string,
  buggyCode: string,
  hintLevel: number
): RubricItem[] {
  const normalizedSolution = normalizeForCompare(solution);
  const normalizedBuggy = normalizeForCompare(buggyCode);
  const changedRatio = changedTokenRatio(normalizedBuggy, normalizedSolution);

  const correctness = verdict === 'CORRECT' ? 100 : verdict === 'PARTIAL' ? 65 : 35;
  const bugIsolation = clampScore(40 + changedRatio * 45 + (verdict === 'CORRECT' ? 15 : 0));
  const codeQuality = clampScore(45 + Math.min(solution.length / 8, 35) - hintLevel * 6);
  const edgeCases = clampScore(30 + edgeCaseSignal(solution) * 12 + (verdict === 'CORRECT' ? 20 : 0));

  return [
    { key: 'correctness', label: 'Correctness', score: correctness },
    { key: 'bug-isolation', label: 'Bug isolation', score: bugIsolation },
    { key: 'code-quality', label: 'Code quality', score: codeQuality },
    { key: 'edge-cases', label: 'Edge cases', score: edgeCases },
  ];
}

export function getLearningSummary(state: LearningState): LearningSummary {
  const attempts = state.attempts.length;
  if (!attempts) {
    return {
      attempts: 0,
      correctRate: 0,
      partialRate: 0,
      wrongRate: 0,
      avgDurationSec: 0,
      avgHintLevel: 0,
      dueReviews: 0,
    };
  }

  const correct = state.attempts.filter(item => item.verdict === 'CORRECT').length;
  const partial = state.attempts.filter(item => item.verdict === 'PARTIAL').length;
  const wrong = state.attempts.filter(item => item.verdict === 'WRONG').length;
  const avgDurationSec = Math.round(state.attempts.reduce((sum, item) => sum + item.durationSec, 0) / attempts);
  const avgHintLevel = Number((state.attempts.reduce((sum, item) => sum + item.hintLevel, 0) / attempts).toFixed(1));
  const dueReviews = getDueReviewCategories(state, 999).length;

  return {
    attempts,
    correctRate: Math.round((correct / attempts) * 100),
    partialRate: Math.round((partial / attempts) * 100),
    wrongRate: Math.round((wrong / attempts) * 100),
    avgDurationSec,
    avgHintLevel,
    dueReviews,
  };
}

function scoreAttempt(verdict: Verdict, hintLevel: number, durationSec: number): number {
  const verdictScore = verdict === 'CORRECT' ? 1 : verdict === 'PARTIAL' ? 0.62 : 0.25;
  const hintPenalty = hintLevel * 0.12;
  const durationPenalty = durationSec > 900 ? 0.12 : durationSec > 600 ? 0.08 : 0;
  return clamp01(verdictScore - hintPenalty - durationPenalty);
}

function reviewIntervalMs(verdict: Verdict, hintLevel: number, attemptsOnChallenge: number): number {
  const day = 24 * 60 * 60 * 1000;
  if (attemptsOnChallenge >= 3) return day;
  if (verdict === 'WRONG') return day;
  if (verdict === 'PARTIAL') return 3 * day;
  return hintLevel >= 2 ? 4 * day : 7 * day;
}

function ruleForPattern(pattern: string): string {
  switch (pattern) {
    case 'Boundary or index bug':
      return 'Trace the first, last, and empty input before changing loop boundaries.';
    case 'Incorrect condition':
      return 'Translate each condition branch into plain English and test one true case plus one false case.';
    case 'Missing empty-value guard':
      return 'Validate missing or empty inputs before accessing properties, methods, or indexes.';
    case 'Wrong return behavior':
      return 'Check that the function returns the computed value from the right branch and at the right time.';
    case 'Async ordering bug':
      return 'Separate promises from resolved values and wait for data before using it.';
    case 'String handling bug':
      return 'Normalize, slice, and compare strings deliberately; edge cases usually live at boundaries.';
    default:
      return 'Use one small failing input to find where actual behavior diverges from expected behavior.';
  }
}

function practicePromptForPattern(pattern: string, language: string): string {
  switch (pattern) {
    case 'Boundary or index bug':
      return `Create one ${language} test with an empty collection and one with a single item.`;
    case 'Incorrect condition':
      return `Write two ${language} inputs that should go to opposite branches.`;
    case 'Missing empty-value guard':
      return `Try one valid input and one null/empty input in ${language}.`;
    case 'Wrong return behavior':
      return `Trace the returned value for one normal input and one edge input in ${language}.`;
    case 'Async ordering bug':
      return `Mark each async value as "promise" or "resolved data" before editing.`;
    case 'String handling bug':
      return `Test lowercase, uppercase, extra-space, and empty-string inputs.`;
    default:
      return `Write expected vs actual output for one minimal failing ${language} input.`;
  }
}

function shiftLevel(level: PlayerLevel, delta: number): PlayerLevel {
  const index = Math.max(0, Math.min(LEVELS.length - 1, LEVELS.indexOf(level) + delta));
  return LEVELS[index];
}

function average(values: number[]): number {
  if (!values.length) return 0.5;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function changedTokenRatio(original: string, fixed: string): number {
  if (!original || !fixed) return 0;
  const originalTokens = new Set(original.split(/\W+/).filter(Boolean));
  const fixedTokens = new Set(fixed.split(/\W+/).filter(Boolean));
  if (!originalTokens.size) return 0;
  let changed = 0;
  for (const token of fixedTokens) {
    if (!originalTokens.has(token)) changed += 1;
  }
  return Math.min(changed / Math.max(originalTokens.size, 1), 1);
}

function edgeCaseSignal(solution: string): number {
  const lower = solution.toLowerCase();
  let score = 0;
  if (/if\s*\(/.test(lower)) score += 1;
  if (/null|undefined|none/.test(lower)) score += 1;
  if (/try|catch/.test(lower)) score += 1;
  if (/length|size|count/.test(lower)) score += 1;
  return score;
}

function clampScore(value: number): number {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}
