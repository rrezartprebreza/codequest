import { Flame, Medal, Shield, Trophy, X } from 'lucide-react';
import { LeaderboardEntry, LeaderboardResponse } from '../../services/api';

// ── League config ──────────────────────────────────────────────────────────
const LEAGUE_META: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  BRONZE:   { label: 'Bronze League',   color: '#CD7F32', bg: 'rgba(205,127,50,0.08)',   border: 'rgba(205,127,50,0.22)', icon: <Shield   size={15} /> },
  SILVER:   { label: 'Silver League',   color: '#A8BDD4', bg: 'rgba(168,189,212,0.08)',  border: 'rgba(168,189,212,0.22)', icon: <Shield   size={15} /> },
  GOLD:     { label: 'Gold League',     color: '#F5A623', bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.22)', icon: <Trophy   size={15} /> },
  PLATINUM: { label: 'Platinum League', color: '#12E8B0', bg: 'rgba(18,232,176,0.08)',   border: 'rgba(18,232,176,0.22)', icon: <Trophy   size={15} /> },
  DIAMOND:  { label: 'Diamond League',  color: '#4FBEFF', bg: 'rgba(79,190,255,0.08)',   border: 'rgba(79,190,255,0.22)', icon: <Medal    size={15} /> },
};

const RANK_COLORS = ['#F5A623', '#A8BDD4', '#CD7F32'];

interface Props {
  data: LeaderboardResponse;
  onClose: () => void;
}

export default function LeagueTable({ data, onClose }: Props) {
  const meta = LEAGUE_META[data.league] ?? LEAGUE_META.BRONZE;

  return (
    // ── Backdrop ─────────────────────────────────────────────────────────
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(3,8,20,0.75)', backdropFilter: 'blur(10px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* ── Panel ────────────────────────────────────────────────────────── */}
      <div
        className="relative flex w-full max-w-md flex-col overflow-hidden rounded-[24px]"
        style={{
          background: 'linear-gradient(160deg, rgba(12,22,42,0.99) 0%, rgba(7,14,28,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
          maxHeight: '85vh',
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div
          className="flex flex-shrink-0 items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3">
            {/* League badge */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: meta.bg, border: `1px solid ${meta.border}`, color: meta.color }}
            >
              {meta.icon}
            </div>
            <div>
              <p className="text-[15px] font-bold leading-tight tracking-[-0.02em] text-[#EBF3FC]">
                {meta.label}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: meta.color }}>
                {data.entries.length} players
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[#536D84] transition-colors hover:bg-white/[0.06] hover:text-[#EBF3FC]"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Column labels ────────────────────────────────────────────── */}
        <div
          className="flex flex-shrink-0 items-center gap-3 px-6 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#2E4560]"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          <span className="w-7 text-center">#</span>
          <span className="flex-1">Player</span>
          <span className="w-16 text-right">XP</span>
          <span className="w-12 text-right">Streak</span>
        </div>

        {/* ── Rows ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {data.entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-[#2E4560]">
              <Trophy size={28} />
              <p className="text-[13px] font-medium">No players yet in this league</p>
            </div>
          ) : (
            data.entries.map((entry) => (
              <LeagueRow key={String(entry.playerId)} entry={entry} rankColors={RANK_COLORS} leagueColor={meta.color} />
            ))
          )}
        </div>

        {/* ── Footer: XP ranges ────────────────────────────────────────── */}
        <div
          className="flex flex-shrink-0 flex-wrap items-center justify-center gap-2 px-6 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {Object.entries(LEAGUE_META).map(([key, m]) => (
            <span
              key={key}
              className="rounded-lg px-2.5 py-1 text-[10px] font-semibold"
              style={{
                background: data.league === key ? m.bg : 'rgba(255,255,255,0.03)',
                color:      data.league === key ? m.color : '#2E4560',
                border:     `1px solid ${data.league === key ? m.border : 'rgba(255,255,255,0.04)'}`,
              }}
            >
              {m.label.split(' ')[0]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Single row ──────────────────────────────────────────────────────────────
function LeagueRow({ entry, rankColors, leagueColor }: {
  entry: LeaderboardEntry;
  rankColors: string[];
  leagueColor: string;
}) {
  const rankColor = rankColors[entry.rank - 1] ?? null;

  return (
    <div
      className="flex items-center gap-3 px-6 py-3 transition-colors"
      style={{
        background: entry.currentPlayer
          ? 'rgba(18,232,176,0.05)'
          : 'transparent',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        borderLeft: entry.currentPlayer ? '3px solid #12E8B0' : '3px solid transparent',
      }}
    >
      {/* Rank number */}
      <div className="flex w-7 flex-shrink-0 items-center justify-center">
        {entry.rank <= 3 ? (
          <span className="text-[14px] font-black" style={{ color: rankColor ?? leagueColor }}>
            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
          </span>
        ) : (
          <span className="text-[12px] font-bold text-[#2E4560]">{entry.rank}</span>
        )}
      </div>

      {/* Avatar + name */}
      <div className="flex flex-1 min-w-0 items-center gap-2.5">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-[12px] font-bold"
          style={
            entry.currentPlayer
              ? { background: 'rgba(18,232,176,0.15)', color: '#12E8B0', border: '1px solid rgba(18,232,176,0.25)' }
              : rankColor
                ? { background: `${rankColor}18`, color: rankColor, border: `1px solid ${rankColor}33` }
                : { background: 'rgba(255,255,255,0.05)', color: '#536D84', border: '1px solid rgba(255,255,255,0.07)' }
          }
        >
          {entry.username.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className={`truncate text-[13px] font-semibold ${entry.currentPlayer ? 'text-[#EBF3FC]' : 'text-[#8BA4BC]'}`}>
            {entry.username}
            {entry.currentPlayer && (
              <span className="ml-1.5 text-[10px] font-bold text-[#12E8B0]">YOU</span>
            )}
          </p>
        </div>
      </div>

      {/* XP */}
      <div className="w-16 text-right">
        <span
          className="font-mono text-[13px] font-bold"
          style={{ color: entry.currentPlayer ? '#12E8B0' : rankColor ?? '#536D84' }}
        >
          {entry.totalXp.toLocaleString()}
        </span>
      </div>

      {/* Streak */}
      <div className="flex w-12 items-center justify-end gap-1">
        {entry.currentStreak > 0 ? (
          <>
            <Flame size={10} className="text-[#F5A623]" />
            <span className="text-[12px] font-bold text-[#F5A623]">{entry.currentStreak}</span>
          </>
        ) : (
          <span className="text-[12px] text-[#2E4560]">—</span>
        )}
      </div>
    </div>
  );
}


