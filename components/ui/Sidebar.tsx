'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Briefcase,
  KanbanSquare,
  FileText,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  LogOut,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/',              icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/jobs',         icon: Briefcase,       label: 'Jobs' },
  { href: '/applications', icon: KanbanSquare,    label: 'Applications' },
  { href: '/resume',       icon: FileText,        label: 'Resume' },
  { href: '/alerts',       icon: Bell,            label: 'Alerts' },
  { href: '/settings',     icon: Settings,        label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        'flex h-screen flex-col border-r border-surface-border bg-surface-raised transition-all duration-200',
        collapsed ? 'w-[60px]' : 'w-[220px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-surface-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand shadow-glow">
          <Zap className="h-4 w-4 text-white" />
        </div>
        {!collapsed && (
          <div className="animate-fade-in overflow-hidden">
            <p className="truncate text-sm font-bold text-slate-100 leading-none">C2C Copilot</p>
            <p className="text-[10px] font-medium text-slate-500 leading-tight">Data Engineer</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" aria-label="Main navigation">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60',
                isActive
                  ? 'bg-brand/15 text-brand-light font-semibold shadow-[inset_0_1px_0_rgba(99,102,241,0.2)]'
                  : 'text-slate-400 hover:bg-surface-overlay hover:text-slate-200',
              )}
            >
              <Icon className={clsx('h-4.5 w-4.5 shrink-0', isActive ? 'text-brand-light' : '')} style={{ width: '18px', height: '18px' }} />
              {!collapsed && <span className="animate-fade-in truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="flex flex-col gap-1 border-t border-surface-border p-2">
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs text-slate-500 transition hover:bg-surface-overlay hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Collapse</span>
            </>
          )}
        </button>

        {/* Logout */}
        <button
          onClick={() => router.push('/')}
          aria-label="Sign out"
          title={collapsed ? 'Sign out' : undefined}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-surface-overlay hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
