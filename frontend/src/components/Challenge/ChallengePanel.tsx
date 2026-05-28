import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { AlertCircle, ArrowRight, BookOpen, Brain, CheckCircle, Code2, GraduationCap, Lightbulb, RefreshCw, Route, Send, Sparkles, Star, Timer, X, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Challenge, EngagementState, EvaluationResponse, getApiErrorMessage, markStudyComplete, misconceptionLabel, submitSolution } from '../../services/api';
import {
  buildEvaluationRubric,
  buildPostSolveRecap,
  categoryLabel,
  EvaluationEvent,
  inferBugPattern,
  inferCategories,
  RubricItem,
  validateSubmissionInput,
} from '../../services/learningEngine';

const LANG_MAP: Record<string, string> = {
  Java: 'java',
  Python: 'python',
  JavaScript: 'javascript',
  TypeScript: 'typescript',
  'C#': 'csharp',
  'C++': 'cpp',
  Go: 'go',
  Rust: 'rust',
  PHP: 'php',
  Ruby: 'ruby',
};

const INTELLIJ_THEME = 'codequest-intellij-dark';
const MAX_HINT_LEVEL = 3;

const SHARED_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: 'JetBrains Mono, IBM Plex Mono, Menlo, monospace',
  lineHeight: 20,
  lineNumbers: 'on' as const,
  wordWrap: 'on' as const,
  wrappingIndent: 'same' as const,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  smoothScrolling: true,
  renderLineHighlight: 'all' as const,
  overviewRulerBorder: false,
  padding: { top: 8 },
};

interface Props {
  challenge: Challenge | null;
  playerId: string;
  humanLanguage: string;
  engagement: EngagementState | null;
  challengeReason: string;
  onEvaluated: (event: EvaluationEvent) => void;
  onEngagementChange: (engagement: EngagementState) => void;
  onSubmissionResolved: () => void;
  onAskTutor: (prompt: string) => void;
  onComplete: (stars: number) => void;
}

