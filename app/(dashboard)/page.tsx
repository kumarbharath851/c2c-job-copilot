'use client';

import { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import {
  Briefcase, KanbanSquare, Sparkles, TrendingUp,
  AlarmClock, CheckCircle2, XCircle, Trophy,
  ArrowRight, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { C2CBadge, ScoreBadge } from '@/components/ui/Badge';
import type { Job } from '@/lib/types/job';
import type { Application } from '@/lib/types/application';

interface DashboardMetrics {
  newJobs: number;
  totalJobs: number;
  applied: number;
  interviews: number;
  offers: number;
  avgMatchScore: number;
  c2cConfirmed: number;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <div className="stat-card">
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        <div className={clsx('flex h-8 w-8 items-center justify-center rounded-xl', color)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-100">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="stat-card animate-pulse">
      <div className="h-3 w-20 rounded skeleton mb-2" />
      <div className="h-7 w-12 rounded skeleton mb-1" />
      <div className="h-2 w-16 rounded skeleton" />
    </div>
  );
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingestUrl, setIngestUrl] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingestResult, setIngestResult] = useState<{ title?: string; c2cStatus?: string } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [jobsRes, appsRes] = await Promise.all([
          fetch('/api/jobs?limit=5&sort=ingestedAt'),
          fetch('/api/applications'),
        ]);
        const jobsData = await jobsRes.json();
        const appsData = await appsRes.json();

        const jobs: Job[] = jobsData.jobs || [];
        const apps: Application[] = appsData.applications || [];

        const newJobs = jobs.filter(j => j.status === 'new').length;
        const c2cConfirmed = jobs.filter(j => j.c2cStatus === 'confirmed' || j.c2cStatus === 'likely').length;
        const applied = apps.filter(a => a.status === 'Applied').length;
        const interviews = apps.filter(a => a.status === 'Interview').length;
        const offers = apps.filter(a => a.status === 'Offer').length;
        const scored = jobs.filter(j => j.score?.overall);
        const avgMatchScore = scored.length > 0
          ? Math.round(scored.reduce((s, j) => s + (j.score?.overall || 0), 0) / scored.length)
          : 0;

        setMetrics({
          newJobs,
          totalJobs: jobsData.total || 0,
          applied,
          interviews,
          offers,
          avgMatchScore,
          c2cConfirmed,
        });
        setRecentJobs(jobs.slice(0, 4));
      } catch {
        // Demo fallback metrics
        setMetrics({ newJobs: 14, totalJobs: 47, applied: 8, interviews: 3, offers: 1, avgMatchScore: 78, c2cConfirmed: 22 });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!ingestUrl.trim()) return;
    setIngesting(true);
    setIngestResult(null);
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ingestUrl }),
      });
      const data = await res.json();
      setIngestResult(data);
      setIngestUrl('');
    } catch {
      setIngestResult({ title: 'Error ingesting job. Try pasting the text instead.' });
    } finally {
      setIngesting(false);
    }
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-8 page-enter">
      {/* Welcome banner */}
      <div className="rounded-2xl border border-brand/20 bg-gradient-to-r from-brand/10 via-surface-overlay to-surface-raised p-6 shadow-glow">
        <h1 className="text-xl font-bold text-slate-100">
          {greeting}.{' '}
          {metrics && metrics.newJobs > 0 ? (
            <span className="text-brand-light">{metrics.newJobs} new C2C Data Engineer roles</span>
          ) : (
            <span className="text-brand-light">Your job search dashboard</span>
          )} match your profile.
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          {metrics?.c2cConfirmed ?? '—'} roles with confirmed or likely C2C status.{' '}
          {metrics?.avgMatchScore ? `Average match score: ${metrics.avgMatchScore}%.` : ''}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/jobs">
            <Button size="sm" variant="primary" rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
              Browse Jobs
            </Button>
          </Link>
          <Link href="/resume">
            <Button size="sm" variant="secondary">Upload Resume</Button>
          </Link>
        </div>
      </div>

      {/* Metrics grid */}
      <section aria-label="Dashboard metrics">
        <h2 className="sr-only">Key metrics</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          ) : metrics ? (
            <>
              <MetricCard label="New Jobs"      value={metrics.newJobs}       icon={Briefcase}    color="bg-brand/15 text-brand-light"    sub="today" />
              <MetricCard label="Total Jobs"    value={metrics.totalJobs}     icon={TrendingUp}   color="bg-indigo-500/15 text-indigo-400" sub="all time" />
              <MetricCard label="C2C Eligible"  value={metrics.c2cConfirmed}  icon={CheckCircle2} color="bg-emerald-500/15 text-emerald-400" sub="confirmed or likely" />
              <MetricCard label="Applied"       value={metrics.applied}       icon={AlarmClock}   color="bg-sky-500/15 text-sky-400"       sub="in tracker" />
              <MetricCard label="Interviews"    value={metrics.interviews}    icon={KanbanSquare} color="bg-violet-500/15 text-violet-400" sub="active" />
              <MetricCard label="Offers"        value={metrics.offers}        icon={Trophy}       color="bg-amber-500/15 text-amber-400"   sub="🎉" />
            </>
          ) : null}
        </div>
      </section>

      {/* Quick ingest */}
      <section>
        <h2 className="mb-3 section-title">Add a Job</h2>
        <form onSubmit={handleIngest} className="flex gap-3">
          <input
            className="input flex-1"
            placeholder="Paste a job URL (Greenhouse, Lever, LinkedIn, or any public link)…"
            value={ingestUrl}
            onChange={e => setIngestUrl(e.target.value)}
            aria-label="Job URL to ingest"
            type="url"
          />
          <Button type="submit" variant="primary" loading={ingesting} leftIcon={<Plus className="h-3.5 w-3.5" />}>
            Add
          </Button>
        </form>
        {ingestResult && (
          <div className={clsx(
            'mt-2 rounded-xl border px-4 py-3 text-sm animate-slide-up',
            ingestResult.c2cStatus
              ? 'border-emerald-500/30 bg-emerald-500/8 text-emerald-300'
              : 'border-red-500/30 bg-red-500/8 text-red-400'
          )}>
            {ingestResult.c2cStatus ? (
              <>
                <span className="font-semibold">{ingestResult.title}</span>{' '}
                added · <C2CBadge status={ingestResult.c2cStatus as 'confirmed'} size="xs" />
              </>
            ) : ingestResult.title}
          </div>
        )}
      </section>

      {/* Recent jobs */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">Recent Jobs</h2>
          <Link href="/jobs" className="text-xs font-medium text-brand-light hover:underline">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl skeleton" />
            ))}
          </div>
        ) : recentJobs.length > 0 ? (
          <div className="space-y-3">
            {recentJobs.map(job => (
              <div key={job.jobId} className="flex items-center gap-4 rounded-2xl border border-surface-border bg-surface-raised px-4 py-3 transition hover:border-slate-600">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{job.title}</p>
                  <p className="truncate text-xs text-slate-400">{job.company} · {job.location}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <C2CBadge status={job.c2cStatus} size="xs" />
                  {job.score?.overall !== undefined && <ScoreBadge score={job.score.overall} size="sm" />}
                </div>
                <Link href={`/jobs`} className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-slate-300 transition">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-surface-border bg-surface-raised py-12 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-3 text-sm font-medium text-slate-400">No jobs yet.</p>
            <p className="mt-1 text-xs text-slate-600">Paste a job URL above to get started.</p>
          </div>
        )}
      </section>
    </div>
  );
}
