'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import type { Application, ApplicationStatus } from '@/lib/types/application';
import { StatusBadge, C2CBadge, RateBadge } from '@/components/ui/Badge';
import { ATSScoreChip } from '@/components/ui/ATSScoreBadge';
import { Building2, Clock, GripVertical } from 'lucide-react';

const COLUMNS: ApplicationStatus[] = [
  'Saved', 'Reviewing', 'Tailored', 'Applied', 'Interview', 'Rejected', 'Offer',
];

const COLUMN_COLORS: Record<ApplicationStatus, string> = {
  Saved:     'border-slate-700/60',
  Reviewing: 'border-sky-700/40',
  Tailored:  'border-violet-700/40',
  Applied:   'border-indigo-700/40',
  Interview: 'border-emerald-700/40',
  Rejected:  'border-red-800/40',
  Offer:     'border-amber-700/40',
};

interface EnrichedApplication extends Application {
  job?: {
    title: string;
    company: string;
    location: string;
    c2cStatus: string;
    rateMin?: number;
    rateMax?: number;
    score?: { overall: number; recommendation: string };
  } | null;
}

interface KanbanBoardProps {
  applications: EnrichedApplication[];
  onStatusChange: (appId: string, newStatus: ApplicationStatus) => void;
}

function ApplicationCard({
  app,
  onStatusChange,
}: {
  app: EnrichedApplication;
  onStatusChange: (appId: string, newStatus: ApplicationStatus) => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const nextStatuses = COLUMNS.filter(c => c !== app.status);

  return (
    <div className="group relative rounded-xl border border-surface-border bg-surface-base p-3.5 shadow-card hover:border-slate-600 transition-all">
      {/* Drag handle */}
      <div className="absolute left-1.5 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-4 w-4 text-slate-600" />
      </div>

      <div className="pl-2">
        {/* Title + company */}
        <p className="text-sm font-semibold text-slate-100 leading-tight line-clamp-1">
          {app.job?.title || 'Data Engineer'}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{app.job?.company || '—'}</span>
        </div>

        {/* Badges row */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {app.job?.c2cStatus && (
            <C2CBadge status={app.job.c2cStatus as 'confirmed' | 'likely' | 'unclear' | 'w2only' | 'unknown'} size="xs" />
          )}
          {app.job?.rateMin || app.job?.rateMax ? (
            <RateBadge min={app.job.rateMin} max={app.job.rateMax} />
          ) : null}
          {app.job?.score?.overall !== undefined && (
            <span className="text-[10px] font-semibold text-indigo-400">
              {app.job.score.overall}% match
            </span>
          )}
          {app.atsScore && <ATSScoreChip score={app.atsScore} />}
        </div>

        {/* Timeline */}
        {app.appliedAt && (
          <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
            <Clock className="h-2.5 w-2.5" />
            Applied {new Date(app.appliedAt).toLocaleDateString()}
          </div>
        )}

        {/* Notes preview */}
        {app.notes?.[0] && (
          <p className="mt-2 line-clamp-1 rounded-md bg-surface-overlay px-2 py-1 text-[10px] italic text-slate-500">
            &ldquo;{app.notes[app.notes.length - 1].text}&rdquo;
          </p>
        )}

        {/* Move action */}
        <div className="mt-2.5 relative">
          <button
            onClick={() => setShowMoveMenu(m => !m)}
            className="w-full rounded-lg border border-surface-border bg-surface-overlay px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition hover:border-slate-600 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
          >
            Move to →
          </button>

          {showMoveMenu && (
            <div className="absolute bottom-full left-0 right-0 z-20 mb-1 rounded-xl border border-surface-border bg-surface-overlay shadow-raised">
              {nextStatuses.map(status => (
                <button
                  key={status}
                  onClick={() => {
                    onStatusChange(app.applicationId, status);
                    setShowMoveMenu(false);
                  }}
                  className="flex w-full items-center px-3 py-2 text-xs text-slate-400 transition hover:bg-surface-subtle hover:text-slate-200 first:rounded-t-xl last:rounded-b-xl focus-visible:outline-none"
                >
                  <StatusBadge status={status} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function KanbanBoard({ applications, onStatusChange }: KanbanBoardProps) {
  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col] = applications.filter(a => a.status === col);
    return acc;
  }, {} as Record<ApplicationStatus, EnrichedApplication[]>);

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-4"
      style={{ minHeight: 'calc(100vh - 160px)' }}
      role="region"
      aria-label="Application Kanban board"
    >
      {COLUMNS.map(col => (
        <div key={col} className="flex w-[210px] shrink-0 flex-col gap-3">
          {/* Column header */}
          <div className={clsx(
            'flex items-center justify-between rounded-xl border px-3 py-2',
            COLUMN_COLORS[col],
            'bg-surface-overlay',
          )}>
            <div className="flex items-center gap-2">
              <StatusBadge status={col} />
            </div>
            <span className="text-xs font-bold text-slate-500">{grouped[col].length}</span>
          </div>

          {/* Cards */}
          <div className="kanban-column">
            {grouped[col].length === 0 ? (
              <div className="py-6 text-center text-[11px] text-slate-600">
                No {col.toLowerCase()} applications
              </div>
            ) : (
              grouped[col].map(app => (
                <ApplicationCard
                  key={app.applicationId}
                  app={app}
                  onStatusChange={onStatusChange}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
