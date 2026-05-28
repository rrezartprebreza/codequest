import { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Code2, KeyRound, LogIn, Sparkles, Target } from 'lucide-react';
import { getApiErrorMessage, loginPlayer, PlayerLevel, registerPlayer, setMyPassword } from '../../services/api';

const LANGUAGES = ['Java', 'Python', 'JavaScript', 'TypeScript', 'C#', 'C++', 'Go', 'Rust', 'PHP', 'Ruby', 'Other'];

const LEVELS: Array<{ value: PlayerLevel; label: string; description: string }> = [
  { value: 'BEGINNER',     label: 'Beginner',     description: 'Learning fundamentals' },
  { value: 'INTERMEDIATE', label: 'Intermediate', description: 'Can code, but bugs slow me down' },
  { value: 'SENIOR',       label: 'Senior',       description: 'Debug real projects regularly' },
  { value: 'MASTER',       label: 'Master',       description: 'Want advanced edge cases' },
];

const PLACEMENT_QUESTIONS = [
  {
    id: 'loop-boundary',
    category: 'Loops',
    question: 'A loop reads one item past the end of an array. What should you check first?',
    options: ['Variable naming', 'The loop boundary condition', 'File formatting'],
    correctIndex: 1,
  },
  {
    id: 'empty-input',
    category: 'Arrays',
    question: 'A function works for normal lists but fails for an empty list. What kind of bug is this?',
    options: ['Missing edge-case handling', 'Syntax error', 'Wrong import'],
    correctIndex: 0,
  },
  {
    id: 'branch-check',
    category: 'Conditionals',
    question: 'Two inputs should go to opposite branches but both go to the same branch. What should you trace?',
    options: ['The condition in plain English', 'Only the final return value', 'The package version'],
    correctIndex: 0,
  },
  {
    id: 'async-order',
    category: 'Async',
    question: 'Code uses data before an API call has finished. What is the likely issue?',
    options: ['Async ordering', 'Off-by-one indexing', 'CSS specificity'],
    correctIndex: 0,
  },
  {
    id: 'test-proof',
    category: 'Functions',
    question: 'Before editing a bug, what is the best proof that your fix worked?',
    options: ['A passing normal case and edge case', 'A longer variable name', 'Deleting the failing line'],
    correctIndex: 0,
  },
];

type PlacementAnswerMap = Record<string, number>;

interface PlacementResult {
  score: number;
  level: PlayerLevel;
  topic: string;
  summary: string;
}

interface Props {
  onComplete: (id: string, username: string, lang: string, level: PlayerLevel, placementFocus?: string) => void;
}

