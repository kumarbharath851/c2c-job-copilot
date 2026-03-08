'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { JobAlert } from '@/lib/types/application';

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<JobAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '', keyword: '', c2cFilter: 'any', workMode: 'any',
    skills: '', minRate: '', emailDigest: false, digestFrequency: 'daily'
  });

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => setAlerts(d.alerts || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          skills: form.skills ? form.skills.split(',').map(s => s.trim()) : [],
          minRate: form.minRate ? Number(form.minRate) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create alert');
      setAlerts(prev => [data, ...prev]);
      setShowForm(false);
      setForm({ name: '', keyword: '', c2cFilter: 'any', workMode: 'any', skills: '', minRate: '', emailDigest: false, digestFrequency: 'daily' });
    } catch {
      // TODO: show error
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(alertId: string) {
    const removed = alerts.find(a => a.alertId === alertId);
    setAlerts(prev => prev.filter(a => a.alertId !== alertId));
    try {
      const res = await fetch(`/api/alerts/${alertId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      if (removed) setAlerts(prev => [...prev, removed]);
    }
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Job Alerts</h1>
          <p className="text-sm text-slate-400">Get notified when new matching jobs are found.</p>
        </div>
        <Button variant="primary" size="sm" leftIcon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowForm(f => !f)}>
          New Alert
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="animate-slide-up rounded-2xl border border-brand/20 bg-surface-overlay p-5 space-y-4">
          <p className="text-sm font-bold text-slate-200">Create Alert</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-1.5 block">Alert Name *</label>
              <input className="input" placeholder="Remote C2C Spark roles" required
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5 block">Keyword</label>
              <input className="input" placeholder="Databricks, Iceberg, ..."
                value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5 block">C2C Filter</label>
              <select className="input" value={form.c2cFilter} onChange={e => setForm(f => ({ ...f, c2cFilter: e.target.value }))}>
                <option value="any">Any</option>
                <option value="confirmed">Confirmed C2C</option>
                <option value="confirmed_or_likely">Confirmed or Likely</option>
                <option value="likely">Likely</option>
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Work Mode</label>
              <select className="input" value={form.workMode} onChange={e => setForm(f => ({ ...f, workMode: e.target.value }))}>
                <option value="any">Any</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">Onsite</option>
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Skills (comma-separated)</label>
              <input className="input" placeholder="Spark, dbt, Snowflake"
                value={form.skills} onChange={e => setForm(f => ({ ...f, skills: e.target.value }))} />
            </div>
            <div>
              <label className="label mb-1.5 block">Min Rate ($/hr)</label>
              <input type="number" className="input" placeholder="90"
                value={form.minRate} onChange={e => setForm(f => ({ ...f, minRate: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" className="rounded border-surface-border bg-surface-overlay accent-brand"
                checked={form.emailDigest} onChange={e => setForm(f => ({ ...f, emailDigest: e.target.checked }))} />
              Email digest
            </label>
            {form.emailDigest && (
              <select className="input w-auto" value={form.digestFrequency} onChange={e => setForm(f => ({ ...f, digestFrequency: e.target.value }))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="submit" variant="primary" size="sm" loading={saving}>Save Alert</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Alert list */}
      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 rounded-2xl skeleton" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20">
          <Bell className="h-10 w-10 text-slate-600" />
          <p className="text-sm font-medium text-slate-400">No alerts yet.</p>
          <p className="text-xs text-slate-600">Create your first alert to be notified of new matching jobs.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.alertId} className="flex items-start justify-between gap-3 rounded-2xl border border-surface-border bg-surface-raised p-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-brand/15">
                  <BellRing className="h-4 w-4 text-brand-light" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-100">{alert.name}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-500">
                    {alert.keyword && <span>Keyword: {alert.keyword}</span>}
                    {alert.c2cFilter && alert.c2cFilter !== 'any' && <span>C2C: {alert.c2cFilter}</span>}
                    {alert.workMode && alert.workMode !== 'any' && <span>{alert.workMode}</span>}
                    {alert.minRate && <span>Min ${alert.minRate}/hr</span>}
                    {alert.emailDigest && <span>Email {alert.digestFrequency}</span>}
                    {alert.skills?.length ? <span>Skills: {alert.skills.join(', ')}</span> : null}
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleDelete(alert.alertId)}
                className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                aria-label={`Delete alert ${alert.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
