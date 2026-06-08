import type { LearningState } from './learningEngine';
import type { PlayerLevel, PracticeMode, ProgressionNode } from './api';

export type ExerciseType =
  | 'multiple_choice'
  | 'trace_prediction'
  | 'fill_blank'
  | 'concept_match'
  | 'sequence'
  | 'reflection';

export interface VideoResource {
  id: string;
  videoId: string;
  title: string;
  channelHint: string;
  durationHint: string;
  searchQuery: string;
  reason: string;
  shortExplanation: string;
  keyIdeas: string[];
  practiceFocus: string;
  quiz: VideoQuizQuestion[];
  role: 'core' | 'reinforce' | 'deep';
}

export interface VideoQuizQuestion {
  id: string;
  question: string;
  choices: string[];
  correctIndex: number;
  explanation: string;
}

export interface PathExercise {
  id: string;
  type: ExerciseType;
  title: string;
  prompt: string;
  reviewPrompt: string;
  estimatedMinutes: number;
}

export interface NodeLearningContent {
  skillFocus: string;
  summary: string;
  videos: VideoResource[];
  exercises: PathExercise[];
  masteryChecklist: string[];
  branchRules: {
    advance: string;
    reinforce: string;
    deepen: string;
  };
}

const LEVEL_LABELS: Record<PlayerLevel, string> = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  SENIOR: 'advanced',
  MASTER: 'expert',
};

const MODE_LABELS: Record<PracticeMode, string> = {
  BUG_HUNT: 'bug-hunting',
  TEST_FIRST: 'test-first debugging',
  OUTPUT_TRACING: 'output tracing',
  EDGE_CASE_RESCUE: 'edge-case debugging',
  WORKED_EXAMPLE: 'worked-example study',
};

const VIDEO_SOURCES = [
  'freeCodeCamp',
  'Programming with Mosh',
  'Bro Code',
  'Traversy Media',
  'CS50',
];

const LANGUAGE_VIDEO_IDS: Record<string, string> = {
  javascript: 'PkZNo7MFNFg',
  typescript: 'PkZNo7MFNFg',
  python: 'rfscVS0vtbw',
  java: 'grEKMHGYyns',
  'c++': 'vLnPwxZdW4Y',
  cpp: 'vLnPwxZdW4Y',
  c: 'KJgsSFOSQv0',
};

const TOPIC_VIDEO_IDS: Record<string, string> = {
  variables: 'zOjov-2OZ0E',
  'if statements': 'f4KOjWS_KZs',
  loops: 'wxds6MAtUQ0',
  functions: 'xUI5Tsl2JpY',
  arrays: 'oigfaZ5ApsM',
  strings: '9a3CxJyTq00',
  'null handling': '7QwqQXqu8bA',
  async: 'PoRJizFvM7s',
  tests: 'FgnxcUQ5vho',
  debugging: 'H0XScE08hy8',
};

