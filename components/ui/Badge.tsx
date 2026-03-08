'use client';

import { type C2CStatus } from '@/lib/types/job';
import { type ApplicationStatus } from '@/lib/types/application';
import { clsx } from 'clsx';

// ── C2C Status Badge ──────────────────────────────────────────────────────

const C2C_CONFIG: Record<C2CStatus, { label: string; className: string }> = {
  confirmed: { label: 'C2C Friendly',   className: 'badge-c2c-confirmed' },
  likely:    { label: 'C2C Likely',     className: 'badge-c2c-likely' },
  unclear:   { label: 'C2C Unknown',    className: 'badge-c2c-unclear' },
  w2only:    { label: 'W2 Only',        className: 'badge-c2c-w2only' },
  unknown:   { label: 'Unknown',        className: 'badge-c2c-unclear' },
};

export function C2CBadge({
  status,
  confidence,
  size = 'sm',
}: {
  status: C2CStatus;
  confidence?: number;
  size?: 'xs' | 'sm' | 'md';
}) {
  const cfg = C2C_CONFIG[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        cfg.className,
        size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          status === 'confirmed' && 'bg-emerald-400',
          status === 'likely' && 'bg-indigo-400',
          (status === 'unclear' || status === 'unknown') && 'bg-amber-400',
          status === 'w2only' && 'bg-red-400',
        )}
      />
      {cfg.label}
      {confidence !== undefined && (
        <span className="ml-0.5 opacity-70">{confidence}%</span>
      )}
    </span>
  );
}

// ── Application Status Badge ──────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; className: string; dot: string }
> = {
  Saved:       { label: 'Saved',       className: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/30',    dot: 'bg-slate-400' },
  Reviewing:   { label: 'Reviewing',   className: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',          dot: 'bg-sky-400' },
  Tailored:    { label: 'Tailored',    className: 'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/30', dot: 'bg-violet-400' },
  Applied:     { label: 'Applied',     className: 'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/30', dot: 'bg-indigo-400' },
  Interview:   { label: 'Interview',   className: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30', dot: 'bg-emerald-400' },
  Rejected:    { label: 'Rejected',    className: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',          dot: 'bg-red-400' },
  Offer:       { label: 'Offer 🎉',   className: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',     dot: 'bg-amber-400' },
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold', cfg.className)}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── Score Badge ───────────────────────────────────────────────────────────

export function ScoreBadge({
  score,
  label,
  size = 'md',
}: {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const color =
    score >= 80 ? 'text-emerald-400' :
    score >= 65 ? 'text-indigo-400' :
    score >= 50 ? 'text-amber-400' :
    'text-red-400';

  const ring =
    score >= 80 ? 'ring-emerald-500/30 bg-emerald-500/10' :
    score >= 65 ? 'ring-indigo-500/30 bg-indigo-500/10' :
    score >= 50 ? 'ring-amber-500/30 bg-amber-500/10' :
    'ring-red-500/30 bg-red-500/10';

  return (
    <div className={clsx('inline-flex flex-col items-center rounded-xl ring-1', ring,
      size === 'sm' && 'px-2 py-1',
      size === 'md' && 'px-3 py-2',
      size === 'lg' && 'px-4 py-3',
    )}>
      <span className={clsx('font-extrabold tabular-nums', color,
        size === 'sm' && 'text-sm',
        size === 'md' && 'text-xl',
        size === 'lg' && 'text-3xl',
      )}>
        {score}
      </span>
      {label && <span className="text-[10px] font-medium text-slate-500 uppercase tracking-widest">{label}</span>}
    </div>
  );
}

// ── Skill Pill ────────────────────────────────────────────────────────────

export function SkillPill({
  name,
  highlight = false,
  missing = false,
}: {
  name: string;
  highlight?: boolean;
  missing?: boolean;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
        highlight && 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40',
        missing && 'bg-red-500/10 text-red-400 ring-1 ring-red-500/30 line-through',
        !highlight && !missing && 'bg-surface-overlay text-slate-400 ring-1 ring-surface-border',
      )}
    >
      {name}
    </span>
  );
}

// ── Rate Badge ────────────────────────────────────────────────────────────

export function RateBadge({ min, max }: { min?: number; max?: number }) {
  if (!min && !max) return null;
  const text = min && max ? `$${min}–$${max}/hr` : min ? `$${min}+/hr` : `up to $${max}/hr`;
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 ring-1 ring-emerald-500/25">
      {text}
    </span>
  );
}
