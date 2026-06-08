import type { ProgressionNode } from './api';
import type { NodeLearningContent } from './pathContent';

export type BranchOutcome = 'advance' | 'deepen' | 'reinforce';

export interface ExerciseAttempt {
  exerciseId: string;
  score: number;
  completedAt: number;
}

export interface NodePathProgress {
  nodeId: string;
  watchedVideoIds: string[];
  exerciseAttempts: Record<string, ExerciseAttempt>;
  lastScore: number | null;
  outcome: BranchOutcome | null;
  attempts: number;
  completedAt: number | null;
}

export interface ReviewCard {
  id: string;
  nodeId: string;
  topic: string;
  prompt: string;
  dueAt: number;
  ease: number;
  intervalDays: number;
  repetitions: number;
  lastQuality: number;
}

export interface PathProgressState {
  nodes: Record<string, NodePathProgress>;
  reviewCards: Record<string, ReviewCard>;
}

export interface CompletionResult {
  score: number;
  outcome: BranchOutcome;
  nextAction: string;
  reviewCardsCreated: number;
}

const EMPTY_STATE: PathProgressState = {
  nodes: {},
  reviewCards: {},
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const getPathProgressStorageKey = (playerId: string) => `codequest_path_progress_${playerId}`;

export function emptyPathProgressState(): PathProgressState {
  return { nodes: {}, reviewCards: {} };
}

export function loadPathProgressState(playerId: string): PathProgressState {
  const raw = localStorage.getItem(getPathProgressStorageKey(playerId));
  if (!raw) return emptyPathProgressState();
  try {
    const parsed = JSON.parse(raw) as PathProgressState;
    if (!parsed || typeof parsed !== 'object' || !parsed.nodes || !parsed.reviewCards) {
      return emptyPathProgressState();
    }
    return {
      nodes: parsed.nodes ?? {},
      reviewCards: parsed.reviewCards ?? {},
    };
  } catch {
    return emptyPathProgressState();
  }
}

export function savePathProgressState(playerId: string, state: PathProgressState) {
  localStorage.setItem(getPathProgressStorageKey(playerId), JSON.stringify(state));
}

export function getNodePathProgress(state: PathProgressState, nodeId: string): NodePathProgress {
  return state.nodes[nodeId] ?? {
    nodeId,
    watchedVideoIds: [],
    exerciseAttempts: {},
    lastScore: null,
    outcome: null,
    attempts: 0,
    completedAt: null,
  };
}

export function markVideoWatched(state: PathProgressState, nodeId: string, videoId: string): PathProgressState {
  const progress = getNodePathProgress(state, nodeId);
  const watchedVideoIds = progress.watchedVideoIds.includes(videoId)
    ? progress.watchedVideoIds
    : [...progress.watchedVideoIds, videoId];

  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: { ...progress, watchedVideoIds },
    },
  };
}

export function scoreExercise(
  state: PathProgressState,
  nodeId: string,
  exerciseId: string,
  score: number,
): PathProgressState {
  const progress = getNodePathProgress(state, nodeId);
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [nodeId]: {
        ...progress,
        exerciseAttempts: {
          ...progress.exerciseAttempts,
          [exerciseId]: {
            exerciseId,
            score: clampScore(score),
            completedAt: Date.now(),
          },
        },
      },
    },
  };
}