export default function ChallengePanel({ challenge, playerId, humanLanguage, engagement, challengeReason, onEvaluated, onEngagementChange, onSubmissionResolved, onAskTutor, onComplete }: Props) {
  const draftKey = challenge ? `codequest_solution_${challenge.id}` : '';
  const [solution, setSolution] = useState('');
  const [evaluation, setEvaluation] = useState<EvaluationResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hintLevel, setHintLevel] = useState(0);
  const [maxHintUsed, setMaxHintUsed] = useState(0);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now());
  const [lastSubmittedFingerprint, setLastSubmittedFingerprint] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [learnOpen, setLearnOpen] = useState(true);

  useEffect(() => {
    setEvaluation(null);
    setHintLevel(0);
    setMaxHintUsed(0);
    setShowModelAnswer(false);
    setSubmitting(false);
    setStartedAt(Date.now());
    setLastSubmittedFingerprint('');
    setFailedAttempts(0);
    setLearnOpen(true);
    if (!challenge) {
      setSolution('');
      return;
    }
    setSolution(sessionStorage.getItem(`codequest_solution_${challenge.id}`) ?? '');
  }, [challenge?.id]);

  useEffect(() => {
    if (!draftKey) return;
    if (solution.trim()) {
      sessionStorage.setItem(draftKey, solution);
      return;
    }
    sessionStorage.removeItem(draftKey);
  }, [draftKey, solution]);

  const language = LANG_MAP[challenge?.programmingLanguage ?? ''] || 'plaintext';
  const formattedBuggyCode = formatCodeForDisplay(challenge?.buggyCode ?? '');
  const hintText = useMemo(() => (
    challenge ? buildHintLadderText(challenge.hint, hintLevel) : ''
  ), [challenge?.hint, hintLevel]);
  const outOfHearts = (engagement?.heartsRemaining ?? 1) <= 0;
  const missionOutline = useMemo(() => (
    challenge ? buildMissionOutline(challenge) : null
  ), [challenge]);

  if (!challenge) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-app-border bg-app-panel text-sm text-app-muted">
        No challenge available
      </div>
    );
  }

  if (challenge.practiceMode === 'WORKED_EXAMPLE') {
    return (
      <WorkedExampleView
        challenge={challenge}
        engagement={engagement}
        playerId={playerId}
        language={language}
        onEvaluated={onEvaluated}
        onEngagementChange={onEngagementChange}
        onComplete={onComplete}
        onAskTutor={onAskTutor}
      />
    );
  }

  const handleSubmit = async () => {
    const sanityError = validateSubmissionInput(solution, challenge.buggyCode);
    if (sanityError) {
      toast.error(sanityError);
      return;
    }

    const fingerprint = normalizeCode(solution).replace(/\s+/g, ' ');
    if (fingerprint === lastSubmittedFingerprint) {
      toast.error('You already submitted this exact fix. Change it before submitting again.');
      return;
    }

    setSubmitting(true);
    try {
      const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      const attemptsOnChallenge = failedAttempts + 1;
      const helpUsed = collectHelpUsed(maxHintUsed, failedAttempts, 'CORRECT');
      const result = await submitSolution({
        playerId,
        challengeId: challenge.id,
        studentSolution: solution,
        humanLanguage,
        hintLevel: maxHintUsed,
        attemptsOnChallenge,
        helpUsed,
        durationSec,
      });
      setEvaluation(result);
      onEngagementChange(result.engagement);
      setLastSubmittedFingerprint(fingerprint);

      onEvaluated({
        challenge,
        verdict: result.verdict,
        hintLevel: maxHintUsed,
        attemptsOnChallenge,
        helpUsed: collectHelpUsed(maxHintUsed, failedAttempts, result.verdict),
        submissionChars: solution.trim().length,
        durationSec,
      });

      if (result.verdict === 'CORRECT') {
        toast.success(`Correct. +${result.xpEarned} XP`);
        if (result.streakBonusXp > 0) {
          toast.success(`Streak bonus +${result.streakBonusXp} XP`);
        }
        if (result.dailyGoalBonusXp > 0) {
          toast.success(`Daily goal complete. +${result.dailyGoalBonusXp} XP`);
        }
      } else if (result.verdict === 'WRONG' && engagement && result.engagement.heartsRemaining < engagement.heartsRemaining) {
        toast.error(`You lost a heart. ${result.engagement.heartsRemaining}/${result.engagement.maxHearts} left.`);
      }

      if (result.verdict !== 'CORRECT') {
        setFailedAttempts(prev => prev + 1);
      }

      onSubmissionResolved();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Submission failed. Try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    sessionStorage.removeItem(draftKey);
    setEvaluation(null);
    setSolution('');
    setHintLevel(0);
    setMaxHintUsed(0);
    setShowModelAnswer(false);
    onComplete(starsFromHint(maxHintUsed));
  };

  const advanceHint = () => {
    const nextLevel = Math.min(MAX_HINT_LEVEL, hintLevel + 1);
    setHintLevel(nextLevel);
    setMaxHintUsed(prev => Math.max(prev, nextLevel));
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pr-1 text-[#EBF3FC]">

      {/* ── Mission Brief ── */}
      <section
        className="relative overflow-hidden rounded-[20px]"
        style={{
          background: 'linear-gradient(160deg, rgba(14,26,48,0.98) 0%, rgba(9,17,34,0.97) 100%)',
          border: '1px solid rgba(255,255,255,0.055)',
          boxShadow: '0 8px 24px rgba(3,8,16,0.4)',
        }}
      >
        {/* Accent stripe — left edge */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[20px]"
          style={{ background: 'linear-gradient(180deg, #12E8B0 0%, #4FBEFF 100%)' }} />

        <div className="px-6 py-5 pl-7">
          {/* Eyebrow */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#12E8B0]"
              style={{ background: 'rgba(18,232,176,0.08)', border: '1px solid rgba(18,232,176,0.12)' }}>
              {modeLabel(challenge.practiceMode)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4FBEFF]"
              style={{ background: 'rgba(79,190,255,0.08)', border: '1px solid rgba(79,190,255,0.12)' }}>
              {challenge.programmingLanguage}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8BA4BC]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {challenge.difficulty}
            </span>
            {engagement && (
              <span className={`ml-auto inline-flex items-center gap-1 text-[11px] font-medium ${outOfHearts ? 'text-[#FF5C72]' : 'text-[#536D84]'}`}>
                ♥ {engagement.heartsRemaining}/{engagement.maxHearts}
                {outOfHearts && ` · ${engagement.minutesUntilNextHeart}m`}
              </span>
            )}
          </div>

          {/* Title + reward */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[20px] font-bold leading-tight tracking-[-0.04em] text-[#EBF3FC]">
              {challenge.topic}
            </h2>
            <div
              className="flex-shrink-0 rounded-xl px-3 py-2 text-right"
              style={{ background: 'rgba(18,232,176,0.07)', border: '1px solid rgba(18,232,176,0.10)' }}
            >
              <p className="font-mono text-[16px] font-bold leading-tight text-[#12E8B0]">{challenge.xpReward}</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#536D84]">XP</p>
            </div>
          </div>

          <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-[#8BA4BC]">
            {challenge.missionBrief || challengeReason}
          </p>
          {challenge.successCriteria && (
            <p className="mt-2 max-w-2xl rounded-lg border border-[#F5A623]/15 bg-[#F5A623]/[0.06] px-3 py-2 text-[12px] leading-relaxed text-[#D4A84B]">
              <span className="mr-1.5 font-semibold text-[#F5A623]">Goal:</span>
              {challenge.successCriteria}
            </p>
          )}
        </div>

        {/* How to think / Skills / Checks */}
        {missionOutline && (
          <div className="border-t border-white/[0.04] px-6 py-4 pl-7">
            <div className="grid gap-3 lg:grid-cols-[1.1fr,0.9fr]">
              {/* Steps */}
              <div className="rounded-xl p-4"
                style={{ background: 'rgba(6,12,24,0.55)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#12E8B0]">
                  <Brain size={11} />
                  How to approach this
                </div>
                <div className="grid gap-2">
                  {missionOutline.steps.map((step, i) => (
                    <div key={step} className="flex items-start gap-3">
                      <span
                        className="mt-px flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-[#030C16]"
                        style={{ background: 'linear-gradient(135deg,#12E8B0,#0EC897)', minWidth: 20 }}
                      >{i + 1}</span>
                      <p className="text-[12px] leading-relaxed text-[#8BA4BC]">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Skills + Checks + Reflection */}
              <div className="grid gap-3">
                <div className="rounded-xl p-3"
                  style={{ background: 'rgba(6,12,24,0.55)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5A623]">Skills trained</div>
                  <div className="flex flex-wrap gap-1.5">
                    {missionOutline.skills.map(skill => (
                      <span key={skill}
                        className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[#8BA4BC]"
                        style={{ background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.10)' }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl p-3"
                  style={{ background: 'rgba(6,12,24,0.55)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5A623]">Practical checks</div>
                  <div className="grid gap-1.5">
                    {missionOutline.checks.map(check => (
                      <p key={check} className="text-[12px] leading-relaxed text-[#8BA4BC]">
                        <span className="mr-1 text-[#F5A623]">›</span>{check}
                      </p>
                    ))}
                  </div>
                </div>

                {challenge.reflectionPrompt && (
                  <div className="rounded-xl p-3"
                    style={{ background: 'rgba(6,12,24,0.55)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5A623]">Reflect</div>
                    <p className="text-[12px] leading-relaxed text-[#8BA4BC]">{challenge.reflectionPrompt}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Learn Before You Start ── */}
      {learnOpen && (
        <section
          className="relative overflow-hidden rounded-[18px]"
          style={{
            background: 'linear-gradient(135deg, rgba(18,40,80,0.95) 0%, rgba(10,24,52,0.92) 100%)',
            border: '1px solid rgba(79,190,255,0.18)',
            boxShadow: '0 4px 20px rgba(79,190,255,0.06)',
          }}
        >
          {/* header row */}
          <div className="flex items-center gap-3 px-5 py-3.5">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'rgba(79,190,255,0.10)', border: '1px solid rgba(79,190,255,0.18)' }}
            >
              <GraduationCap size={14} className="text-[#4FBEFF]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold leading-tight text-[#EBF3FC]">Not sure about this topic?</p>
              <p className="mt-0.5 text-[11px] text-[#536D84]">Ask the AI Coach to teach you before you start.</p>
            </div>
            <button
              onClick={() => setLearnOpen(false)}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-[#536D84] transition-colors hover:bg-white/[0.06] hover:text-[#8BA4BC]"
              title="Dismiss"
            >
              <X size={12} />
            </button>
          </div>

          {/* learn buttons */}
          <div className="flex flex-wrap gap-2 border-t border-white/[0.05] px-5 py-3">
            {/* Main topic lesson */}
            <button
              onClick={() => {
                onAskTutor(
                  `Before I start this "${challenge.topic}" challenge in ${challenge.programmingLanguage}, please give me a quick 2-minute lesson:\n` +
                  `1. What is ${challenge.topic}? — explain it simply with a real-world analogy\n` +
                  `2. Show a minimal ${challenge.programmingLanguage} code example\n` +
                  `3. List 2–3 common mistakes beginners make\n` +
                  `Keep it brief and practical — I'll ask follow-up questions if needed.`
                );
                setLearnOpen(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#4FBEFF] transition-all hover:-translate-y-px hover:shadow-md active:scale-[0.97]"
              style={{ background: 'rgba(79,190,255,0.10)', border: '1px solid rgba(79,190,255,0.16)' }}
            >
              <BookOpen size={11} />
              Teach me: {challenge.topic}
            </button>

            {/* Per-skill micro-lessons */}
            {missionOutline?.skills.slice(0, 4).map(skill => (
              <button
                key={skill}
                onClick={() => {
                  onAskTutor(
                    `Quick lesson on "${skill}" in ${challenge.programmingLanguage}: ` +
                    `explain the key idea in 3 sentences, then show one minimal code example. ` +
                    `No need to solve my challenge — just teach me this concept.`
                  );
                  setLearnOpen(false);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#8BA4BC] transition-all hover:bg-white/[0.06] hover:text-[#EBF3FC] active:scale-[0.97]"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <Sparkles size={10} className="text-[#F5A623]" />
                {skill}
              </button>
            ))}

            {/* "I'm ready" dismiss */}
            <button
              onClick={() => setLearnOpen(false)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#12E8B0] transition-all hover:bg-[rgba(18,232,176,0.08)] active:scale-[0.97]"
            >
              I'm ready →
            </button>
          </div>
        </section>
      )}

      {/* ── Quick tips row ── */}
      <section className="grid gap-2 sm:grid-cols-3">
        <QuickInfoCard icon={<Star size={12} />} label="Stars"
          body="Solve without hints = 3 stars. With partial hints = 2. Full hint ladder = 1." />
        <QuickInfoCard icon={<Timer size={12} />} label="Habit"
          body="Before editing, invent one tiny failing input. Trace expected vs actual on that input." />
        <QuickInfoCard icon={<Brain size={12} />} label="Goal"
          body="Find the smallest wrong condition or boundary assumption — don't rewrite the whole function." />
      </section>

      {/* ── Hint controls ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={advanceHint}
          disabled={hintLevel >= MAX_HINT_LEVEL}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium text-[#8BA4BC] transition-all hover:bg-white/[0.05] hover:text-[#EBF3FC] disabled:cursor-not-allowed disabled:opacity-35"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Lightbulb size={12} className="text-[#F5A623]" />
          {hintLevel === 0 ? 'Hint 1/3' : hintLevel < MAX_HINT_LEVEL ? `Deeper hint ${hintLevel + 1}/3` : 'Max reached'}
        </button>
        {hintLevel > 0 && (
          <button onClick={() => setHintLevel(0)}
            className="text-[12px] text-[#536D84] underline underline-offset-2 transition-colors hover:text-[#8BA4BC]">
            Hide hints
          </button>
        )}
      </div>

      {/* ── Hint block ── */}
      {hintLevel > 0 && (
        <section
          className="rounded-[16px] px-4 py-3 text-[13px] leading-7 text-[#F0D580]"
          style={{ background: 'rgba(245,166,35,0.07)', border: '1px solid rgba(245,166,35,0.14)' }}
        >
          {hintText}
        </section>
      )}

      {/* ── Out of hearts ── */}
      {outOfHearts && (
        <section className="rounded-xl px-3 py-2.5 text-[12px] text-[#FF8895]"
          style={{ background: 'rgba(255,92,114,0.08)', border: '1px solid rgba(255,92,114,0.18)' }}>
          No hearts left — refills in {engagement?.minutesUntilNextHeart ?? 0} min.
        </section>
      )}

      {/* ── Buggy code editor ── */}
      <section className="overflow-hidden rounded-[18px]"
        style={{ background: '#0B1525', border: '1px solid rgba(255,255,255,0.055)', boxShadow: '0 8px 20px rgba(3,8,16,0.35)' }}>
        <EditorHeader label="buggy code" />
        <Editor
          height="220px"
          language={language}
          value={formattedBuggyCode}
          beforeMount={configureMonacoTheme}
          theme={INTELLIJ_THEME}
          options={{ ...SHARED_EDITOR_OPTIONS, readOnly: true }}
        />
      </section>

      {/* ── Solution editor ── */}
      <section className="overflow-hidden rounded-[18px]"
        style={{ background: '#0B1525', border: '1px solid rgba(255,255,255,0.055)', boxShadow: '0 8px 20px rgba(3,8,16,0.35)' }}>
        <EditorHeader label="your fix" active />
        <Editor
          height="220px"
          language={language}
          value={solution}
          onChange={value => setSolution(value ?? '')}
          beforeMount={configureMonacoTheme}
          theme={INTELLIJ_THEME}
          options={SHARED_EDITOR_OPTIONS}
        />
      </section>

      {/* ── Submit / Result ── */}
      {!evaluation ? (
        <>
          <button
            onClick={handleSubmit}
            disabled={submitting || !solution.trim() || outOfHearts}
            className="inline-flex items-center justify-center gap-2 rounded-[14px] py-3.5 text-[14px] font-bold text-[#030C16] transition-all duration-150 hover:-translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            style={{
              background: 'linear-gradient(135deg, #12E8B0 0%, #0EC897 100%)',
              boxShadow: submitting || !solution.trim() || outOfHearts
                ? 'none'
                : '0 0 24px rgba(18,232,176,0.30), 0 2px 8px rgba(0,0,0,0.3)',
            }}
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Checking your fix…' : outOfHearts ? 'No hearts left' : 'Check my fix'}
          </button>
          <p className="text-center text-[12px] text-[#536D84]">
            Submit small deliberate changes — the evaluator rewards accurate debugging over large rewrites.
          </p>
        </>
      ) : (
        <ResultCard
          evaluation={evaluation}
          challenge={challenge}
          language={language}
          buggyCode={challenge.buggyCode}
          solution={solution}
          hintLevel={maxHintUsed}
          failedAttempts={failedAttempts}
          attemptsOnChallenge={evaluation.verdict === 'CORRECT' ? failedAttempts + 1 : Math.max(1, failedAttempts)}
          showModelAnswer={showModelAnswer}
          onAskTutor={onAskTutor}
          onToggleModelAnswer={() => setShowModelAnswer(prev => !prev)}
          onRetry={() => setEvaluation(null)}
          onNext={handleNext}
        />
      )}
    </div>
  );
}

function ResultCard({
  evaluation,
  challenge,
  language,
  buggyCode,
  solution,
  hintLevel,
  failedAttempts,
  attemptsOnChallenge,
  showModelAnswer,
  onAskTutor,
  onToggleModelAnswer,
  onRetry,
  onNext,
}: {
  evaluation: EvaluationResponse;
  challenge: Challenge;
  language: string;
  buggyCode: string;
  solution: string;
  hintLevel: number;
  failedAttempts: number;
  attemptsOnChallenge: number;
  showModelAnswer: boolean;
  onAskTutor: (prompt: string) => void;
  onToggleModelAnswer: () => void;
  onRetry: () => void;
  onNext: () => void;
}) {
  const verdictBg = evaluation.verdict === 'CORRECT'
    ? { bg: 'rgba(18,232,176,0.07)', border: 'rgba(18,232,176,0.22)', text: '#A8F0D8', icon: '#12E8B0' }
    : evaluation.verdict === 'PARTIAL'
    ? { bg: 'rgba(245,166,35,0.07)', border: 'rgba(245,166,35,0.22)', text: '#F0D580', icon: '#F5A623' }
    : { bg: 'rgba(255,92,114,0.07)', border: 'rgba(255,92,114,0.22)', text: '#FFB3BC', icon: '#FF5C72' };

  const formattedModelCode = formatCodeForDisplay(evaluation.correctCode);
  const modelHeight = calculateEditorHeight(formattedModelCode);
  const rubric = buildEvaluationRubric(evaluation.verdict, solution, buggyCode, hintLevel);

  return (
    <section
      className="animate-slide-up rounded-[20px] p-5"
      style={{ background: verdictBg.bg, border: `1px solid ${verdictBg.border}`, boxShadow: '0 8px 24px rgba(3,8,16,0.4)' }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[14px] font-bold" style={{ color: verdictBg.icon }}>
          {evaluation.verdict === 'CORRECT' && <CheckCircle size={15} />}
          {evaluation.verdict === 'PARTIAL' && <AlertCircle size={15} />}
          {evaluation.verdict === 'WRONG'   && <XCircle     size={15} />}
          <span>
            {evaluation.verdict === 'CORRECT'
              ? `Correct — +${evaluation.xpEarned} XP earned`
              : evaluation.verdict === 'PARTIAL'
              ? 'Almost there'
              : 'Not quite right'}
          </span>
        </div>
        {evaluation.verdict !== 'CORRECT' && (
          <button onClick={onRetry}
            className="rounded-lg px-3.5 py-2 text-[12px] font-semibold text-[#EBF3FC] transition-all hover:bg-white/[0.06]"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Try again
          </button>
        )}
      </div>

      <p className="text-[14px] leading-relaxed" style={{ color: verdictBg.text }}>{evaluation.feedback}</p>

      {evaluation.misconception && misconceptionLabel(evaluation.misconception) && (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] leading-relaxed"
          style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.18)' }}
        >
          <Brain size={13} className="mt-0.5 flex-shrink-0 text-[#F5A623]" />
          <span style={{ color: '#D4A84B' }}>
            <span className="font-semibold text-[#F5A623]">Mental bug: </span>
            {misconceptionLabel(evaluation.misconception)}
            <span className="ml-1.5 text-[#8BA4BC]">— the tutor will target this in coaching.</span>
          </span>
        </div>
      )}

      <RubricGrid items={rubric} />

      {evaluation.verdict === 'CORRECT' && (
        <>
          <PostSolveRecapCard challenge={challenge} hintLevel={hintLevel}
            attemptsOnChallenge={attemptsOnChallenge} onAskTutor={onAskTutor} />

          <div className="mt-4 flex items-center justify-between">
            <button onClick={onToggleModelAnswer}
              className="text-[12px] text-[#536D84] underline underline-offset-2 transition-colors hover:text-[#8BA4BC]">
              {showModelAnswer ? 'Hide solution' : 'Show solution'}
            </button>
          </div>

          {showModelAnswer && formattedModelCode && (
            <div className="mt-2.5 overflow-hidden rounded-[14px]"
              style={{ background: '#0B1525', border: '1px solid rgba(255,255,255,0.055)' }}>
              <EditorHeader label="fixed code" compact />
              <Editor height={`${modelHeight}px`} language={language} value={formattedModelCode}
                beforeMount={configureMonacoTheme} theme={INTELLIJ_THEME}
                options={{ ...SHARED_EDITOR_OPTIONS, readOnly: true }} />
            </div>
          )}

          <button onClick={onNext}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[14px] py-3.5 text-[14px] font-bold text-[#030C16] transition-all duration-150 hover:-translate-y-px"
            style={{ background: 'linear-gradient(135deg, #12E8B0 0%, #0EC897 100%)', boxShadow: '0 0 24px rgba(18,232,176,0.28), 0 2px 8px rgba(0,0,0,0.3)' }}>
            Next challenge
            <ArrowRight size={14} />
          </button>
        </>
      )}

      {evaluation.verdict !== 'CORRECT' && (
        <>
          <AdaptiveHelpPanel challenge={challenge} evaluation={evaluation} solution={solution}
            hintLevel={hintLevel} failedAttempts={failedAttempts} onAskTutor={onAskTutor} />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => onAskTutor(buildTargetedTutorPrompt({ challenge, evaluation, solution, hintLevel }))}
              className="inline-flex items-center justify-center rounded-xl py-2.5 text-[13px] font-semibold text-[#EBF3FC] transition-all hover:bg-white/[0.06]"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
              Ask tutor with context
            </button>
            <button onClick={onRetry}
              className="inline-flex items-center justify-center rounded-xl py-2.5 text-[13px] font-semibold text-[#EBF3FC] transition-all hover:bg-white/[0.06]"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
              Try again
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function PostSolveRecapCard({
  challenge,
  hintLevel,
  attemptsOnChallenge,
  onAskTutor,
}: {
  challenge: Challenge;
  hintLevel: number;
  attemptsOnChallenge: number;
  onAskTutor: (prompt: string) => void;
}) {
  const recap = buildPostSolveRecap(challenge, hintLevel, attemptsOnChallenge);

  return (
    <div className="mt-4 rounded-[16px] p-4"
      style={{ background: 'rgba(6,12,24,0.65)', border: '1px solid rgba(18,232,176,0.12)', borderLeft: '3px solid #12E8B0' }}>
      <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#12E8B0]">
        <BookOpen size={11} />
        Recap
      </div>
      <div className="grid gap-2.5 text-[13px] leading-relaxed text-[#8BA4BC]">
        <p><span className="font-semibold text-[#EBF3FC]">Pattern: </span>{recap.pattern}</p>
        <p><span className="font-semibold text-[#EBF3FC]">Rule: </span>{recap.rule}</p>
        <p><span className="font-semibold text-[#EBF3FC]">Reflection: </span>{recap.reflection}</p>
        <p><span className="font-semibold text-[#EBF3FC]">Practice: </span>{recap.practicePrompt}</p>
      </div>
      <button
        onClick={() => onAskTutor(buildRecapTutorPrompt(challenge, recap.practicePrompt))}
        className="mt-3.5 rounded-lg px-3.5 py-2 text-[12px] font-semibold text-[#EBF3FC] transition-all hover:bg-white/[0.07]"
        style={{ background: 'rgba(18,232,176,0.07)', border: '1px solid rgba(18,232,176,0.12)' }}>
        Give me similar practice →
      </button>
    </div>
  );
}

function AdaptiveHelpPanel({
  challenge,
  evaluation,
  solution,
  hintLevel,
  failedAttempts,
  onAskTutor,
}: {
  challenge: Challenge;
  evaluation: EvaluationResponse;
  solution: string;
  hintLevel: number;
  failedAttempts: number;
  onAskTutor: (prompt: string) => void;
}) {
  const lesson = buildMicroLesson(challenge, evaluation, failedAttempts);
  const showExample = failedAttempts >= 2 || evaluation.verdict === 'WRONG';
  const showLesson = failedAttempts >= 3 || hintLevel >= 2;
  const showGuidedTutor = failedAttempts >= 2;

  return (
    <div className="mt-4 rounded-[16px] p-4"
      style={{ background: 'rgba(6,12,24,0.65)', border: '1px solid rgba(255,255,255,0.055)' }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8BA4BC]">
          <Route size={11} className="text-[#12E8B0]" />
          Learning path
        </div>
        <span className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-[#536D84]"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          Attempt {Math.max(1, failedAttempts)}
        </span>
      </div>

      <div className="grid gap-2">
        <HelpStep icon={<Lightbulb size={13} />} title="Nudge"          body={lesson.nudge}   active />
        {showExample && <HelpStep icon={<Code2 size={13} />}    title="Pattern example" body={lesson.example}  active />}
        {showLesson  && <HelpStep icon={<BookOpen size={13} />} title="Mini lesson"     body={lesson.lesson}   active />}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => onAskTutor(buildLessonTutorPrompt({ challenge, evaluation, solution, failedAttempts, mode: 'micro-lesson' }))}
          className="inline-flex items-center justify-center rounded-xl py-2.5 text-[12px] font-semibold text-[#EBF3FC] transition-all hover:bg-white/[0.05]"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          Teach this concept
        </button>
        {showGuidedTutor && (
          <button
            onClick={() => onAskTutor(buildLessonTutorPrompt({ challenge, evaluation, solution, failedAttempts, mode: 'guided-debug' }))}
            className="inline-flex items-center justify-center rounded-xl py-2.5 text-[12px] font-semibold text-[#EBF3FC] transition-all hover:bg-white/[0.05]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            Guide me step by step
          </button>
        )}
      </div>
    </div>
  );
}

function HelpStep({
  icon,
  title,
  body,
  active,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  active: boolean;
}) {
  return (
    <div className={`rounded-xl p-3 transition-all ${active ? '' : 'opacity-40'}`}
      style={{ background: 'rgba(18,232,176,0.05)', border: '1px solid rgba(18,232,176,0.09)' }}>
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold text-[#12E8B0]">
        {icon}
        <span>{title}</span>
      </div>
      <p className="text-[12px] leading-relaxed text-[#8BA4BC]">{body}</p>
    </div>
  );
}

function QuickInfoCard({ icon, label, body }: { icon: ReactNode; label: string; body: string }) {
  return (
    <div className="rounded-[16px] p-4"
      style={{ background: 'rgba(10,18,32,0.65)', border: '1px solid rgba(255,255,255,0.055)' }}>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#12E8B0]">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-[12px] leading-relaxed text-[#8BA4BC]">{body}</p>
    </div>
  );
}

function RubricGrid({ items }: { items: RubricItem[] }) {
  return (
    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
      {items.map(item => (
        <div key={item.key} className="rounded-xl p-3"
          style={{ background: 'rgba(6,12,24,0.55)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-[#536D84]">
            <span>{item.label}</span>
            <span className="text-[#EBF3FC]">{item.score}%</span>
          </div>
          <div className="h-[4px] overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${item.score}%`, background: 'linear-gradient(90deg,#12E8B0,#0EC897)', boxShadow: '0 0 6px rgba(18,232,176,0.4)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function EditorHeader({ label, compact = false, active = false }: { label: string; compact?: boolean; active?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${compact ? 'px-4 py-2' : 'px-4 py-2.5'}`}
      style={{ background: active ? 'rgba(18,232,176,0.04)' : 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
      </div>
      <span
        className="text-[10px] font-bold uppercase tracking-[0.22em]"
        style={{ color: active ? '#12E8B0' : '#536D84' }}
      >{label}</span>
      <span className="w-12" />
    </div>
  );
}

function configureMonacoTheme(monaco: any) {
  monaco.editor.defineTheme(INTELLIJ_THEME, {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '63E6D0' },
      { token: 'type.identifier', foreground: 'D6E3F5' },
      { token: 'identifier', foreground: 'D6E3F5' },
      { token: 'string', foreground: '97C2FF' },
      { token: 'comment', foreground: '7F90A8' },
      { token: 'number', foreground: '8CE9D9' },
      { token: 'delimiter.bracket', foreground: 'D6E3F5' },
      { token: 'delimiter', foreground: 'D6E3F5' },
      { token: 'operator', foreground: 'D6E3F5' },
    ],
    colors: {
      'editor.background': '#141D29',
      'editor.foreground': '#D6E3F5',
      'editorLineNumber.foreground': '#6F819A',
      'editorLineNumber.activeForeground': '#AFC0D8',
      'editor.lineHighlightBackground': '#1D2A3A',
      'editorCursor.foreground': '#52E3CC',
      'editor.selectionBackground': '#2B4968',
      'editor.inactiveSelectionBackground': '#2B496855',
      'editorGutter.background': '#141D29',
      'editorWhitespace.foreground': '#324153',
      'editorIndentGuide.background1': '#2B394B',
      'editorIndentGuide.activeBackground1': '#3E4F66',
    },
  });
}

function normalizeCode(code: string | null): string {
  if (!code) return '';
  return code
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '  ')
    .trim();
}

function formatCodeForDisplay(code: string | null): string {
  const normalized = normalizeCode(code);
  if (!normalized) return '';
  if (normalized.includes('\n')) return normalized;

  const split = normalized
    .replace(/\{/g, '{\n')
    .replace(/}/g, '\n}\n')
    .replace(/;/g, ';\n')
    .replace(/\n{2,}/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  let indent = 0;
  const formatted: string[] = [];
  for (const line of split) {
    if (line.startsWith('}')) {
      indent = Math.max(0, indent - 1);
    }
    formatted.push(`${'  '.repeat(indent)}${line}`);
    if (line.endsWith('{')) {
      indent += 1;
    }
  }
  return formatted.join('\n');
}

function calculateEditorHeight(code: string): number {
  const lines = Math.max(code.split('\n').length, 4);
  return Math.min(lines * 20 + 24, 300);
}

function buildHintLadderText(baseHint: string, level: number): string {
  if (level <= 0) return '';
  const sentences = baseHint
    .split(/(?<=[.!?])\s+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

  if (!sentences.length) return baseHint;
  if (level === 1) return sentences.slice(0, 1).join(' ');
  if (level === 2) return sentences.slice(0, Math.min(2, sentences.length)).join(' ');

  return `${sentences.join(' ')} Focus on the exact condition/operator and verify whether it can ever evaluate as true.`;
}

function buildMissionOutline(challenge: Challenge): {
  skills: string[];
  steps: string[];
  checks: string[];
} {
  const categories = inferCategories(challenge).map(categoryLabel);
  const pattern = inferBugPattern(challenge);
  const language = challenge.programmingLanguage;
  const lowerTopic = challenge.topic.toLowerCase();

  const steps = challenge.practiceMode === 'TEST_FIRST'
    ? [
      'Start from the expected behavior before editing the code. Define one passing example and one failing example.',
      'Read the code only after you know what output the function should produce for those examples.',
      'Change the smallest part of the logic needed to make both examples behave correctly.',
    ]
    : challenge.practiceMode === 'OUTPUT_TRACING'
      ? [
        `Explain the bug in plain English before touching the code. Treat this as a ${pattern.toLowerCase()} first, not a syntax problem.`,
        'Create one tiny failing example and trace variable values line by line until actual behavior diverges from expected behavior.',
        'Apply the smallest code change that fixes the root cause, then check that the same change still works for the edge case.',
      ]
      : challenge.practiceMode === 'EDGE_CASE_RESCUE'
        ? [
          'Identify which missing input, empty value, or boundary case causes the current logic to break.',
          'Describe the normal case and the edge case separately so you do not patch one while breaking the other.',
          'Add the missing guard or boundary rule, then verify both scenarios deliberately.',
        ]
        : [
          `Explain the bug in plain English before touching the code. Treat this as a ${pattern.toLowerCase()} first, not a syntax problem.`,
          'Create one tiny failing example and trace variable values line by line until actual behavior diverges from expected behavior.',
          'Apply the smallest code change that fixes the root cause, then check that the same change still works for the edge case.',
        ];

  const checks = [
    challenge.successCriteria || `Try one normal ${language} input and one edge input. If both pass for the wrong reason, your logic is still too broad.`,
    lowerTopic.includes('loop') || lowerTopic.includes('array') || lowerTopic.includes('index')
      ? 'Check the first item, last item, and empty collection. Boundary bugs usually hide there.'
      : lowerTopic.includes('condition') || lowerTopic.includes('boolean')
        ? 'Force one true case and one false case. A correct condition should clearly separate them.'
        : lowerTopic.includes('string')
          ? 'Test spacing, casing, and empty input before you trust the result.'
          : 'Write expected output next to actual output so you can verify the fix with one concrete scenario.',
    'After the fix, ask whether you solved the cause or only the visible symptom.',
  ];

  return {
    skills: categories.length ? categories : ['General debugging'],
    steps,
    checks,
  };
}

function modeLabel(mode?: Challenge['practiceMode']): string {
  return (mode ?? 'BUG_HUNT').toLowerCase().replace(/_/g, ' ');
}

function buildTargetedTutorPrompt({
  challenge,
  evaluation,
  solution,
  hintLevel,
}: {
  challenge: Challenge;
  evaluation: EvaluationResponse;
  solution: string;
  hintLevel: number;
}): string {
  const codeLimit = 1200;
  const studentCode = limitText(normalizeCode(solution), codeLimit);
  const buggyCode = limitText(normalizeCode(challenge.buggyCode), codeLimit);
  const feedback = limitText(evaluation.feedback, 450);

  return [
    'Help me debug this with a teaching style.',
    `Language: ${challenge.programmingLanguage}`,
    `Topic: ${challenge.topic}`,
    `Verdict: ${evaluation.verdict}`,
    `Hint level used: ${hintLevel}/3`,
    '',
    'Buggy code:',
    `\`\`\`${studentLanguage(challenge.programmingLanguage)}\n${buggyCode}\n\`\`\``,
    '',
    'My attempted fix:',
    `\`\`\`${studentLanguage(challenge.programmingLanguage)}\n${studentCode}\n\`\`\``,
    '',
    `Evaluator feedback: ${feedback}`,
    '',
    'Give me:',
    '1) one sentence root cause,',
    '2) one minimal code change idea,',
    '3) one small test case I should try.',
  ].join('\n');
}

function buildMicroLesson(
  challenge: Challenge,
  evaluation: EvaluationResponse,
  failedAttempts: number
): { nudge: string; example: string; lesson: string } {
  const language = challenge.programmingLanguage;
  const topic = challenge.topic || 'this bug pattern';
  const lowerTopic = topic.toLowerCase();
  const feedback = evaluation.feedback.trim();
  const feedbackAnchor = feedback ? ` The evaluator is pointing at: ${limitText(feedback, 180)}` : '';

  if (lowerTopic.includes('array') || lowerTopic.includes('index') || lowerTopic.includes('loop')) {
    return {
      nudge: `Focus on the loop boundary and the index used to read values.${feedbackAnchor}`,
      example: `In ${language}, array-style bugs often come from using <= where < is required, starting at the wrong index, or changing the index before reading the value.`,
      lesson: `Before editing the code, write the smallest input that reaches the failing edge case. Then trace the index values one by one and stop at the first value that reads outside the expected range.`,
    };
  }

  if (lowerTopic.includes('condition') || lowerTopic.includes('boolean') || lowerTopic.includes('operator')) {
    return {
      nudge: `Read the condition as plain English and verify whether each branch can actually run.${feedbackAnchor}`,
      example: `A common ${language} mistake is flipping && and ||, using assignment instead of comparison, or checking the negative case in the positive branch.`,
      lesson: `Build a two-row truth table: one input that should pass and one input that should fail. If both rows go to the same branch, the condition is too broad or too narrow.`,
    };
  }

  if (lowerTopic.includes('string')) {
    return {
      nudge: `Check how the string is normalized, sliced, or compared before the final result is returned.${feedbackAnchor}`,
      example: `${language} string bugs often come from case sensitivity, trimming, off-by-one slices, or comparing the wrong transformed value.`,
      lesson: `Use one normal input and one edge input such as an empty string, extra spaces, or mixed casing. Trace the value after every string operation.`,
    };
  }

  if (lowerTopic.includes('null') || lowerTopic.includes('undefined') || lowerTopic.includes('optional')) {
    return {
      nudge: `Find the first value that might be missing before any method or property access happens.${feedbackAnchor}`,
      example: `A defensive ${language} fix usually checks for the missing value before the code dereferences it or assumes a collection exists.`,
      lesson: `List the required inputs for the function. Then test one valid input and one missing/empty input. The fix should handle both without hiding real errors.`,
    };
  }

  if (lowerTopic.includes('async') || lowerTopic.includes('promise') || lowerTopic.includes('await')) {
    return {
      nudge: `Look for work that starts asynchronously but is used before it has finished.${feedbackAnchor}`,
      example: `Async bugs often happen when a promise is returned or stored but not awaited before reading the result.`,
      lesson: `Trace execution order, not just line order. Mark which values are promises and which values are resolved data before changing the code.`,
    };
  }

  return {
    nudge: `Compare what the code currently does with what the function name and tests imply it should do.${feedbackAnchor}`,
    example: `Most debugging fixes are one of four changes: correct a boundary, correct a condition, handle an edge case, or return the computed value from the right place.`,
    lesson: failedAttempts >= 3
      ? `Pause before another edit. Write one failing input, the expected output, and the actual output. The smallest difference between expected and actual should drive the next code change.`
      : `Make one small change at a time and verify it against a concrete input. Avoid rewriting the whole solution before you know where the behavior diverges.`,
  };
}

function buildLessonTutorPrompt({
  challenge,
  evaluation,
  solution,
  failedAttempts,
  mode,
}: {
  challenge: Challenge;
  evaluation: EvaluationResponse;
  solution: string;
  failedAttempts: number;
  mode: 'micro-lesson' | 'guided-debug';
}): string {
  const studentCode = limitText(normalizeCode(solution), 1200);
  const feedback = limitText(evaluation.feedback, 450);
  const language = studentLanguage(challenge.programmingLanguage);

  if (mode === 'guided-debug') {
    return [
      'Guide me step by step without giving the full answer immediately.',
      `Language: ${challenge.programmingLanguage}`,
      `Topic: ${challenge.topic}`,
      `Failed attempts: ${failedAttempts}`,
      `Evaluator feedback: ${feedback}`,
      '',
      'My current code:',
      `\`\`\`${language}\n${studentCode}\n\`\`\``,
      '',
      'Ask me one diagnostic question first. Then give one small next step and one test case to run.',
    ].join('\n');
  }

  return [
    'Teach me the concept behind this mistake in a short lesson.',
    `Language: ${challenge.programmingLanguage}`,
    `Topic: ${challenge.topic}`,
    `Verdict: ${evaluation.verdict}`,
    `Evaluator feedback: ${feedback}`,
    '',
    'My current code:',
    `\`\`\`${language}\n${studentCode}\n\`\`\``,
    '',
    'Use this format:',
    '1) concept in plain English,',
    '2) tiny unrelated example,',
    '3) how to apply it to my code,',
    '4) one follow-up practice question.',
  ].join('\n');
}

function buildRecapTutorPrompt(challenge: Challenge, practicePrompt: string): string {
  return [
    'Create one similar practice task for me, but do not include the final answer immediately.',
    `Language: ${challenge.programmingLanguage}`,
    `Topic: ${challenge.topic}`,
    `Practice focus: ${practicePrompt}`,
    '',
    'Give me:',
    '1) a tiny buggy code snippet,',
    '2) the expected behavior,',
    '3) one hidden edge case to think about,',
    '4) ask me to propose the fix before revealing anything.',
  ].join('\n');
}

function collectHelpUsed(hintLevel: number, previousFailedAttempts: number, verdict: EvaluationResponse['verdict']): string[] {
  const help = new Set<string>();
  if (hintLevel > 0) help.add('hint');
  if (previousFailedAttempts >= 1 || verdict !== 'CORRECT') help.add('adaptive-help');
  if (previousFailedAttempts >= 2 || hintLevel >= 2) help.add('micro-lesson');
  return [...help];
}

function limitText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...`;
}

function studentLanguage(language: string): string {
  return LANG_MAP[language] || '';
}

function starsFromHint(hintLevel: number): number {
  if (hintLevel <= 0) return 3;
  if (hintLevel <= 2) return 2;
  return 1;
}

// ──────────────────────────────────────────────────────────────────────────
// Worked-example mode: student STUDIES a buggy + fixed pair, doesn't solve.
// Cognitive-load research (Sweller/Atkinson) shows novices learn debugging
// faster from worked examples than from fresh attempts.
// ──────────────────────────────────────────────────────────────────────────

function WorkedExampleView({
  challenge,
  engagement,
  playerId,
  language,
  onEvaluated,
  onEngagementChange,
  onComplete,
  onAskTutor,
}: {
  challenge: Challenge;
  engagement: EngagementState | null;
  playerId: string;
  language: string;
  onEvaluated: (event: EvaluationEvent) => void;
  onEngagementChange: (engagement: EngagementState) => void;
  onComplete: (stars: number) => void;
  onAskTutor: (prompt: string) => void;
}) {
  const [reflectionNote, setReflectionNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const buggyCode = useMemo(() => formatCodeForDisplay(challenge.buggyCode), [challenge.buggyCode]);
  const correctCode = useMemo(() => formatCodeForDisplay(challenge.correctCode ?? ''), [challenge.correctCode]);
  const editorHeight = Math.max(
    calculateEditorHeight(buggyCode),
    calculateEditorHeight(correctCode),
    180,
  );

  const handleMarkStudied = async () => {
    setSubmitting(true);
    try {
      const result = await markStudyComplete({
        playerId,
        challengeId: challenge.id,
        reflectionNote: reflectionNote.trim() || undefined,
      });
      onEngagementChange(result.engagement);
      onEvaluated({
        challenge,
        verdict: 'CORRECT',
        hintLevel: 0,
        attemptsOnChallenge: 1,
        helpUsed: ['worked-example'],
        submissionChars: reflectionNote.trim().length,
        durationSec: 60,
      });
      toast.success(`Studied · +${result.xpEarned} XP`);
      onComplete(2); // 2 stars for studying (not solving)
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not record study completion.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-4 pr-1 text-[#EBF3FC]">
      {/* Mission brief */}
      <section
        className="relative overflow-hidden rounded-[20px]"
        style={{
          background: 'linear-gradient(160deg, rgba(14,26,48,0.98) 0%, rgba(9,17,34,0.97) 100%)',
          border: '1px solid rgba(255,255,255,0.055)',
          boxShadow: '0 8px 24px rgba(3,8,16,0.4)',
        }}
      >
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-[20px]"
          style={{ background: 'linear-gradient(180deg, #4FBEFF 0%, #12E8B0 100%)' }} />

        <div className="px-6 py-5 pl-7">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4FBEFF]"
              style={{ background: 'rgba(79,190,255,0.08)', border: '1px solid rgba(79,190,255,0.16)' }}>
              <BookOpen size={10} />
              Worked example
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8BA4BC]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {challenge.programmingLanguage}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8BA4BC]"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {challenge.difficulty}
            </span>
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[#12E8B0]">
              <Sparkles size={11} /> Study mode · half XP
            </span>
          </div>

          <h2 className="text-[20px] font-bold leading-tight tracking-[-0.04em] text-[#EBF3FC]">
            {challenge.topic}
          </h2>
          <p className="mt-2.5 max-w-2xl text-[13px] leading-relaxed text-[#8BA4BC]">
            {challenge.missionBrief}
          </p>
          {challenge.successCriteria && (
            <p className="mt-2 max-w-2xl rounded-lg border border-[#4FBEFF]/20 bg-[#4FBEFF]/[0.06] px-3 py-2 text-[12px] leading-relaxed text-[#9FD0F0]">
              <span className="mr-1.5 font-semibold text-[#4FBEFF]">How to study:</span>
              {challenge.successCriteria}
            </p>
          )}
        </div>
      </section>

      {/* Real line-by-line diff: original (left) vs modified (right) */}
      <section className="overflow-hidden rounded-[18px]"
        style={{ background: '#0B1525', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 8px 20px rgba(3,8,16,0.35)' }}>
        <div className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'rgba(255,255,255,0.025)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F56]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#27C93F]" />
          </div>
          <span className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em]">
            <span className="text-[#FF8895]">buggy</span>
            <span className="text-[#536D84]">→</span>
            <span className="text-[#12E8B0]">fixed</span>
          </span>
          <span className="w-12" />
        </div>
        <DiffEditor
          height={`${editorHeight}px`}
          language={language}
          original={buggyCode}
          modified={correctCode}
          beforeMount={configureMonacoTheme}
          theme={INTELLIJ_THEME}
          options={{
            ...SHARED_EDITOR_OPTIONS,
            readOnly: true,
            renderSideBySide: true,
            renderOverviewRuler: false,
            ignoreTrimWhitespace: false,
          }}
        />
      </section>

      {/* Teacher's note — the bugExplanation */}
      {challenge.bugExplanation && (
        <section className="rounded-[16px] p-4"
          style={{ background: 'rgba(6,12,24,0.65)', border: '1px solid rgba(79,190,255,0.18)', borderLeft: '3px solid #4FBEFF' }}>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#4FBEFF]">
            <Brain size={11} />
            Teacher's note
          </div>
          <p className="text-[13px] leading-7 text-[#C8D8EA]">{challenge.bugExplanation}</p>
        </section>
      )}

      {/* Reflection */}
      <section className="rounded-[16px] p-4"
        style={{ background: 'rgba(6,12,24,0.65)', border: '1px solid rgba(255,255,255,0.055)' }}>
        <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5A623]">
          <BookOpen size={11} />
          Restate the rule
        </div>
        <p className="mb-2.5 text-[12px] leading-relaxed text-[#8BA4BC]">
          {challenge.reflectionPrompt || 'Write the rule from the fix in your own words.'}
        </p>
        <textarea
          value={reflectionNote}
          onChange={event => setReflectionNote(event.target.value)}
          placeholder="One sentence: what rule does the fix encode?"
          rows={2}
          className="w-full resize-none rounded-lg px-3 py-2 text-[13px] leading-relaxed text-[#C8D8EA] outline-none transition-colors placeholder:text-[#384E63]"
          style={{ background: 'rgba(4,10,20,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => onAskTutor(
              `I just studied a worked example on "${challenge.topic}" in ${challenge.programmingLanguage}. ` +
              `Quiz me with one short question that checks whether I really grasped the rule.`
            )}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-[#8BA4BC] transition-colors hover:bg-white/[0.05] hover:text-[#EBF3FC]"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Brain size={12} />
            Quiz me on it
          </button>
        </div>
      </section>

      <button
        onClick={handleMarkStudied}
        disabled={submitting || (engagement?.heartsRemaining ?? 1) <= 0}
        className="inline-flex items-center justify-center gap-2 rounded-[14px] py-3.5 text-[14px] font-bold text-[#030C16] transition-all duration-150 hover:-translate-y-px active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
        style={{
          background: 'linear-gradient(135deg, #4FBEFF 0%, #12E8B0 100%)',
          boxShadow: submitting ? 'none' : '0 0 24px rgba(79,190,255,0.25), 0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {submitting ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={14} />}
        {submitting ? 'Saving…' : 'Mark as studied · next challenge'}
      </button>
      <p className="text-center text-[12px] text-[#536D84]">
        Studying earns half XP — your next challenge will apply the rule.
      </p>
    </div>
  );
}