export default function OnboardingModal({ onComplete }: Props) {
  const [mode, setMode] = useState<'signup' | 'login'>('login');
  const [step, setStep] = useState(1);

  const [username, setUsername]       = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [identifier, setIdentifier]   = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [language, setLanguage]       = useState('Java');
  const [customLanguage, setCustomLang] = useState('');
  const [level, setLevel]             = useState<PlayerLevel>('BEGINNER');
  const [setPasswordPrompt, setSetPasswordPrompt] = useState<null | {
    playerId: string;
    username: string;
    programmingLanguage: string;
    level: PlayerLevel;
  }>(null);

  const [placementOpen, setPlacementOpen]       = useState(false);
  const [placementAnswers, setPlacementAnswers] = useState<PlacementAnswerMap>({});
  const [placementResult, setPlacementResult]   = useState<PlacementResult | null>(null);
  const [placementFocus, setPlacementFocus]     = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const isUsernameValid    = username.trim().length >= 3;
  const isEmailValid       = /\S+@\S+\.\S+/.test(email.trim());
  const isPasswordValid    = password.length >= 8;
  const isCustomLangValid  = language !== 'Other' || customLanguage.trim().length >= 2;
  const finalLanguage      = language === 'Other' ? customLanguage.trim() : language;
  const completedPlacement = Object.keys(placementAnswers).length === PLACEMENT_QUESTIONS.length;

  const switchMode = (next: 'signup' | 'login') => {
    setMode(next);
    setError('');
    setStep(1);
  };

  const startSignup = async () => {
    setLoading(true);
    setError('');
    try {
      const { player } = await registerPlayer({
        username: username.trim(),
        email: email.trim(),
        password,
        programmingLanguage: finalLanguage,
        level,
      });
      localStorage.setItem('codequest_player_id', player.id);
      if (placementFocus) localStorage.setItem('codequest_focus_topic', placementFocus);
      onComplete(player.id, player.username, player.programmingLanguage, player.level, placementFocus || undefined);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create account.'));
    } finally {
      setLoading(false);
    }
  };

  const startLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { player, passwordSet } = await loginPlayer(identifier.trim(), loginPassword || undefined);
      localStorage.setItem('codequest_player_id', player.id);
      if (!passwordSet) {
        // Legacy account — force a password before letting them in.
        setSetPasswordPrompt({
          playerId: player.id,
          username: player.username,
          programmingLanguage: player.programmingLanguage,
          level: player.level,
        });
        return;
      }
      onComplete(player.id, player.username, player.programmingLanguage, player.level);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Invalid username/email or password.'));
    } finally {
      setLoading(false);
    }
  };

  const runPlacementCheck = () => setPlacementResult(scorePlacement(placementAnswers));

  const applyPlacementResult = () => {
    if (!placementResult) return;
    setLevel(placementResult.level);
    setPlacementFocus(placementResult.topic);
  };

  if (setPasswordPrompt) {
    return (
      <SetPasswordOverlay
        username={setPasswordPrompt.username}
        onSubmit={async (newPassword) => {
          await setMyPassword(newPassword);
          onComplete(
            setPasswordPrompt.playerId,
            setPasswordPrompt.username,
            setPasswordPrompt.programmingLanguage,
            setPasswordPrompt.level,
          );
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex min-h-full items-start justify-center overflow-y-auto bg-bg-0/85 px-3 py-6 backdrop-blur-sm sm:items-center">
      <div className={`my-auto w-full overflow-hidden rounded-2xl border border-app-border bg-bg-1 shadow-[0_24px_60px_rgba(0,0,0,0.5)] ${
        mode === 'login' ? 'max-w-[440px]' : 'max-w-[720px]'
      }`}>
        <header className="flex items-center justify-between border-b border-app-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Code2 size={17} />
            </div>
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">CodeQuest</p>
              <p className="text-[11px] text-ink-muted">AI-powered debugging tutor</p>
            </div>
          </div>
        </header>

        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex w-full gap-1 rounded-xl border border-app-border bg-bg-2 p-1">
            {(['signup', 'login'] as const).map(item => (
              <button
                key={item}
                onClick={() => switchMode(item)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  mode === item ? 'bg-bg-3 text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {item === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            ))}
          </div>

          {mode === 'signup' ? (
            <div className="mt-5">
              <div className="mb-5 flex items-center gap-1.5">
                {[1, 2].map(index => (
                  <div key={index} className="h-1 flex-1 overflow-hidden rounded-full bg-bg-3">
                    <div className={`h-full rounded-full bg-accent transition-all ${step >= index ? 'w-full' : 'w-0'}`} />
                  </div>
                ))}
              </div>

              {step === 1 ? (
                <div className="space-y-3">
                  <TextField
                    label="Username"
                    value={username}
                    onChange={setUsername}
                    placeholder="At least 3 characters"
                    autoFocus
                    warning={username.length > 0 && !isUsernameValid ? 'At least 3 characters required' : ''}
                    onEnter={() => isUsernameValid && isEmailValid && isPasswordValid && setStep(2)}
                  />
                  <TextField
                    label="Email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    type="email"
                    warning={email.length > 0 && !isEmailValid ? 'Enter a valid email' : ''}
                    onEnter={() => isUsernameValid && isEmailValid && isPasswordValid && setStep(2)}
                  />
                  <TextField
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    placeholder="At least 8 characters"
                    type="password"
                    warning={password.length > 0 && !isPasswordValid ? 'At least 8 characters required' : ''}
                    onEnter={() => isUsernameValid && isEmailValid && isPasswordValid && setStep(2)}
                  />

                  {error && <ErrorBanner message={error} />}

                  <button
                    onClick={() => setStep(2)}
                    disabled={!isUsernameValid || !isEmailValid || !isPasswordValid}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-0 transition-colors hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continue <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="eyebrow mb-2">Programming language</p>
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                      {LANGUAGES.map(item => (
                        <button
                          key={item}
                          onClick={() => setLanguage(item)}
                          className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition-colors ${
                            language === item
                              ? 'border-accent/40 bg-accent/10 text-accent'
                              : 'border-app-border bg-bg-2 text-ink-muted hover:text-ink'
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                    {language === 'Other' && (
                      <div className="mt-3">
                        <TextField
                          label="Custom language"
                          value={customLanguage}
                          onChange={setCustomLang}
                          placeholder="Enter your language"
                          warning={!isCustomLangValid ? 'Use at least 2 characters' : ''}
                        />
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-app-border bg-bg-2 p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info/10 text-info">
                        <Target size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="eyebrow">Optional</p>
                        <p className="mt-0.5 text-[13px] font-semibold text-ink">Placement test</p>
                        <p className="mt-0.5 text-[11px] text-ink-muted">Five quick questions to start at the right level.</p>
                      </div>
                      <button
                        onClick={() => setPlacementOpen(v => !v)}
                        className="rounded-lg border border-app-border bg-bg-3 px-2.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-bg-1"
                      >
                        {placementOpen ? 'Hide' : 'Take test'}
                      </button>
                    </div>

                    {placementOpen && (
                      <div className="mt-4 space-y-3">
                        {PLACEMENT_QUESTIONS.map((item, index) => (
                          <div key={item.id} className="rounded-lg border border-app-border bg-bg-1 p-3">
                            <p className="text-[12px] font-semibold text-ink">{index + 1}. {item.question}</p>
                            <div className="mt-2 space-y-1">
                              {item.options.map((option, optionIndex) => {
                                const selected = placementAnswers[item.id] === optionIndex;
                                return (
                                  <button
                                    key={option}
                                    onClick={() => {
                                      setPlacementAnswers(prev => ({ ...prev, [item.id]: optionIndex }));
                                      setPlacementResult(null);
                                    }}
                                    className={`w-full rounded-md border px-3 py-1.5 text-left text-[12px] transition-colors ${
                                      selected
                                        ? 'border-accent/40 bg-accent/10 text-accent'
                                        : 'border-app-border bg-bg-2 text-ink-muted hover:text-ink'
                                    }`}
                                  >
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={runPlacementCheck}
                          disabled={!completedPlacement}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-bg-0 transition-colors hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Sparkles size={13} /> Get recommendation
                        </button>

                        {placementResult && (
                          <div className="rounded-lg border border-accent/25 bg-accent/10 p-3">
                            <p className="eyebrow text-accent">Recommendation</p>
                            <p className="mt-1 text-[13px] font-semibold text-ink">
                              {placementResult.level.toLowerCase()} · start with {placementResult.topic}
                            </p>
                            <p className="mt-1 text-[12px] leading-5 text-ink-muted">{placementResult.summary}</p>
                            <button
                              onClick={applyPlacementResult}
                              className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[11px] font-semibold text-bg-0 hover:bg-accent/85"
                            >
                              <CheckCircle2 size={12} /> Apply
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="eyebrow mb-2">Skill level</p>
                    <div className="space-y-1.5">
                      {LEVELS.map(item => (
                        <button
                          key={item.value}
                          onClick={() => setLevel(item.value)}
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            level === item.value
                              ? 'border-accent/40 bg-accent/10'
                              : 'border-app-border bg-bg-2 hover:bg-bg-3'
                          }`}
                        >
                          <span className="flex-1">
                            <span className="block text-[13px] font-semibold text-ink">{item.label}</span>
                            <span className="block text-[11px] text-ink-muted">{item.description}</span>
                          </span>
                          {level === item.value && <CheckCircle2 size={15} className="text-accent" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 border-t border-app-border pt-4">
                    <button
                      onClick={() => { setStep(1); setError(''); }}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-app-border bg-bg-2 px-4 py-2.5 text-[13px] font-semibold text-ink hover:bg-bg-3"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <button
                      onClick={startSignup}
                      disabled={loading || !isCustomLangValid}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-0 hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {loading ? <Spinner label="Starting…" /> : 'Start learning'}
                    </button>
                  </div>
                  {error && <ErrorBanner message={error} />}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              <TextField
                label="Username or email"
                value={identifier}
                onChange={setIdentifier}
                placeholder="Enter your username or email"
                autoFocus
                onEnter={() => !loading && identifier.trim() && startLogin()}
              />
              <TextField
                label="Password"
                value={loginPassword}
                onChange={setLoginPassword}
                placeholder="Your password"
                type="password"
                hint="Leave empty if you've never set a password — you'll be prompted next."
                onEnter={() => !loading && identifier.trim() && startLogin()}
              />

              {error && <ErrorBanner message={error} />}

              <button
                onClick={startLogin}
                disabled={loading || !identifier.trim()}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-0 hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading ? <Spinner label="Signing in…" /> : <><LogIn size={14} /> Sign in</>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function scorePlacement(answers: PlacementAnswerMap): PlacementResult {
  const wrongCategories: string[] = [];
  let score = 0;
  for (const question of PLACEMENT_QUESTIONS) {
    if (answers[question.id] === question.correctIndex) score += 1;
    else wrongCategories.push(question.category);
  }
  const level: PlayerLevel =
    score <= 1 ? 'BEGINNER' :
    score <= 3 ? 'INTERMEDIATE' :
    score === 4 ? 'SENIOR' : 'MASTER';
  const topic = wrongCategories[0] ?? (score >= 5 ? 'Async' : 'Loops');
  const summary =
    score <= 1 ? 'Start with guided fundamentals and short tracing tasks.' :
    score <= 3 ? 'You have the basics. Focus on the first weak area before increasing difficulty.' :
    score === 4 ? 'Strong debugging baseline. Start with harder mixed-skill bugs.' :
    'Excellent result. Start with advanced tasks and edge cases.';
  return { score, level, topic, summary };
}

function TextField({
  label, value, onChange, placeholder, type = 'text',
  autoFocus = false, warning = '', hint = '', onEnter,
}: {
  label: string; value: string; onChange: (value: string) => void;
  placeholder: string; type?: string; autoFocus?: boolean;
  warning?: string; hint?: string; onEnter?: () => void;
}) {
  return (
    <div>
      <label className="eyebrow mb-1.5 block">{label}</label>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        type={type === 'email' ? 'text' : type}
        inputMode={type === 'email' ? 'email' : undefined}
        autoFocus={autoFocus}
        onKeyDown={event => { if (event.key === 'Enter') onEnter?.(); }}
        className="focus-ring w-full rounded-lg border border-app-border bg-bg-2 px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-subtle"
      />
      {warning && <p className="mt-1.5 text-[11px] font-medium text-warning">{warning}</p>}
      {hint && !warning && <p className="mt-1.5 text-[11px] text-ink-subtle">{hint}</p>}
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 animate-spin rounded-full border-2 border-bg-0/30 border-t-bg-0" />
      {label}
    </span>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
      {message}
    </div>
  );
}

function SetPasswordOverlay({
  username,
  onSubmit,
}: {
  username: string;
  onSubmit: (newPassword: string) => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isValid = password.length >= 8 && password === confirm;

  const submit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError('');
    try {
      await onSubmit(password);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not set password.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex min-h-full items-center justify-center bg-bg-0/85 px-3 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[440px] overflow-hidden rounded-2xl border border-app-border bg-bg-1 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <header className="flex items-center gap-2.5 border-b border-app-border px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10 text-warning">
            <KeyRound size={17} />
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Set a password</p>
            <p className="text-[11px] text-ink-muted">Required for {username} before continuing.</p>
          </div>
        </header>

        <div className="space-y-3 px-5 py-5">
          <p className="rounded-lg border border-info/20 bg-info/10 px-3 py-2 text-[12px] leading-5 text-info">
            Your account was created before passwords were required. Set one now to keep your data secure.
          </p>
          <TextField
            label="New password"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            type="password"
            autoFocus
            warning={password.length > 0 && password.length < 8 ? 'At least 8 characters required' : ''}
            onEnter={() => void submit()}
          />
          <TextField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            placeholder="Type it again"
            type="password"
            warning={confirm.length > 0 && confirm !== password ? 'Passwords do not match' : ''}
            onEnter={() => void submit()}
          />

          {error && <ErrorBanner message={error} />}

          <button
            onClick={submit}
            disabled={!isValid || loading}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-0 hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? <Spinner label="Saving…" /> : <><KeyRound size={14} /> Set password</>}
          </button>
        </div>
      </div>
    </div>
  );
}
