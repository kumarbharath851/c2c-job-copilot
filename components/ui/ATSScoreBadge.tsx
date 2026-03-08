'use client';

import type { ATSScore } from '@/lib/ai/scoring';

interface ATSScoreBadgeProps {
  score: ATSScore;
  showBreakdown?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const gradeColors: Record<string, string> = {
  A: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  B: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  C: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  D: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  F: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const likelihoodColors: Record<string, string> = {
  High: 'text-emerald-400',
  Medium: 'text-amber-400',
  Low: 'text-red-400',
};

export function ATSScoreBadge({ score, showBreakdown = false, size = 'md' }: ATSScoreBadgeProps) {
  const gradeClass = gradeColors[score.grade] ?? gradeColors['F'];
  const likelihoodClass = likelihoodColors[score.passLikelihood] ?? 'text-slate-400';

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Main badge row */}
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded border font-semibold ${gradeClass} ${sizeClasses[size]}`}
          title={`ATS Score: ${score.overall}/100 — ${score.passLikelihood} pass likelihood`}
        >
          <span className="font-mono">{score.overall}</span>
          <span className="opacity-60">/100</span>
          <span className="ml-1 font-bold">{score.grade}</span>
        </span>
        <span className={`text-xs font-medium ${likelihoodClass}`}>
          {score.passLikelihood} likelihood
        </span>
      </div>

      {/* Keyword summary */}
      {size !== 'sm' && (
        <p className="text-xs text-slate-400">
          {score.keywordsFound.length} of {score.keywordsFound.length + score.keywordsMissing.length} keywords matched
        </p>
      )}

      {/* Breakdown bars */}
      {showBreakdown && (
        <div className="space-y-1.5 mt-1">
          <BreakdownBar label="Keyword Match" value={score.breakdown.keywordMatch} max={40} />
          <BreakdownBar label="Preferred Skills" value={score.breakdown.preferredMatch} max={20} />
          <BreakdownBar label="Section Structure" value={score.breakdown.sectionStructure} max={15} />
          <BreakdownBar label="Contact Info" value={score.breakdown.contactCompleteness} max={10} />
          <BreakdownBar label="Quantified Impact" value={score.breakdown.quantifiedAchievements} max={10} />
          <BreakdownBar label="Format Signals" value={score.breakdown.formatSignals} max={5} />
        </div>
      )}
    </div>
  );
}

function BreakdownBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  const barColor =
    pct >= 75 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-blue-500' :
    pct >= 25 ? 'bg-amber-500' :
    'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <span className="w-36 text-xs text-slate-400 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs text-slate-300 font-mono">{value}/{max}</span>
    </div>
  );
}

/** Compact inline chip — just grade + score, no breakdown */
export function ATSScoreChip({ score }: { score: ATSScore }) {
  const gradeClass = gradeColors[score.grade] ?? gradeColors['F'];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border text-xs px-1.5 py-0.5 font-semibold ${gradeClass}`}
      title={`ATS: ${score.overall}/100 (${score.passLikelihood} likelihood)`}
    >
      ATS {score.grade}
      <span className="font-normal opacity-70">{score.overall}</span>
    </span>
  );
}

/** Comparison: shows original vs tailored delta */
export function ATSScoreComparison({
  original,
  tailored,
}: {
  original: ATSScore;
  tailored: ATSScore;
}) {
  const delta = tailored.overall - original.overall;
  const deltaSign = delta >= 0 ? '+' : '';
  const deltaColor =
    delta > 5 ? 'text-emerald-400' :
    delta > 0 ? 'text-blue-400' :
    delta === 0 ? 'text-slate-400' :
    'text-red-400';

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">ATS Score Impact</h3>
        <span className={`text-lg font-bold font-mono ${deltaColor}`}>
          {deltaSign}{delta} pts
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Before Tailoring</p>
          <ATSScoreBadge score={original} size="sm" />
        </div>
        <div className="space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide">After Tailoring</p>
          <ATSScoreBadge score={tailored} size="sm" />
        </div>
      </div>

      {/* Breakdown comparison */}
      <div className="space-y-1.5 pt-2 border-t border-slate-700">
        {(
          [
            ['Keyword Match', original.breakdown.keywordMatch, tailored.breakdown.keywordMatch, 40],
            ['Preferred Skills', original.breakdown.preferredMatch, tailored.breakdown.preferredMatch, 20],
            ['Section Structure', original.breakdown.sectionStructure, tailored.breakdown.sectionStructure, 15],
            ['Contact Info', original.breakdown.contactCompleteness, tailored.breakdown.contactCompleteness, 10],
            ['Quantified Impact', original.breakdown.quantifiedAchievements, tailored.breakdown.quantifiedAchievements, 10],
            ['Format Signals', original.breakdown.formatSignals, tailored.breakdown.formatSignals, 5],
          ] as [string, number, number, number][]
        ).map(([label, before, after, max]) => (
          <ComparisonRow key={label} label={label} before={before} after={after} max={max} />
        ))}
      </div>

      {/* Missing keywords */}
      {tailored.keywordsMissing.length > 0 && (
        <div className="pt-2 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-1.5">Still missing keywords:</p>
          <div className="flex flex-wrap gap-1">
            {tailored.keywordsMissing.slice(0, 8).map(kw => (
              <span key={kw} className="text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                {kw}
              </span>
            ))}
            {tailored.keywordsMissing.length > 8 && (
              <span className="text-xs text-slate-500">+{tailored.keywordsMissing.length - 8} more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ComparisonRow({
  label, before, after, max,
}: {
  label: string; before: number; after: number; max: number;
}) {
  const delta = after - before;
  const deltaColor =
    delta > 0 ? 'text-emerald-400' :
    delta < 0 ? 'text-red-400' :
    'text-slate-500';
  const afterPct = Math.round((after / max) * 100);
  const beforePct = Math.round((before / max) * 100);

  return (
    <div className="flex items-center gap-2">
      <span className="w-32 text-xs text-slate-400 truncate">{label}</span>
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden relative">
        {/* before bar (ghost) */}
        <div
          className="absolute h-full rounded-full bg-slate-600"
          style={{ width: `${beforePct}%` }}
        />
        {/* after bar */}
        <div
          className={`absolute h-full rounded-full transition-all duration-500 ${afterPct >= 75 ? 'bg-emerald-500' : afterPct >= 50 ? 'bg-blue-500' : afterPct >= 25 ? 'bg-amber-500' : 'bg-red-500'}`}
          style={{ width: `${afterPct}%` }}
        />
      </div>
      <span className={`w-10 text-right text-xs font-mono ${deltaColor}`}>
        {delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}` : '—'}
      </span>
    </div>
  );
}
