'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Check, X, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import type { TailoredResume, ResumeDiffSection, ChangeType } from '@/lib/types/resume';
import { Button } from '@/components/ui/Button';
import { ATSScoreComparison, ATSScoreBadge } from '@/components/ui/ATSScoreBadge';

const CHANGE_LABELS: Record<ChangeType, string> = {
  rephrase:              'Rephrased',
  reorder:               'Reordered',
  rename_tool:            'Renamed tool',
  condense:              'Condensed',
  emphasize:             'Emphasized',
  add_metric_placeholder: 'Metric placeholder added',
  reorder_and_rename:    'Reordered & renamed',
  strengthen_summary:    'Summary strengthened',
};

const CHANGE_COLORS: Record<ChangeType, string> = {
  rephrase:              'text-sky-400 bg-sky-500/10',
  reorder:               'text-violet-400 bg-violet-500/10',
  rename_tool:            'text-indigo-400 bg-indigo-500/10',
  condense:              'text-slate-400 bg-slate-500/10',
  emphasize:             'text-amber-400 bg-amber-500/10',
  add_metric_placeholder: 'text-orange-400 bg-orange-500/10',
  reorder_and_rename:    'text-indigo-400 bg-indigo-500/10',
  strengthen_summary:    'text-emerald-400 bg-emerald-500/10',
};

interface DiffSectionProps {
  section: ResumeDiffSection;
  index: number;
  onAccept: (index: number) => void;
  onReject: (index: number) => void;
}

