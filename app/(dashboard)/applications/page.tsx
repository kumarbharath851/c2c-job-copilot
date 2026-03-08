'use client';

import { useState, useEffect } from 'react';
import { KanbanSquare, Plus, BarChart3 } from 'lucide-react';
import { KanbanBoard } from '@/components/applications/KanbanBoard';
import { Button } from '@/components/ui/Button';
import type { Application, ApplicationStatus } from '@/lib/types/application';

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

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<EnrichedApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  useEffect(() => {
    fetch('/api/applications')
      .then(r => r.json())
      .then(d => setApplications(d.applications || []))
      .catch(() => setApplications([]))
      .finally(() => setLoading(false));
  }, []);

  async function handleStatusChange(appId: string, newStatus: ApplicationStatus) {
    // Optimistic update
    setApplications(prev =>
      prev.map(a => a.applicationId === appId ? { ...a, status: newStatus } : a)
    );

    try {
      await fetch(`/api/applications/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch {
      // Revert on failure — refetch
      const res = await fetch('/api/applications');
      const data = await res.json();
      setApplications(data.applications || []);
    }
  }

  // Summary counts
  const counts = {
    applied: applications.filter(a => a.status === 'Applied').length,
    interviews: applications.filter(a => a.status === 'Interview').length,
    offers: applications.filter(a => a.status === 'Offer').length,
  };

  return (
    <div className="space-y-6 page-enter">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Applications</h1>
          <p className="text-sm text-slate-400">
            {applications.length} applications ·{' '}
            <span className="text-indigo-400">{counts.applied} applied</span> ·{' '}
            <span className="text-emerald-400">{counts.interviews} interviews</span>
            {counts.offers > 0 && (
              <> · <span className="text-amber-400">{counts.offers} offers 🎉</span></>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={view === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            leftIcon={<KanbanSquare className="h-3.5 w-3.5" />}
            onClick={() => setView('kanban')}
          >
            Kanban
          </Button>
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            leftIcon={<BarChart3 className="h-3.5 w-3.5" />}
            onClick={() => setView('list')}
          >
            List
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => window.location.href = '/dashboard/jobs'}
          >
            Add Application
          </Button>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-border border-t-brand" />
        </div>
      ) : view === 'kanban' ? (
        <KanbanBoard
          applications={applications}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <div className="space-y-2">
          {applications.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-slate-500">
              <KanbanSquare className="h-10 w-10" />
              <p className="text-sm font-medium">No applications yet.</p>
              <p className="text-xs text-slate-600">Save or apply to a job to track it here.</p>
            </div>
          ) : (
            applications.map(app => (
              <div
                key={app.applicationId}
                className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-raised px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-100">
                    {app.job?.title || 'Data Engineer'}
                  </p>
                  <p className="truncate text-xs text-slate-400">{app.job?.company}</p>
                </div>
                <p className="text-xs text-slate-500">
                  {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : '—'}
                </p>
                <select
                  value={app.status}
                  onChange={e => handleStatusChange(app.applicationId, e.target.value as ApplicationStatus)}
                  className="rounded-lg border border-surface-border bg-surface-overlay px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-2 focus:ring-brand/40"
                  aria-label={`Status for ${app.job?.title}`}
                >
                  {(['Saved','Reviewing','Tailored','Applied','Interview','Rejected','Offer'] as ApplicationStatus[]).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