const topicConcepts: Record<string, {
  focus: string;
  summary: string;
  checklist: string[];
  exercises: Omit<PathExercise, 'id' | 'estimatedMinutes'>[];
}> = {
  variables: {
    focus: 'State, assignment, default values, and type assumptions',
    summary: 'This node builds the habit of checking what every variable contains before trusting later logic.',
    checklist: [
      'Name the expected value before each important line runs.',
      'Spot a wrong assignment or default value without rewriting unrelated code.',
      'Explain how one bad value can cascade into a later bug.',
    ],
    exercises: [
      {
        type: 'fill_blank',
        title: 'Active recall',
        prompt: 'Complete short statements about assignment, reassignment, and type conversion.',
        reviewPrompt: 'Explain the difference between assignment, reassignment, and type conversion using one tiny code example.',
      },
      {
        type: 'trace_prediction',
        title: 'Value trace',
        prompt: 'Predict the value of three variables after a short buggy snippet runs.',
        reviewPrompt: 'Trace three variable values line by line and say which value first becomes wrong.',
      },
    ],
  },
  'if statements': {
    focus: 'Boolean logic, branch coverage, and expected behavior',
    summary: 'This node teaches learners to translate conditions into plain language and test both true and false paths.',
    checklist: [
      'Describe a condition without reading it as code.',
      'Create one input that should enter each branch.',
      'Fix a branch bug without changing the intended behavior.',
    ],
    exercises: [
      {
        type: 'multiple_choice',
        title: 'Branch diagnosis',
        prompt: 'Choose which input exposes the wrong branch.',
        reviewPrompt: 'Give one input for the true branch and one input for the false branch, then explain the expected behavior.',
      },
      {
        type: 'trace_prediction',
        title: 'Path tracing',
        prompt: 'Trace the exact branch taken for three inputs.',
        reviewPrompt: 'Translate one Boolean condition into plain language and test both branch outcomes.',
      },
    ],
  },
  loops: {
    focus: 'Counters, stop conditions, and off-by-one failures',
    summary: 'This node focuses on tracing loop state so boundary bugs become visible before learners edit code.',
    checklist: [
      'List the first, middle, and final loop iteration.',
      'Explain whether a boundary should be inclusive or exclusive.',
      'Use a tiny input to expose an off-by-one error.',
    ],
    exercises: [
      {
        type: 'sequence',
        title: 'Iteration order',
        prompt: 'Put loop states in the order they occur.',
        reviewPrompt: 'List the first, middle, and final loop iteration for a small input.',
      },
      {
        type: 'trace_prediction',
        title: 'Boundary check',
        prompt: 'Predict the output for empty, one-item, and many-item inputs.',
        reviewPrompt: 'Explain whether the loop boundary should be inclusive or exclusive, then prove it with one input.',
      },
    ],
  },
  functions: {
    focus: 'Inputs, outputs, return paths, and scope',
    summary: 'This node connects function contracts to tests so learners fix behavior rather than guessing implementation changes.',
    checklist: [
      'State the function contract from examples.',
      'Identify a missing or premature return.',
      'Write one failing case before changing the function body.',
    ],
    exercises: [
      {
        type: 'multiple_choice',
        title: 'Contract check',
        prompt: 'Select the expected output that matches the function contract.',
        reviewPrompt: 'State the function contract in one sentence and name the input/output pair that proves it.',
      },
      {
        type: 'reflection',
        title: 'Debug note',
        prompt: 'Explain which input/output pair proved the fix.',
        reviewPrompt: 'Describe a missing or premature return bug and how one failing case exposes it.',
      },
    ],
  },
  arrays: {
    focus: 'Indexes, collection boundaries, ordering, and mutation',
    summary: 'This node teaches careful reasoning about collection positions and small test cases.',
    checklist: [
      'Explain which index is being read or written.',
      'Test empty, one-item, and last-item cases.',
      'Avoid changing collection order unless the goal requires it.',
    ],
    exercises: [
      {
        type: 'trace_prediction',
        title: 'Index trace',
        prompt: 'Mark which element is accessed at each step.',
        reviewPrompt: 'Trace which array/list index is accessed for empty, first, and last-item cases.',
      },
      {
        type: 'multiple_choice',
        title: 'Boundary bug',
        prompt: 'Pick the smallest input that reproduces the bug.',
        reviewPrompt: 'Name the smallest collection input that exposes an index or boundary bug.',
      },
    ],
  },
  strings: {
    focus: 'Parsing, trimming, casing, and empty-input behavior',
    summary: 'This node targets common string bugs caused by hidden whitespace, case assumptions, and missing empty checks.',
    checklist: [
      'Test empty strings and strings with whitespace.',
      'Separate parsing from validation.',
      'Explain whether comparison should be case-sensitive.',
    ],
    exercises: [
      {
        type: 'fill_blank',
        title: 'String rules',
        prompt: 'Fill in missing terms for trim, split, substring, and comparison behavior.',
        reviewPrompt: 'Explain how whitespace, casing, or substring boundaries can change string behavior.',
      },
      {
        type: 'concept_match',
        title: 'Bug pattern match',
        prompt: 'Match each string symptom to its likely cause.',
        reviewPrompt: 'Match a string symptom to one likely cause: whitespace, casing, parsing, or empty input.',
      },
    ],
  },
  'null handling': {
    focus: 'Null, undefined, empty values, and safe guards',
    summary: 'This node teaches learners to add precise guards without hiding valid errors or changing unrelated behavior.',
    checklist: [
      'Distinguish null from an empty collection or empty string.',
      'Place a guard before the first unsafe access.',
      'Keep the original success path unchanged.',
    ],
    exercises: [
      {
        type: 'multiple_choice',
        title: 'Guard placement',
        prompt: 'Choose the earliest safe place to check for missing values.',
        reviewPrompt: 'Place a null or empty guard before the first unsafe access and explain why it belongs there.',
      },
      {
        type: 'reflection',
        title: 'Safety note',
        prompt: 'Explain what the guard prevents and what it should not hide.',
        reviewPrompt: 'Explain what a guard should prevent and what valid error it should not hide.',
      },
    ],
  },
  async: {
    focus: 'Execution order, promises, callbacks, and awaited values',
    summary: 'This node builds a mental timeline for asynchronous code so learners can separate scheduled work from completed work.',
    checklist: [
      'Describe which statement runs now and which runs later.',
      'Identify a value used before it is available.',
      'Fix async flow while preserving error handling.',
    ],
    exercises: [
      {
        type: 'sequence',
        title: 'Async timeline',
        prompt: 'Arrange async events in the order they actually run.',
        reviewPrompt: 'Order async events from scheduled work to resolved value and identify what runs immediately.',
      },
      {
        type: 'trace_prediction',
        title: 'Await check',
        prompt: 'Predict what is logged before and after awaiting.',
        reviewPrompt: 'Explain which value exists before await and which value exists after await.',
      },
    ],
  },
  tests: {
    focus: 'Expected behavior, failing examples, and proof of fix',
    summary: 'This node uses tests as a debugging tool: define behavior first, then change only the code needed to satisfy it.',
    checklist: [
      'Write a failing example before editing code.',
      'Separate normal cases from edge cases.',
      'Use the test result to explain why the fix is correct.',
    ],
    exercises: [
      {
        type: 'multiple_choice',
        title: 'Test intent',
        prompt: 'Choose the test that best captures the expected behavior.',
        reviewPrompt: 'Write one failing example that captures expected behavior before editing code.',
      },
      {
        type: 'sequence',
        title: 'Debug workflow',
        prompt: 'Order the steps: reproduce, isolate, test, fix, verify.',
        reviewPrompt: 'Put the debugging workflow in order: reproduce, isolate, test, fix, verify.',
      },
    ],
  },
  debugging: {
    focus: 'Integrated production-style debugging',
    summary: 'This capstone node combines tracing, edge-case thinking, tests, and Socratic explanation in one realistic bug hunt.',
    checklist: [
      'State the observed symptom and expected behavior.',
      'Use evidence from a small failing case.',
      'Explain the fix as a reusable debugging pattern.',
    ],
    exercises: [
      {
        type: 'concept_match',
        title: 'Pattern transfer',
        prompt: 'Match symptoms to bug patterns across mixed examples.',
        reviewPrompt: 'Match one observed symptom to a reusable debugging pattern.',
      },
      {
        type: 'reflection',
        title: 'Portfolio recap',
        prompt: 'Write the debugging rule you would reuse next time.',
        reviewPrompt: 'Write one debugging rule you can transfer to a future bug.',
      },
    ],
  },
};

