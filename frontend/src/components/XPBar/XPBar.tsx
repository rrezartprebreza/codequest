import { useEffect, useState } from 'react';
import { Flame, Heart, Target } from 'lucide-react';
import { EngagementState, Player } from '../../services/api';

const THRESHOLDS: Record<string, number> = {
  BEGINNER:     0,
  INTERMEDIATE: 500,
  SENIOR:       2000,
  MASTER:       5000,
};
const NEXT: Record<string, string> = {
  BEGINNER: 'INTERMEDIATE',
  INTERMEDIATE: 'SENIOR',
  SENIOR: 'MASTER',
  MASTER: 'MASTER',
};
const LEVEL_COLOR: Record<string, string> = {
  BEGINNER:     '#4FBEFF',
  INTERMEDIATE: '#12E8B0',
  SENIOR:       '#F5A623',
  MASTER:       '#FF5C72',
};

export default function XPBar({
  player,
  engagement,
  compact = false,
}: {
  player: Player;
  engagement: EngagementState | null;
  compact?: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const currentThreshold = THRESHOLDS[player.level] ?? 0;
  const nextThreshold    = THRESHOLDS[NEXT[player.level]] ?? 5000;
  const progress = player.level === 'MASTER'
    ? 100
    : Math.min(((player.totalXp - currentThreshold) / (nextThreshold - currentThreshold)) * 100, 100);
  const xpToNext = Math.max(nextThreshold - player.totalXp, 0);
  const countdownMinutes = engagement
    ? Math.max(0, Math.ceil((engagement.nextHeartRefillAtEpochMs - nowMs) / 60000))
    : 0;

  const accentColor = LEVEL_COLOR[player.level] ?? '#12E8B0';
  const hearts      = engagement?.heartsRemaining  ?? 0;
  const maxHearts   = engagement?.maxHearts         ?? 5;
  const streak      = player.currentStreak;

  return (
    <section
      className={`relative overflow-hidden rounded-[22px] ${compact ? 'p-4' : 'p-4'}`}
      style={{
        background: 'linear-gradient(160deg, rgba(15,28,50,0.97) 0%, rgba(10,19,36,0.95) 100%)',
        border: '1px solid rgba(255,255,255,0.055)',
        boxShadow: '0 8px 24px rgba(3,8,16,0.40)',
      }}
    >
      {/* Subtle level-color glow behind top-right corner */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-[0.12] blur-2xl"
        style={{ background: accentColor }}
      />

      {/* Top row: avatar + name + XP total */}
      <div className="relative flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-base font-bold text-[#030C16]"
            style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}99 100%)` }}
          >
            {player.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-[15px] font-bold leading-tight tracking-[-0.03em] text-[#EBF3FC]">
              {player.username}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: accentColor }}>
              {player.level} · {player.programmingLanguage}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-[17px] font-bold leading-tight" style={{ color: accentColor }}>
            {player.totalXp.toLocaleString()}
          </p>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#536D84]">XP</p>
        </div>
      </div>

      {/* XP progress bar */}
      <div className="relative mt-4">
        <div className="h-[5px] overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}bb)`,
              boxShadow: `0 0 8px ${accentColor}66`,
            }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#536D84]">
          <span>{Math.round(progress)}% to {player.level === 'MASTER' ? 'Max' : NEXT[player.level]}</span>
          {player.level !== 'MASTER' && (
            <span>{xpToNext.toLocaleString()} XP left</span>
          )}
        </div>
      </div>

      {/* Stat pills row */}
      <div className="mt-3 flex flex-wrap gap-2">
        {streak > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
            style={{ background: 'rgba(245,166,35,0.10)', color: '#F5A623' }}>
            <Flame size={11} />
            {streak}d streak
          </div>
        )}
        {engagement && (
          <div className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
            style={{ background: 'rgba(255,92,114,0.10)', color: '#FF8895' }}>
            <Heart size={11} />
            {hearts}/{maxHearts}
            {hearts < maxHearts && countdownMinutes > 0 && (
              <span className="text-[#536D84]">· {countdownMinutes}m</span>
            )}
          </div>
        )}
        {engagement && (
          <div className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
            style={{
              background: engagement.dailyGoalCompleted ? 'rgba(18,232,176,0.10)' : 'rgba(255,255,255,0.04)',
              color:      engagement.dailyGoalCompleted ? '#12E8B0' : '#536D84',
            }}>
            <Target size={11} />
            {engagement.dailyGoalProgress}/{engagement.dailyGoalTarget}
            {engagement.dailyGoalCompleted && <span className="ml-0.5">✓</span>}
          </div>
        )}
      </div>
    </section>
  );
}
