'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { Save, User, Shield, Bell, Palette } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function SettingsPage() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('Profile');

  const [profile, setProfile] = useState({
    name: '', email: '', targetTitle: 'Senior Data Engineer',
    targetRate: '', llcName: '', visaStatus: '',
    workMode: ['remote'],
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await new Promise(r => setTimeout(r, 800)); // Placeholder until /api/settings is implemented
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-8 page-enter">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-sm text-slate-400">Configure your profile and preferences.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Nav */}
        <nav className="space-y-1" aria-label="Settings navigation">
          {[
            { icon: User,    label: 'Profile' },
            { icon: Shield,  label: 'Privacy' },
            { icon: Bell,    label: 'Notifications' },
            { icon: Palette, label: 'Appearance' },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => setActiveTab(label)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition hover:bg-surface-overlay hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
                activeTab === label
                  ? 'bg-brand/15 text-brand-light font-semibold'
                  : 'text-slate-400',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {/* Tab content */}
        {activeTab === 'Profile' ? (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="card space-y-5">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <User className="h-4 w-4 text-brand-light" />
                Profile
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label mb-1.5 block" htmlFor="name">Full Name</label>
                  <input id="name" className="input" placeholder="Arjun Mehta"
                    value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1.5 block" htmlFor="email">Email</label>
                  <input id="email" type="email" className="input" placeholder="arjun@yourdomain.com"
                    value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1.5 block" htmlFor="targetTitle">Target Title</label>
                  <input id="targetTitle" className="input"
                    value={profile.targetTitle} onChange={e => setProfile(p => ({ ...p, targetTitle: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1.5 block" htmlFor="targetRate">Target Rate ($/hr)</label>
                  <input id="targetRate" type="number" className="input" placeholder="110"
                    value={profile.targetRate} onChange={e => setProfile(p => ({ ...p, targetRate: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1.5 block" htmlFor="llcName">LLC / Entity Name</label>
                  <input id="llcName" className="input" placeholder="Mehta Data Solutions LLC"
                    value={profile.llcName} onChange={e => setProfile(p => ({ ...p, llcName: e.target.value }))} />
                </div>
                <div>
                  <label className="label mb-1.5 block" htmlFor="visaStatus">Visa / Work Auth Status</label>
                  <select id="visaStatus" className="input"
                    value={profile.visaStatus} onChange={e => setProfile(p => ({ ...p, visaStatus: e.target.value }))}>
                    <option value="">Select…</option>
                    <option value="us_citizen">US Citizen</option>
                    <option value="green_card">Green Card</option>
                    <option value="h1b">H-1B</option>
                    <option value="ead">EAD (OPT/STEM/H4)</option>
                    <option value="tn">TN Visa</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label mb-2 block">Preferred Work Mode</label>
                <div className="flex flex-wrap gap-2">
                  {['remote', 'hybrid', 'onsite'].map(mode => (
                    <label key={mode} className="flex cursor-pointer items-center gap-2 rounded-xl border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-slate-300 transition hover:border-brand/40 hover:bg-brand/5">
                      <input
                        type="checkbox"
                        className="accent-brand"
                        checked={profile.workMode.includes(mode)}
                        onChange={e => {
                          setProfile(p => ({
                            ...p,
                            workMode: e.target.checked
                              ? [...p.workMode, mode]
                              : p.workMode.filter(m => m !== mode),
                          }));
                        }}
                      />
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" variant="primary" size="md" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>
                Save Settings
              </Button>
              {saved && <span className="text-sm font-medium text-emerald-400">Saved ✓</span>}
            </div>
          </form>
        ) : (
          <div className="card flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-slate-400">{activeTab} settings coming soon.</p>
            <p className="mt-1 text-xs text-slate-600">This section is not yet implemented.</p>
          </div>
        )}
      </div>
    </div>
  );
}
