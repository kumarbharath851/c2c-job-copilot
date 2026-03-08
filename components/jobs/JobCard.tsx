'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { MapPin, Clock, ExternalLink, Sparkles, ChevronRight, Building2 } from 'lucide-react';
import type { Job } from '@/lib/types/job';
import { C2CBadge, RateBadge, ScoreBadge, SkillPill } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface JobCardProps {
  job: Job;
  onSave?: (jobId: string) => void;
  onApply?: (jobId: string) => void;
  onTailor?: (jobId: string) => void;
  onViewDetail?: (jobId: string) => void;
  compact?: boolean;
}

export function JobCard({
  job,
  onSave,
  onApply,
  onTailor,
  onViewDetail,
  compact = false,
}: JobCardProps) {
  const [saved, setSaved] = useState(job.status !== 'new');

  const topSkills = job.requiredSkills.slice(0, compact ? 3 : 5);
  const extraCount = job.requiredSkills.length - topSkills.length;

  const recommendation = job.score?.recommendation;
  const overallScore = job.score?.overall;

  return (
    <article
      className={clsx(
        'group relative rounded-2xl border bg-surface-raised transition-all duration-150',
        'hover:border-surface-border/60 hover:shadow-raised',
        job.isDuplicate ? 'border-amber-500/30 opacity-80' : 'border-surface-border',
        compact ? 'p-4' : 'p-5',
      )}
    >
      {/* Duplicate warning */}
      {job.isDuplicate && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400">
          <span>Duplicate posting detected</span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Company logo placeholder */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-overlay ring-1 ring-surface-border">
          <Building2 className="h-5 w-5 text-slate-500" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <h3
              className="truncate text-sm font-bold text-slate-100 group-hover:text-brand-light transition-colors cursor-pointer"
              onClick={() => onViewDetail?.(job.jobId)}
            >
              {job.title}
            </h3>
            {recommendation && (
              <span className={clsx(
                'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                recommendation === 'Apply' && 'bg-emerald-500/15 text-emerald-400',
                recommendation === 'Maybe' && 'bg-amber-500/15 text-amber-400',
                recommendation === 'Skip' && 'bg-red-500/15 text-red-400',
              )}>
                {recommendation}
              </span>
            )}
          </div>
          <p className="truncate text-xs font-medium text-slate-400">{job.company}</p>
        </div>

        {/* Score badge */}
        {overallScore !== undefined && (
          <div className="shrink-0">
            <ScoreBadge score={overallScore} label="match" size="sm" />
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <C2CBadge status={job.c2cStatus} confidence={job.c2cConfidence} size="xs" />
        <RateBadge min={job.rateMin} max={job.rateMax} />
        <span className="flex items-center gap-1 text-[11px] text-slate-500">
          <MapPin className="h-3 w-3" />
          {job.location}
        </span>
        <span className={clsx(
          'text-[11px] font-medium',
          job.workMode === 'remote' ? 'text-emerald-400' : job.workMode === 'hybrid' ? 'text-amber-400' : 'text-slate-400'
        )}>
          {job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1)}
        </span>
        {job.contractDuration && (
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock className="h-3 w-3" />
            {job.contractDuration}
          </span>
        )}
      </div>

      {/* Skills row */}
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {topSkills.map(skill => (
            <SkillPill key={skill.name} name={skill.name} />
          ))}
          {extraCount > 0 && (
            <span className="text-[11px] text-slate-500">+{extraCount} more</span>
          )}
        </div>
      )}

      {/* Missing skills warning */}
      {job.score?.missingRequirements?.length ? (
        <div className="mt-3 rounded-lg bg-red-500/8 px-3 py-2 text-[11px] text-red-400">
          Missing: {job.score.missingRequirements.slice(0, 3).join(', ')}
          {job.score.missingRequirements.length > 3 && ` +${job.score.missingRequirements.length - 3} more`}
        </div>
      ) : null}

      {/* C2C signals excerpt */}
      {job.visaWording && !compact && (
        <p className="mt-2 line-clamp-1 text-[11px] italic text-slate-500">
          &ldquo;{job.visaWording}&rdquo;
        </p>
      )}

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2 border-t border-surface-border pt-3">
        <Button
          size="xs"
          variant="primary"
          leftIcon={<Sparkles className="h-3 w-3" />}
          onClick={() => onTailor?.(job.jobId)}
        >
          Tailor Resume
        </Button>
        <Button
          size="xs"
          variant="secondary"
          onClick={() => {
            setSaved(true);
            onSave?.(job.jobId);
          }}
          disabled={saved}
        >
          {saved ? 'Saved' : 'Save'}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {job.sourceUrl && (
            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="View original posting"
              className="rounded-lg p-1.5 text-slate-500 transition hover:bg-surface-overlay hover:text-slate-300"
              aria-label="View original job posting"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <button
            onClick={() => onViewDetail?.(job.jobId)}
            className="flex items-center gap-0.5 text-[11px] font-medium text-brand-light hover:text-brand-light/80 transition"
            aria-label="View job detail"
          >
            Detail <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Posted date */}
      {job.ingestedAt && (
        <p className="mt-1.5 text-[10px] text-slate-600">
          Added {new Date(job.ingestedAt).toLocaleDateString()}
        </p>
      )}
    </article>
  );
}