const fallbackConcept = topicConcepts.debugging;

function buildVideoExplanation(
  node: ProgressionNode,
  concept: typeof fallbackConcept,
  role: VideoResource['role'],
  language: string,
  mode: string,
): Pick<VideoResource, 'shortExplanation' | 'keyIdeas' | 'practiceFocus'> {
  const topic = node.topic.toLowerCase();
  const keyIdeas = concept.checklist.slice(0, 3);

  if (role === 'reinforce') {
    return {
      shortExplanation: `This review is for the common mistakes in ${topic}. Focus on the first place the logic becomes wrong, then explain the bug in one sentence before changing code.`,
      keyIdeas,
      practiceFocus: `${node.topic} common mistake practice`,
    };
  }

  if (role === 'deep') {
    return {
      shortExplanation: `This deeper lesson connects ${topic} to edge cases. Watch for unusual inputs, boundary values, and how to prove the same fix still works after the obvious case passes.`,
      keyIdeas,
      practiceFocus: `${node.topic} edge case practice`,
    };
  }

  return {
    shortExplanation: `This lesson prepares you for a short ${language} ${mode} mission. The main idea is ${concept.focus.toLowerCase()}; after watching, practice by tracing one tiny example before editing code.`,
    keyIdeas,
    practiceFocus: `${node.topic} ${mode} after video`,
  };
}