function DiffSection({ section, index, onAccept, onReject }: DiffSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const original = Array.isArray(section.original) ? section.original.join(', ') : section.original;
  const tailored = Array.isArray(section.tailored) ? section.tailored.join(', ') : section.tailored;
  const isPending = section.accepted === null || section.accepted === undefined;

  return (
    <div
      className={clsx(
        'rounded-2xl border p-4 transition-all',
        section.accepted === true && 'border-emerald-500/30 bg-emerald-500/5',
        section.accepted === false && 'border-red-500/30 bg-red-500/5 opacity-60',
        isPending && 'border-surface-border bg-surface-raised',
      )}
    >
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-200">
            {section.sectionName.replace(/_/g, ' ')}
          </span>
          <span className={clsx(
            'shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase',
            CHANGE_COLORS[section.changeType],
          )}>
            {CHANGE_LABELS[section.changeType] || section.changeType}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isPending ? (
            <>
              <Button
                size="xs"
                variant="success"
                leftIcon={<Check className="h-3 w-3" />}
                onClick={() => onAccept(index)}
                aria-label={`Accept change to ${section.sectionName}`}
              >
                Accept
              </Button>
              <Button
                size="xs"
                variant="danger"
                leftIcon={<X className="h-3 w-3" />}
                onClick={() => onReject(index)}
                aria-label={`Reject change to ${section.sectionName}`}
              >
                Reject
              </Button>
            </>
          ) : (
            <span className={clsx(
              'text-xs font-semibold',
              section.accepted ? 'text-emerald-400' : 'text-red-400',
            )}>
              {section.accepted ? '✓ Accepted' : '✗ Rejected'}
            </span>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            aria-label={expanded ? 'Collapse section' : 'Expand section'}
            className="rounded-md p-1 text-slate-500 hover:text-slate-300 transition"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-3 animate-fade-in">
          {/* Diff comparison */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Before</p>
              <div className="rounded-lg bg-red-500/8 p-3 ring-1 ring-red-500/20">
                <p className="text-xs text-red-300 leading-relaxed">{original}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">After</p>
              <div className="rounded-lg bg-emerald-500/8 p-3 ring-1 ring-emerald-500/20">
                <p className="text-xs text-emerald-300 leading-relaxed">{tailored}</p>
              </div>
            </div>
          </div>

          {/* AI explanation */}
          <div className="flex items-start gap-2 rounded-xl bg-surface-overlay px-3 py-2.5">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-light" />
            <p className="text-[11px] text-slate-400 leading-relaxed">{section.explanation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

interface ResumeDiffViewerProps {
  tailoredResume: TailoredResume;
  onSaveAccepted?: () => void;
}

export function ResumeDiffViewer({ tailoredResume, onSaveAccepted }: ResumeDiffViewerProps) {
  const [sections, setSections] = useState<ResumeDiffSection[]>(tailoredResume.diff);

  const handleAccept = (index: number) => {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, accepted: true } : s));
  };

  const handleReject = (index: number) => {
    setSections(prev => prev.map((s, i) => i === index ? { ...s, accepted: false } : s));
  };

  const acceptAll = () => setSections(prev => prev.map(s => ({ ...s, accepted: true })));
  const rejectAll = () => setSections(prev => prev.map(s => ({ ...s, accepted: false })));

  const acceptedCount = sections.filter(s => s.accepted === true).length;
  const pendingCount = sections.filter(s => s.accepted === null || s.accepted === undefined).length;

  if (tailoredResume.status === 'generating') {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-surface-border border-t-brand" />
        <p className="text-sm text-slate-400">AI is tailoring your resume…</p>
        <p className="text-xs text-slate-600">This usually takes 10–30 seconds</p>
      </div>
    );
  }

  if (tailoredResume.status === 'error') {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
        <p className="text-sm font-semibold text-red-400">Tailoring failed</p>
        <p className="mt-1 text-xs text-slate-500">Please try again or adjust your resume and retry.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-overlay p-4">
        <div>
          <p className="text-sm font-bold text-slate-100">Resume Diff Review</p>
          <p className="text-xs text-slate-400">
            {sections.length} suggested changes ·{' '}
            <span className="text-emerald-400">{acceptedCount} accepted</span>
            {pendingCount > 0 && (
              <> · <span className="text-amber-400">{pendingCount} pending</span></>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Baseline ATS chip while tailoring is in-progress */}
          {tailoredResume.originalAtsScore && !tailoredResume.atsScore && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Baseline ATS</span>
              <ATSScoreBadge score={tailoredResume.originalAtsScore} size="sm" />
            </div>
          )}
          <Button size="xs" variant="secondary" onClick={rejectAll}>Reject All</Button>
          <Button size="xs" variant="success" onClick={acceptAll}>Accept All</Button>
          <Button
            size="xs"
            variant="primary"
            onClick={onSaveAccepted}
            disabled={pendingCount > 0}
          >
            Save & Export
          </Button>
        </div>
      </div>

      {/* ATS Score comparison — only when both scores are available */}
      {tailoredResume.originalAtsScore && tailoredResume.atsScore && (
        <ATSScoreComparison
          original={tailoredResume.originalAtsScore}
          tailored={tailoredResume.atsScore}
        />
      )}

      {/* Missing skills warning */}
      {tailoredResume.missingSkillsWarning?.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-amber-300">Skills not in your resume</p>
            <p className="mt-0.5 text-xs text-slate-400">
              These required skills appear in the JD but are missing from your resume.{' '}
              <strong className="text-amber-400">We did not add them.</strong> Add only if you genuinely have the experience.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tailoredResume.missingSkillsWarning.map(skill => (
                <span key={skill} className="rounded-md bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400 ring-1 ring-amber-500/25">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overall AI guidance */}
      {tailoredResume.overallGuidance && (
        <div className="flex items-start gap-3 rounded-2xl border border-brand/20 bg-brand/5 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-light" />
          <div>
            <p className="text-sm font-semibold text-brand-light">Overall Guidance</p>
            <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{tailoredResume.overallGuidance}</p>
          </div>
        </div>
      )}

      {/* Diff sections */}
      <div className="space-y-3">
        {sections.map((section, i) => (
          <DiffSection
            key={`${section.sectionName}-${i}`}
            section={section}
            index={i}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        ))}
      </div>
    </div>
  );
}
