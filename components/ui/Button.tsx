'use client';

import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-semibold transition-all',
        'rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        'disabled:opacity-50 disabled:cursor-not-allowed',

        // Sizes
        size === 'xs' && 'px-2.5 py-1 text-xs',
        size === 'sm' && 'px-3.5 py-1.5 text-sm',
        size === 'md' && 'px-4 py-2 text-sm',
        size === 'lg' && 'px-5 py-2.5 text-base',

        // Variants
        variant === 'primary' && [
          'bg-brand text-white shadow-glow',
          'hover:bg-brand-dark hover:shadow-[0_0_0_1px_rgba(99,102,241,0.5),0_0_32px_rgba(99,102,241,0.25)]',
          'focus-visible:ring-brand active:scale-[0.98]',
        ],
        variant === 'secondary' && [
          'bg-surface-overlay text-slate-200 ring-1 ring-surface-border',
          'hover:bg-surface-subtle hover:ring-slate-600',
          'focus-visible:ring-brand',
        ],
        variant === 'ghost' && [
          'bg-transparent text-slate-400',
          'hover:bg-surface-overlay hover:text-slate-200',
          'focus-visible:ring-brand',
        ],
        variant === 'danger' && [
          'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
          'hover:bg-red-500/25 hover:text-red-300',
          'focus-visible:ring-red-500',
        ],
        variant === 'success' && [
          'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
          'hover:bg-emerald-500/25 hover:text-emerald-300',
          'focus-visible:ring-emerald-500',
        ],

        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}
      {children}
      {rightIcon && !loading && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
}