function buildVideoQuiz(
  node: ProgressionNode,
  concept: typeof fallbackConcept,
  role: VideoResource['role'],
): VideoQuizQuestion[] {
  const topic = node.topic.toLowerCase();
  const roleLabel = role === 'core' ? 'main tutorial' : role === 'reinforce' ? 'review tutorial' : 'deep-dive tutorial';

  return [
    {
      id: `${node.nodeId}-${role}-quiz-1`,
      question: `After this ${roleLabel}, what should you do first when debugging ${topic}?`,
      choices: [
        'Trace one tiny example and identify where the behavior first becomes wrong.',
        'Rewrite the whole solution before checking any specific input.',
        'Skip the small cases and only test the largest input.',
      ],
      correctIndex: 0,
      explanation: `The path uses Socratic debugging: prove the first wrong step with a small example before changing code.`,
    },
    {
      id: `${node.nodeId}-${role}-quiz-2`,
      question: `Which idea best matches this tutorial focus: ${concept.focus}?`,
      choices: [
        concept.checklist[0],
        'Change naming and formatting first, then test later.',
        'Assume the happy path is enough if the code runs once.',
      ],
      correctIndex: 0,
      explanation: `This node is about transferring the tutorial into a concrete debugging habit: ${concept.checklist[0].toLowerCase()}`,
    },
  ];
}

export function buildYoutubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function buildYoutubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

export function buildNodeLearningContent(
  node: ProgressionNode,
  programmingLanguage: string,
  learningState: LearningState,
): NodeLearningContent {
  const concept = topicConcepts[node.topic.toLowerCase()] ?? fallbackConcept;
  const level = LEVEL_LABELS[node.difficulty];
  const mode = MODE_LABELS[node.practiceMode];
  const language = programmingLanguage || 'programming';
  const languageVideoId = LANGUAGE_VIDEO_IDS[language.toLowerCase()] ?? LANGUAGE_VIDEO_IDS.javascript;
  const topicVideoId = TOPIC_VIDEO_IDS[node.topic.toLowerCase()] ?? TOPIC_VIDEO_IDS.debugging;
  const attemptsForTopic = learningState.attempts.filter(attempt =>
    attempt.categories.some(category => node.topic.toLowerCase().includes(category))
  ).length;
  const needsFoundations = node.status === 'ACTIVE' && attemptsForTopic > 0;

  const videos: VideoResource[] = [
    {
      id: `${node.nodeId}-core`,
      videoId: topicVideoId,
      title: `${node.title} in ${language}`,
      channelHint: VIDEO_SOURCES.slice(0, 3).join(', '),
      durationHint: level === 'beginner' ? '8-15 min' : '12-25 min',
      searchQuery: `${language} ${node.topic} ${level} tutorial debugging examples`,
      reason: `Primary video for the active ${node.topic} node, selected around ${mode}.`,
      ...buildVideoExplanation(node, concept, 'core', language, mode),
      quiz: buildVideoQuiz(node, concept, 'core'),
      role: 'core',
    },
    {
      id: `${node.nodeId}-reinforce`,
      videoId: languageVideoId,
      title: `Reinforcement: ${node.topic} mistakes`,
      channelHint: VIDEO_SOURCES.slice(2).join(', '),
      durationHint: '6-12 min',
      searchQuery: `${language} common ${node.topic} mistakes debugging ${level}`,
      reason: needsFoundations
        ? 'Recommended because this topic already appeared in your practice history.'
        : 'Use this if the first challenge feels too difficult.',
      ...buildVideoExplanation(node, concept, 'reinforce', language, mode),
      quiz: buildVideoQuiz(node, concept, 'reinforce'),
      role: 'reinforce',
    },
    {
      id: `${node.nodeId}-deep`,
      videoId: TOPIC_VIDEO_IDS.debugging,
      title: `Deep dive: ${node.topic} edge cases`,
      channelHint: 'CS50, freeCodeCamp, language-specific creators',
      durationHint: '15-30 min',
      searchQuery: `${language} ${node.topic} edge cases advanced debugging`,
      reason: 'Use this after a strong score to branch into harder transfer problems.',
      ...buildVideoExplanation(node, concept, 'deep', language, mode),
      quiz: buildVideoQuiz(node, concept, 'deep'),
      role: 'deep',
    },
  ];

  return {
    skillFocus: concept.focus,
    summary: concept.summary,
    videos,
    exercises: concept.exercises.map((exercise, index) => ({
      ...exercise,
      id: `${node.nodeId}-${exercise.type}-${index}`,
      estimatedMinutes: index === 0 ? 4 : 6,
    })),
    masteryChecklist: concept.checklist,
    branchRules: {
      advance: `Score 80%+ or solve with low hint use: unlock the next ${language} debugging node.`,
      reinforce: `Score below 60% or use many hints: watch the reinforcement video and retry a simpler ${node.topic} challenge.`,
      deepen: `Score 60-79%: do the deep-dive exercise before advancing.`,
    },
  };
}

export function exerciseTypeLabel(type: ExerciseType): string {
  return type.replace(/_/g, ' ');
}
