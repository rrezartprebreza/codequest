import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, BookOpen, Calendar, CheckCircle2, Copy, Download, GraduationCap, Plus, RefreshCw, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AssignmentResponse,
  ClassroomDashboard,
  ClassroomResponse,
  createAssignment,
  createClassroom,
  getApiErrorMessage,
  getClassroomDashboard,
  getStudentDeepDive,
  joinClassroom,
  listAssignmentsForClassroom,
  listClassrooms,
  MISCONCEPTION_LABELS,
  PracticeMode,
  StudentDeepDive,
} from '../../services/api';

interface Props {
  playerId: string;
  onClose: () => void;
}

type View = 'list' | 'create' | 'join' | 'dashboard';

export default function ClassroomDrawer({ playerId, onClose }: Props) {
  const [view, setView] = useState<View>('list');
  const [classrooms, setClassrooms] = useState<ClassroomResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeClassroom, setActiveClassroom] = useState<ClassroomResponse | null>(null);
  const [dashboard, setDashboard] = useState<ClassroomDashboard | null>(null);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const refreshList = async () => {
    setLoading(true);
    try {
      const next = await listClassrooms(playerId);
      setClassrooms(next);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not load classrooms.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refreshList(); }, [playerId]);

  const openDashboard = async (classroom: ClassroomResponse) => {
    setActiveClassroom(classroom);
    setView('dashboard');
    setDashboard(null);
    try {
      const data = await getClassroomDashboard(classroom.id, playerId);
      setDashboard(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not load dashboard.'));
      setView('list');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-bg-0/70 backdrop-blur-sm"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex h-full w-full max-w-[560px] flex-col border-l border-app-border bg-bg-1 animate-slide-up">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-app-border px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            {view !== 'list' && (
              <button
                onClick={() => { setView('list'); setActiveClassroom(null); setDashboard(null); }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-bg-2 hover:text-ink"
                aria-label="Back"
              >
                <ArrowLeft size={14} />
              </button>
            )}
            <GraduationCap size={16} className="text-accent" />
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
              {view === 'create' && 'New classroom'}
              {view === 'join'   && 'Join classroom'}
              {view === 'dashboard' && (activeClassroom?.name ?? 'Classroom')}
              {view === 'list'   && 'Classrooms'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-bg-2 hover:text-ink"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {view === 'list' && (
            <ListView
              loading={loading}
              classrooms={classrooms}
              onCreate={() => setView('create')}
              onJoin={() => setView('join')}
              onOpen={openDashboard}
            />
          )}

          {view === 'create' && (
            <CreateView
              playerId={playerId}
              onCreated={async () => { await refreshList(); setView('list'); }}
            />
          )}

          {view === 'join' && (
            <JoinView
              playerId={playerId}
              onJoined={async () => { await refreshList(); setView('list'); }}
            />
          )}

          {view === 'dashboard' && activeClassroom && (
            <DashboardView classroom={activeClassroom} dashboard={dashboard} teacherId={playerId} />
          )}
        </div>
      </div>
    </div>
  );
}

function ListView({
  loading,
  classrooms,
  onCreate,
  onJoin,
  onOpen,
}: {
  loading: boolean;
  classrooms: ClassroomResponse[];
  onCreate: () => void;
  onJoin: () => void;
  onOpen: (classroom: ClassroomResponse) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-app-border bg-bg-2 px-3 py-2.5 text-[12px] font-semibold text-ink transition-colors hover:border-accent/30 hover:text-accent"
        >
          <Plus size={14} /> New classroom
        </button>
        <button
          onClick={onJoin}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-app-border bg-bg-2 px-3 py-2.5 text-[12px] font-semibold text-ink transition-colors hover:border-accent/30 hover:text-accent"
        >
          <Users size={14} /> Join with code
        </button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-[12px] text-ink-muted">
          <RefreshCw size={12} className="animate-spin" /> Loading…
        </p>
      ) : classrooms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-app-border bg-bg-2 p-6 text-center">
          <p className="text-[13px] font-medium text-ink">No classrooms yet</p>
          <p className="mt-1 text-[12px] leading-5 text-ink-muted">
            Create one as a lecturer to invite students, or join a class with a code.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {classrooms.map(classroom => (
            <li key={classroom.id}>
              <button
                onClick={() => onOpen(classroom)}
                disabled={classroom.role !== 'TEACHER'}
                className="w-full rounded-xl border border-app-border bg-bg-2 p-3 text-left transition-colors enabled:hover:border-accent/30 disabled:cursor-default disabled:opacity-80"
                title={classroom.role === 'TEACHER' ? 'Open dashboard' : 'Students see their own progress in the main app'}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink">{classroom.name}</p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {classroom.memberCount} member{classroom.memberCount === 1 ? '' : 's'} · joined as {classroom.role.toLowerCase()}
                    </p>
                  </div>
                  <CodeBadge code={classroom.joinCode} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateView({ playerId, onCreated }: { playerId: string; onCreated: () => void | Promise<void> }) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    try {
      const created = await createClassroom({ ownerPlayerId: playerId, name: name.trim() });
      toast.success(`Classroom created · join code ${created.joinCode}`);
      await onCreated();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not create classroom.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-5 text-ink-muted">
        You become the teacher. Students join with the short code shown after creation.
      </p>
      <Field label="Classroom name" hint="e.g. CS 201 — Spring cohort">
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          placeholder="My class"
          autoFocus
          onKeyDown={event => { if (event.key === 'Enter') void submit(); }}
          className="focus-ring w-full rounded-lg border border-app-border bg-bg-2 px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-subtle"
        />
      </Field>
      <button
        onClick={submit}
        disabled={!name.trim() || submitting}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-0 transition-colors hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
        Create classroom
      </button>
    </div>
  );
}

function JoinView({ playerId, onJoined }: { playerId: string; onJoined: () => void | Promise<void> }) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const joined = await joinClassroom({ playerId, joinCode: trimmed });
      toast.success(`Joined "${joined.name}"`);
      await onJoined();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Invalid join code.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-5 text-ink-muted">
        Ask your lecturer for the 6-character join code.
      </p>
      <Field label="Join code">
        <input
          value={code}
          onChange={event => setCode(event.target.value.toUpperCase())}
          placeholder="ABCD23"
          autoFocus
          maxLength={10}
          onKeyDown={event => { if (event.key === 'Enter') void submit(); }}
          className="focus-ring w-full rounded-lg border border-app-border bg-bg-2 px-3 py-2.5 font-mono text-[15px] tracking-[0.18em] text-ink placeholder:text-ink-subtle"
        />
      </Field>
      <button
        onClick={submit}
        disabled={!code.trim() || submitting}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg-0 transition-colors hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Users size={13} />}
        Join classroom
      </button>
    </div>
  );
}

function DashboardView({ classroom, dashboard, teacherId }: {
  classroom: ClassroomResponse;
  dashboard: ClassroomDashboard | null;
  teacherId: string;
}) {
  if (!dashboard) {
    return (
      <p className="flex items-center gap-2 text-[12px] text-ink-muted">
        <RefreshCw size={12} className="animate-spin" /> Loading dashboard…
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-app-border bg-bg-2 p-3">
        <CodeBadge code={classroom.joinCode} large />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.14em] text-ink-subtle">Join code</p>
          <p className="mt-0.5 text-[12px] text-ink-muted">Share this with students to invite them.</p>
        </div>
        <button
          onClick={() => downloadDashboardCsv(classroom.name, dashboard)}
          title="Export cohort data as CSV"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-border bg-bg-3 text-ink-muted transition-colors hover:border-accent/30 hover:text-accent"
        >
          <Download size={13} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Students" value={`${dashboard.totalStudents}`} />
        <Stat label="Active 7d" value={`${dashboard.activeStudentsLast7Days}`} />
        <Stat label="Avg solve" value={`${dashboard.avgCorrectRateLast7Days}%`} />
      </div>

      {dashboard.commonMisconceptions.length > 0 && (
        <Section title="Most common mental bugs (last 7 days)">
          <ul className="space-y-1.5">
            {dashboard.commonMisconceptions.map(item => (
              <li key={item.misconception} className="flex items-center justify-between rounded-lg bg-bg-2 px-3 py-2 text-[12px]">
                <span className="text-ink">
                  {(MISCONCEPTION_LABELS as Record<string, string>)[item.misconception] ?? item.misconception}
                </span>
                <span className="font-mono text-warning">{item.count}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {dashboard.weakSkills.length > 0 && (
        <Section title="Weak skills across cohort">
          <ul className="space-y-1.5">
            {dashboard.weakSkills.map(skill => (
              <li key={skill.category} className="rounded-lg bg-bg-2 px-3 py-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-ink capitalize">{skill.category.replace(/_/g, ' ')}</span>
                  <span className="font-mono text-ink-muted">{Math.round(skill.avgConfidence * 100)}%</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-bg-0">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(skill.avgConfidence * 100)}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-ink-subtle">{skill.attempts} attempts</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <MembersSection classroom={classroom} dashboard={dashboard} />

      <AssignmentsSection classroomId={classroom.id} teacherId={teacherId} />
    </div>
  );
}

function MembersSection({ classroom, dashboard }: { classroom: ClassroomResponse; dashboard: ClassroomDashboard }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [deepDive, setDeepDive] = useState<StudentDeepDive | null>(null);
  const [loading, setLoading] = useState(false);

  const openDeepDive = async (playerId: string, role: 'STUDENT' | 'TEACHER') => {
    if (role !== 'STUDENT') {
      toast('Deep-dive is for students only.');
      return;
    }
    setSelected(playerId);
    setDeepDive(null);
    setLoading(true);
    try {
      const data = await getStudentDeepDive(classroom.id, playerId);
      setDeepDive(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not load student deep-dive.'));
      setSelected(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Section title={`Members (${dashboard.members.length})`}>
        <ul className="space-y-1.5">
          {dashboard.members.map(member => (
            <li key={member.playerId}>
              <button
                onClick={() => void openDeepDive(member.playerId, member.role)}
                disabled={member.role !== 'STUDENT'}
                className="w-full rounded-lg bg-bg-2 px-3 py-2.5 text-left transition-colors enabled:hover:bg-bg-3 disabled:cursor-default"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {member.username}
                      {member.role === 'TEACHER' && (
                        <span className="ml-2 rounded-md bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">TEACHER</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      {member.level.toLowerCase()} · {member.totalXp.toLocaleString()} XP · {member.currentStreak}d streak
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[12px] text-ink">{member.correctRateLast7Days}%</p>
                    <p className="text-[10px] text-ink-subtle">{member.attemptsLast7Days} attempts/7d</p>
                  </div>
                </div>
                {(member.topMisconception || member.weakestSkill) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {member.topMisconception && (
                      <span className="rounded-md bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                        {(MISCONCEPTION_LABELS as Record<string, string>)[member.topMisconception] ?? member.topMisconception}
                      </span>
                    )}
                    {member.weakestSkill && (
                      <span className="rounded-md bg-info/10 px-2 py-0.5 text-[10px] font-semibold capitalize text-info">
                        weak: {member.weakestSkill.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {selected && (
        <DeepDiveModal
          loading={loading}
          deepDive={deepDive}
          onClose={() => { setSelected(null); setDeepDive(null); }}
        />
      )}
    </>
  );
}

function DeepDiveModal({ loading, deepDive, onClose }: {
  loading: boolean;
  deepDive: StudentDeepDive | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-0/80 p-4 backdrop-blur-sm"
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex h-full max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-app-border bg-bg-1 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
        <header className="flex flex-shrink-0 items-center justify-between border-b border-app-border px-5 py-3">
          <h3 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">
            {deepDive ? `${deepDive.username} — deep-dive` : 'Student deep-dive'}
          </h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-bg-2 hover:text-ink"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading || !deepDive ? (
            <p className="flex items-center gap-2 text-[12px] text-ink-muted">
              <RefreshCw size={12} className="animate-spin" /> Loading…
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Level" value={deepDive.level.toLowerCase()} />
                <Stat label="Total XP" value={deepDive.totalXp.toLocaleString()} />
                <Stat label="Streak" value={`${deepDive.currentStreak}d`} />
              </div>

              <Section title={`Recent attempts (${deepDive.recentAttempts.length})`}>
                {deepDive.recentAttempts.length === 0 ? (
                  <p className="text-[12px] text-ink-muted">No attempts recorded yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {deepDive.recentAttempts.map(attempt => (
                      <li key={`${attempt.challengeId}-${attempt.createdAt}`} className="rounded-lg bg-bg-2 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-ink">{attempt.topic}</p>
                            <p className="mt-0.5 text-[11px] text-ink-muted">
                              {attempt.bugPattern} · {attempt.hintLevel}/3 hints · {attempt.durationSec}s
                            </p>
                          </div>
                          <VerdictBadge verdict={attempt.verdict} />
                        </div>
                        {attempt.misconception && (
                          <span className="mt-1.5 inline-flex rounded-md bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                            {(MISCONCEPTION_LABELS as Record<string, string>)[attempt.misconception] ?? attempt.misconception}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {deepDive.recentTranscripts.length > 0 && (
                <Section title={`Recent tutor conversations (${deepDive.recentTranscripts.length})`}>
                  <div className="space-y-3">
                    {deepDive.recentTranscripts.map(transcript => (
                      <div key={transcript.challengeId} className="rounded-lg border border-app-border bg-bg-2 p-3">
                        <p className="eyebrow mb-2">{transcript.topic}</p>
                        <div className="space-y-2">
                          {transcript.messages.map((msg, idx) => (
                            <div
                              key={`${transcript.challengeId}-${idx}`}
                              className={`rounded-md px-2.5 py-1.5 text-[12px] leading-5 ${
                                msg.role === 'assistant'
                                  ? 'bg-accent/5 text-ink'
                                  : 'bg-bg-3 text-ink-muted'
                              }`}
                            >
                              <span className={`mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] ${
                                msg.role === 'assistant' ? 'text-accent' : 'text-info'
                              }`}>
                                {msg.role}
                              </span>
                              <span className="whitespace-pre-wrap">{msg.content}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: 'CORRECT' | 'PARTIAL' | 'WRONG' }) {
  const tone = verdict === 'CORRECT' ? 'accent' : verdict === 'PARTIAL' ? 'warning' : 'danger';
  const cls = tone === 'accent' ? 'bg-accent/10 text-accent'
    : tone === 'warning' ? 'bg-warning/10 text-warning'
    : 'bg-danger/10 text-danger';
  return <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{verdict}</span>;
}

function AssignmentsSection({ classroomId, teacherId }: { classroomId: string; teacherId: string }) {
  const [assignments, setAssignments] = useState<AssignmentResponse[] | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    try {
      const next = await listAssignmentsForClassroom(classroomId);
      setAssignments(next);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not load assignments.'));
    }
  };

  useEffect(() => { void refresh(); }, [classroomId]);

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">Assignments</p>
        <button
          onClick={() => setCreating(value => !value)}
          className="inline-flex items-center gap-1 rounded-md border border-app-border bg-bg-2 px-2 py-1 text-[11px] font-semibold text-ink transition-colors hover:border-accent/30 hover:text-accent"
        >
          {creating ? <X size={11} /> : <Plus size={11} />}
          {creating ? 'Cancel' : 'New'}
        </button>
      </div>

      {creating && (
        <AssignmentCreateForm
          classroomId={classroomId}
          teacherId={teacherId}
          onCreated={async () => { setCreating(false); await refresh(); }}
        />
      )}

      {assignments === null ? (
        <p className="flex items-center gap-2 text-[11px] text-ink-muted">
          <RefreshCw size={11} className="animate-spin" /> Loading…
        </p>
      ) : assignments.length === 0 ? (
        <p className="rounded-lg border border-dashed border-app-border bg-bg-2 p-3 text-center text-[12px] text-ink-muted">
          No assignments yet. Create one above.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {assignments.map(a => <AssignmentListItem key={a.id} assignment={a} />)}
        </ul>
      )}
    </section>
  );
}

function AssignmentCreateForm({ classroomId, teacherId, onCreated }: {
  classroomId: string;
  teacherId: string;
  onCreated: () => void | Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<PracticeMode | ''>('');
  const [targetCount, setTargetCount] = useState(3);
  const [dueAt, setDueAt] = useState(() => {
    const week = new Date();
    week.setDate(week.getDate() + 7);
    week.setHours(23, 59, 0, 0);
    // datetime-local format: YYYY-MM-DDThh:mm
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${week.getFullYear()}-${pad(week.getMonth() + 1)}-${pad(week.getDate())}T${pad(week.getHours())}:${pad(week.getMinutes())}`;
  });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim() || submitting) return;
    const dueAtIso = new Date(dueAt).toISOString();
    setSubmitting(true);
    try {
      await createAssignment(classroomId, {
        teacherId,
        title: title.trim(),
        targetTopic: topic.trim() || null,
        targetPracticeMode: mode === '' ? null : mode,
        targetCount,
        dueAt: dueAtIso,
      });
      toast.success(`Assignment "${title.trim()}" created`);
      await onCreated();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Could not create assignment.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-2 space-y-2 rounded-lg border border-app-border bg-bg-2 p-3">
      <input
        value={title}
        onChange={event => setTitle(event.target.value)}
        placeholder="Assignment title"
        className="focus-ring w-full rounded-md border border-app-border bg-bg-1 px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-subtle"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          value={topic}
          onChange={event => setTopic(event.target.value)}
          placeholder="Topic (e.g. loops) — optional"
          className="focus-ring rounded-md border border-app-border bg-bg-1 px-2.5 py-1.5 text-[12px] text-ink placeholder:text-ink-subtle"
        />
        <select
          value={mode}
          onChange={event => setMode(event.target.value as PracticeMode | '')}
          className="focus-ring rounded-md border border-app-border bg-bg-1 px-2.5 py-1.5 text-[12px] text-ink"
        >
          <option value="">Any mode</option>
          <option value="BUG_HUNT">Bug hunt</option>
          <option value="TEST_FIRST">Test first</option>
          <option value="OUTPUT_TRACING">Tracing</option>
          <option value="EDGE_CASE_RESCUE">Edge cases</option>
          <option value="WORKED_EXAMPLE">Worked example</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex items-center gap-2 text-[11px] text-ink-muted">
          <span>Target</span>
          <input
            type="number"
            min={1}
            max={50}
            value={targetCount}
            onChange={event => setTargetCount(Math.max(1, parseInt(event.target.value, 10) || 1))}
            className="focus-ring w-full rounded-md border border-app-border bg-bg-1 px-2 py-1 text-[12px] text-ink"
          />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-ink-muted">
          <span>Due</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={event => setDueAt(event.target.value)}
            className="focus-ring w-full rounded-md border border-app-border bg-bg-1 px-2 py-1 text-[12px] text-ink"
          />
        </label>
      </div>
      <button
        onClick={submit}
        disabled={!title.trim() || submitting}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg-0 transition-colors hover:bg-accent/85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
        Create assignment
      </button>
    </div>
  );
}

function AssignmentListItem({ assignment }: { assignment: AssignmentResponse }) {
  return (
    <li className="rounded-lg bg-bg-2 px-3 py-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-ink">{assignment.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-ink-muted">
            {assignment.targetCount}× {assignment.targetTopic ?? 'any topic'}
            {assignment.targetPracticeMode && ` · ${assignment.targetPracticeMode.toLowerCase().replace(/_/g, ' ')}`}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md bg-bg-3 px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
          <Calendar size={10} />
          {formatDueDate(assignment.dueAt)}
        </span>
      </div>
    </li>
  );
}

function formatDueDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function downloadDashboardCsv(classroomName: string, dashboard: ClassroomDashboard) {
  const rows: string[][] = [
    ['username', 'role', 'level', 'total_xp', 'streak', 'attempts_7d', 'correct_rate_7d', 'top_misconception', 'weakest_skill', 'joined_at'],
    ...dashboard.members.map(m => [
      m.username,
      m.role,
      m.level,
      String(m.totalXp),
      String(m.currentStreak),
      String(m.attemptsLast7Days),
      String(m.correctRateLast7Days),
      m.topMisconception ?? '',
      m.weakestSkill ?? '',
      m.joinedAt,
    ]),
  ];
  const csv = rows
    .map(cells => cells.map(escapeCsv).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safe = classroomName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  link.download = `${safe || 'classroom'}-dashboard.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast.success('CSV downloaded');
}

function escapeCsv(value: string): string {
  if (value == null) return '';
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

// ── tiny shared primitives ────────────────────────────────────────────────

function CodeBadge({ code, large = false }: { code: string; large?: boolean }) {
  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => toast.success('Code copied'));
  };
  return (
    <button
      onClick={copy}
      title="Copy join code"
      className={`inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent/10 ${
        large ? 'px-3 py-2 text-[15px]' : 'px-2 py-1 text-[11px]'
      } font-mono font-semibold tracking-[0.18em] text-accent transition-colors hover:bg-accent/15`}
    >
      {code}
      <Copy size={large ? 13 : 10} />
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="eyebrow mb-1.5 block">{label}</label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-subtle">{hint}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-app-border bg-bg-2 px-2.5 py-2 text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-ink-subtle">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-ink">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <p className="eyebrow mb-2">{title}</p>
      {children}
    </section>
  );
}