export function completeNodeLearningSession(
  state: PathProgressState,
  node: ProgressionNode,
  content: NodeLearningContent,
): { state: PathProgressState; result: CompletionResult } {
  const progress = getNodePathProgress(state, node.nodeId);
  const exerciseIds = content.exercises.map(exercise => exercise.id);
  const scores = exerciseIds
    .map(id => progress.exerciseAttempts[id]?.score)
    .filter((score): score is number => typeof score === 'number');
  const score = scores.length
    ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
    : 0;
  const outcome = getBranchOutcome(score);
  const now = Date.now();

  let nextReviewCards = { ...state.reviewCards };
  let reviewCardsCreated = 0;
  for (const exercise of content.exercises) {
    const exerciseScore = progress.exerciseAttempts[exercise.id]?.score ?? 0;
    if (exerciseScore < 80) {
      const cardId = `${node.nodeId}:${exercise.id}`;
      const existing = nextReviewCards[cardId];
      nextReviewCards[cardId] = scheduleReviewCard(existing, {
        id: cardId,
        nodeId: node.nodeId,
        topic: node.topic,
        prompt: exercise.reviewPrompt,
        score: exerciseScore,
        now,
      });
      if (!existing) reviewCardsCreated += 1;
    }
  }

  const nextProgress: NodePathProgress = {
    ...progress,
    lastScore: score,
    outcome,
    attempts: progress.attempts + 1,
    completedAt: now,
  };

  const nextState: PathProgressState = {
    nodes: {
      ...state.nodes,
      [node.nodeId]: nextProgress,
    },
    reviewCards: nextReviewCards,
  };

  return {
    state: nextState,
    result: {
      score,
      outcome,
      nextAction: nextActionForOutcome(outcome, node.topic),
      reviewCardsCreated,
    },
  };
}

export function getBranchOutcome(score: number): BranchOutcome {
  if (score >= 80) return 'advance';
  if (score >= 60) return 'deepen';
  return 'reinforce';
}

export function getDueReviewCards(state: PathProgressState, now = Date.now()): ReviewCard[] {
  return Object.values(state.reviewCards)
    .filter(card => card.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function getUpcomingReviewCards(state: PathProgressState, now = Date.now()): ReviewCard[] {
  return Object.values(state.reviewCards)
    .filter(card => card.dueAt > now)
    .sort((a, b) => a.dueAt - b.dueAt);
}

export function formatReviewDue(card: ReviewCard, now = Date.now()): string {
  if (card.dueAt <= now) return 'due now';
  const days = Math.ceil((card.dueAt - now) / DAY_MS);
  return days === 1 ? 'due tomorrow' : `due in ${days} days`;
}

function scheduleReviewCard(existing: ReviewCard | undefined, data: {
  id: string;
  nodeId: string;
  topic: string;
  prompt: string;
  score: number;
  now: number;
}): ReviewCard {
  const quality = scoreToSm2Quality(data.score);
  const previous = existing ?? {
    id: data.id,
    nodeId: data.nodeId,
    topic: data.topic,
    prompt: data.prompt,
    dueAt: data.now,
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    lastQuality: quality,
  };

  if (quality < 3) {
    return {
      ...previous,
      prompt: data.prompt,
      dueAt: data.now + DAY_MS,
      intervalDays: 1,
      repetitions: 0,
      lastQuality: quality,
    };
  }

  const repetitions = previous.repetitions + 1;
  const ease = Math.max(1.3, previous.ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  const intervalDays = repetitions === 1
    ? 1
    : repetitions === 2
      ? 6
      : Math.round(previous.intervalDays * ease);

  return {
    ...previous,
    prompt: data.prompt,
    dueAt: data.now + intervalDays * DAY_MS,
    ease,
    intervalDays,
    repetitions,
    lastQuality: quality,
  };
}

function scoreToSm2Quality(score: number): number {
  if (score >= 90) return 5;
  if (score >= 80) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  if (score >= 20) return 1;
  return 0;
}

function nextActionForOutcome(outcome: BranchOutcome, topic: string): string {
  if (outcome === 'advance') {
    return `Strong mastery. Start the next path node or request a harder ${topic} challenge.`;
  }
  if (outcome === 'deepen') {
    return `Good foundation. Watch the deep-dive resource and solve one transfer challenge before advancing.`;
  }
  return `Reinforcement needed. Watch the reinforcement resource and retry a simpler ${topic} challenge.`;
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

void EMPTY_STATE;
