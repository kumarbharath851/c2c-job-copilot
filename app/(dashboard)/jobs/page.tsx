'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Search, Filter, SlidersHorizontal, RefreshCw, Briefcase } from 'lucide-react';
import { JobCard } from '@/components/jobs/JobCard';
import { Button } from '@/components/ui/Button';
import type { Job } from '@/lib/types/job';

const C2C_OPTIONS = [
  { value: 'any',       label: 'All C2C' },
  { value: 'confirmed', label: 'C2C Confirmed' },
  { value: 'likely',    label: 'C2C Likely' },
  { value: 'unclear',   label: 'Unknown' },
  { value: 'w2only',    label: 'W2 Only' },
];

const WORK_MODE_OPTIONS = [
  { value: 'any',    label: 'Any Location' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'Onsite' },
];

const SORT_OPTIONS = [
  { value: 'ingestedAt', label: 'Most Recent' },
  { value: 'matchScore', label: 'Best Match' },
  { value: 'rate',       label: 'Highest Rate' },
];

export default function JobsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [c2c, setC2c] = useState('any');
  const [workMode, setWorkMode] = useState('any');
  const [sort, setSort] = useState('ingestedAt');
  const [minRate, setMinRate] = useState('');
  const [skills, setSkills] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchJobs = useCallback(async (append = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (keyword) params.set('keyword', keyword);
      if (c2c !== 'any') params.set('c2c', c2c);
      if (workMode !== 'any') params.set('workMode', workMode);
      if (sort) params.set('sort', sort);
      if (minRate) params.set('minRate', minRate);
      if (skills) params.set('skills', skills);
      if (append && cursor) params.set('cursor', cursor);
      params.set('limit', '12');

      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();
      setJobs(prev => append ? [...prev, ...(data.jobs || [])] : (data.jobs || []));
      setTotal(data.total || 0);
      setCursor(data.cursor || null);
    } catch {
      if (!append) setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [keyword, c2c, workMode, sort, minRate, skills, cursor]);

  useEffect(() => {
    const t = setTimeout(() => fetchJobs(false), 300);
    return () => clearTimeout(t);
  }, [keyword, c2c, workMode, sort, minRate, skills]);

  async function handleStatusChange(jobId: string, newStatus: string) {
    await fetch(`/api/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setJobs(prev => prev.map(j => j.jobId === jobId ? { ...j, status: newStatus as 'saved' } : j));
  }

  return (
    <div className="space-y-6 page-enter">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Jobs</h1>
          <p className="text-sm text-slate-400">
            {total > 0 ? `${total} jobs in your list` : 'No jobs yet — paste a URL to get started'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => fetchJobs(false)}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      {/* Search + filter bar */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="input pl-9"
              placeholder="Search by title, company, or keyword…"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              aria-label="Search jobs"
            />
          </div>
          <Button
            variant="secondary"
            size="md"
            leftIcon={<SlidersHorizontal className="h-4 w-4" />}
            onClick={() => setShowFilters(f => !f)}
          >
            Filters {showFilters ? '▲' : '▼'}
          </Button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="animate-slide-up grid grid-cols-2 gap-3 rounded-2xl border border-surface-border bg-surface-overlay p-4 sm:grid-cols-3 lg:grid-cols-5">
            {/* C2C filter */}
            <div>
              <label className="label mb-1.5 block">C2C Status</label>
              <select
                value={c2c}
                onChange={e => setC2c(e.target.value)}
                className="input"
                aria-label="Filter by C2C status"
              >
                {C2C_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Work mode */}
            <div>
              <label className="label mb-1.5 block">Location</label>
              <select
                value={workMode}
                onChange={e => setWorkMode(e.target.value)}
                className="input"
                aria-label="Filter by work mode"
              >
                {WORK_MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Sort */}
            <div>
              <label className="label mb-1.5 block">Sort by</label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="input"
                aria-label="Sort jobs by"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Min rate */}
            <div>
              <label className="label mb-1.5 block">Min Rate ($/hr)</label>
              <input
                type="number"
                className="input"
                placeholder="e.g. 90"
                value={minRate}
                onChange={e => setMinRate(e.target.value)}
                aria-label="Minimum hourly rate filter"
              />
            </div>

            {/* Skills */}
            <div>
              <label className="label mb-1.5 block">Skills (comma-separated)</label>
              <input
                className="input"
                placeholder="Spark, dbt, Snowflake"
                value={skills}
                onChange={e => setSkills(e.target.value)}
                aria-label="Filter by skills"
              />
            </div>
          </div>
        )}
      </div>

      {/* Job grid */}
      {loading && jobs.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 rounded-2xl skeleton" />
          ))}
        </div>
      ) : jobs.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {jobs.map(job => (
              <JobCard
                key={job.jobId}
                job={job}
                onSave={id => handleStatusChange(id, 'saved')}
                onTailor={id => {
                  router.push(`/resume?tailor=${id}`);
                }}
                onViewDetail={id => {
                  router.push(`/jobs/${id}`);
                }}
              />
            ))}
          </div>
          {cursor && (
            <div className="flex justify-center pt-4">
              <Button variant="secondary" onClick={() => fetchJobs(true)} loading={loading}>
                Load More
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 py-20">
          <Briefcase className="h-10 w-10 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">No jobs match your filters.</p>
          <p className="text-xs text-slate-600">Try adjusting the filters or adding new job URLs.</p>
        </div>
      )}
    </div>
  );
}
