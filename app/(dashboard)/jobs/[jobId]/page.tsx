'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { clsx } from 'clsx';
import {
  ArrowLeft, MapPin, Building2, Clock, DollarSign, Briefcase,
  Sparkles, Send, Copy, Check, ExternalLink, CheckCircle2,
  AlertTriangle, Zap, User, ChevronRight, FileText,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { C2CBadge, ScoreBadge } from '@/components/ui/Badge';
import type { Job } from '@/lib/types/job';
import type { Resume } from '@/lib/types/resume';
import { apiFetch } from '@/lib/api';

export default function JobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<Job | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Apply state
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Outreach state
  const [outreachResumeId, setOutreachResumeId] = useState('');
  const [recruiterName, setRecruiterName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [outreachMsg, setOutreachMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [outreachError, setOutreachError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [jobRes, resumesRes] = await Promise.all([
          apiFetch(`/api/jobs/${jobId}`),
          apiFetch('/api/resumes'),
        ]);
        if (!jobRes.ok) { setNotFound(true); return; }
        const jobData = await jobRes.json();
        const resumesData = await resumesRes.json();
        setJob(jobData);
        const resumeList: Resume[] = resumesData.resumes || [];
        setResumes(resumeList);
        if (resumeList.length > 0) setOutreachResumeId(resumeList[0].resumeId);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [jobId]);

  async function handleApply() {
    setApplying(true);
    setApplyError(null);
    try {
      const res = await apiFetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'Applied' }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to create application');
      }
      setApplied(true);
      // Open original job URL in a new tab so they can actually submit
      if (job?.sourceUrl) window.open(job.sourceUrl, '_blank', 'noopener');
      setTimeout(() => router.push('/applications'), 1500);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply');
    } finally {
      setApplying(false);
    }
  }

  async function handleGenerateOutreach() {
    if (!outreachResumeId) { setOutreachError('Upload a resume first'); return; }
    setGenerating(true);
    setOutreachError(null);
    setOutreachMsg(null);
    try {
      const res = await apiFetch('/api/outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, resumeId: outreachResumeId, recruiterName: recruiterName || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setOutreachMsg(data.message);
    } catch (err) {
      setOutreachError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  function handleCopyOutreach() {
    if (!outreachMsg) return;
    navigator.clipboard.writeText(outreachMsg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Loading / Not Found ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 page-enter">
        <div className="h-8 w-40 rounded skeleton" />
        <div className="h-32 rounded-2xl skeleton" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 rounded-2xl skeleton" />
            <div className="h-64 rounded-2xl skeleton" />
          </div>
          <div className="h-96 rounded-2xl skeleton" />
        </div>
      </div>
    );
  }

  if (notFound || !job) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <Briefcase className="h-10 w-10 text-slate-600" />
        <p className="text-sm font-medium text-slate-400">Job not found.</p>
        <Link href="/jobs"><Button variant="secondary" size="sm">← Back to Jobs</Button></Link>
      </div>
    );
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  const rateLabel = job.rateMin && job.rateMax
    ? `$${job.rateMin}–$${job.rateMax}/hr`
    : job.rateMin
      ? `$${job.rateMin}+/hr`
      : null;

  const c2cColor = {
    confirmed: 'text-emerald-400',
    likely:    'text-emerald-300',
    unclear:   'text-slate-400',
    w2only:    'text-red-400',
    unknown:   'text-slate-500',
  }[job.c2cStatus ?? 'unknown'] ?? 'text-slate-500';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skillName = (s: any) => typeof s === 'string' ? s : (s?.name ?? s?.skill ?? String(s));

  return (
    <div className="space-y-6 page-enter">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/jobs" className="flex items-center gap-1 hover:text-slate-300 transition">
          <ArrowLeft className="h-3.5 w-3.5" /> Jobs
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-slate-400 truncate max-w-xs">{job.title}</span>
      </div>

      {/* Header card */}
      <div className="rounded-2xl border border-surface-border bg-surface-raised p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <C2CBadge status={job.c2cStatus} size="sm" />
              {job.score?.overall !== undefined && <ScoreBadge score={job.score.overall} size="sm" />}
              {job.sourceName && (
                <span className="rounded-md bg-surface-overlay px-2 py-0.5 text-xs text-slate-500 border border-surface-border">
                  {job.sourceName}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-100 leading-snug">{job.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{job.company}</span>
              <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
              {rateLabel && <span className="flex items-center gap-1.5 text-emerald-400 font-medium"><DollarSign className="h-3.5 w-3.5" />{rateLabel}</span>}
              {job.workMode && <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" />{job.workMode}</span>}
              {job.contractDuration && <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{job.contractDuration}</span>}
            </div>
          </div>
          {job.sourceUrl && (
            <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" rightIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                View Original
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Main layout: content + sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* ── Left: content ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Match score breakdown */}
          {job.score && (
            <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Zap className="h-4 w-4 text-brand-light" /> Match Analysis
              </h2>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'Overall', value: job.score.overall },
                  { label: 'Must-Haves', value: job.score.mustHaveMatch },
                  { label: 'Preferred', value: job.score.preferredMatch },
                ].map(({ label, value }) => value !== undefined && (
                  <div key={label} className="rounded-xl bg-surface-overlay p-3 border border-surface-border">
                    <p className={clsx('text-2xl font-extrabold tabular-nums',
                      value >= 70 ? 'text-emerald-400' : value >= 50 ? 'text-amber-400' : 'text-red-400'
                    )}>{value}%</p>
                    <p className="text-xs text-slate-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {job.score.recommendation && (
                <p className="mt-3 text-xs text-slate-400 italic">{job.score.recommendation}</p>
              )}
            </div>
          )}

          {/* C2C Analysis */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
            <h2 className="mb-3 text-sm font-semibold text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" /> C2C / Contract Analysis
            </h2>
            <div className="flex items-center gap-3 mb-3">
              <span className={clsx('text-sm font-semibold capitalize', c2cColor)}>
                {job.c2cStatus ?? 'Unknown'}
              </span>
              {job.c2cConfidence !== undefined && (
                <span className="text-xs text-slate-500">{job.c2cConfidence}% confidence</span>
              )}
            </div>
            {job.c2cSignals && job.c2cSignals.length > 0 && (
              <ul className="space-y-1.5">
                {job.c2cSignals.map((sig, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
                    {typeof sig === 'string' ? sig : JSON.stringify(sig)}
                  </li>
                ))}
              </ul>
            )}
            {job.visaWording && (
              <p className="mt-3 text-xs italic text-slate-500 border-t border-surface-border pt-3">
                &ldquo;{job.visaWording}&rdquo;
              </p>
            )}
          </div>

          {/* Skills */}
          {((job.requiredSkills?.length ?? 0) > 0 || (job.preferredSkills?.length ?? 0) > 0) && (
            <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-300 flex items-center gap-2">
                <FileText className="h-4 w-4 text-brand-light" /> Skills
              </h2>
              {(job.requiredSkills?.length ?? 0) > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Required</p>
                  <div className="flex flex-wrap gap-2">
                    {job.requiredSkills!.map((s, i) => (
                      <span key={i} className="rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand-light">
                        {skillName(s)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(job.preferredSkills?.length ?? 0) > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-400 uppercase tracking-wider">Preferred</p>
                  <div className="flex flex-wrap gap-2">
                    {job.preferredSkills!.map((s, i) => (
                      <span key={i} className="rounded-lg border border-surface-border bg-surface-overlay px-2.5 py-1 text-xs text-slate-400">
                        {skillName(s)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {job.rawDescription && (
            <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
              <h2 className="mb-3 text-sm font-semibold text-slate-300">Full Description</h2>
              <pre className="whitespace-pre-wrap text-xs text-slate-400 leading-relaxed font-sans overflow-auto max-h-96">
                {job.rawDescription}
              </pre>
            </div>
          )}
        </div>

        {/* ── Right: action sidebar ─────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Apply CTA */}
          <div className="rounded-2xl border border-brand/20 bg-surface-raised p-5 shadow-glow">
            <h2 className="mb-1 text-sm font-semibold text-slate-200">Ready to apply?</h2>
            <p className="mb-4 text-xs text-slate-500">
              Marks as Applied in your tracker and opens the original posting.
            </p>

            {applied ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
                Applied! Redirecting to tracker…
              </div>
            ) : (
              <Button
                variant="primary"
                size="md"
                className="w-full"
                loading={applying}
                onClick={handleApply}
                leftIcon={<Send className="h-3.5 w-3.5" />}
              >
                Apply Now
              </Button>
            )}

            {applyError && (
              <p className="mt-2 flex items-center gap-1 text-xs text-red-400">
                <AlertTriangle className="h-3.5 w-3.5" /> {applyError}
              </p>
            )}

            <div className="mt-3 border-t border-surface-border pt-3 space-y-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => router.push(`/resume?tailor=${jobId}`)}
              >
                Tailor Resume First
              </Button>
              {job.sourceUrl && (
                <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <Button variant="ghost" size="sm" className="w-full" rightIcon={<ExternalLink className="h-3.5 w-3.5" />}>
                    Open Job Posting
                  </Button>
                </a>
              )}
            </div>
          </div>

          {/* Outreach Generator */}
          <div className="rounded-2xl border border-surface-border bg-surface-raised p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-200 flex items-center gap-2">
              <User className="h-4 w-4 text-brand-light" /> Recruiter Outreach
            </h2>
            <p className="mb-4 text-xs text-slate-500">
              Generate a personalized LinkedIn message or email to the recruiter.
            </p>

            {resumes.length === 0 ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-xs text-amber-400 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>Upload a resume on the <Link href="/resume" className="underline">Resume page</Link> first.</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="label mb-1 block">Resume</label>
                  <select
                    className="input"
                    value={outreachResumeId}
                    onChange={e => setOutreachResumeId(e.target.value)}
                  >
                    {resumes.map(r => (
                      <option key={r.resumeId} value={r.resumeId}>
                        {r.fileName || r.resumeId}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label mb-1 block">Recruiter name <span className="text-slate-600">(optional)</span></label>
                  <input
                    className="input"
                    placeholder="e.g. Sarah"
                    value={recruiterName}
                    onChange={e => setRecruiterName(e.target.value)}
                  />
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  loading={generating}
                  onClick={handleGenerateOutreach}
                  leftIcon={<Sparkles className="h-3.5 w-3.5" />}
                >
                  Generate Message
                </Button>

                {outreachError && (
                  <p className="flex items-center gap-1 text-xs text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" />{outreachError}
                  </p>
                )}

                {outreachMsg && (
                  <div className="mt-1">
                    <div className="rounded-xl border border-surface-border bg-surface-overlay p-3 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-48 overflow-auto">
                      {outreachMsg}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={handleCopyOutreach}
                      leftIcon={copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    >
                      {copied ? 'Copied!' : 'Copy to clipboard'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
