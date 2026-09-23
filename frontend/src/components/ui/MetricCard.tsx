import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils/cn';

export type MetricTone = 'primary' | 'success' | 'warning' | 'secondary' | 'danger' | 'info';

const tones: Record<MetricTone, { bg: string; icon: string; tint: string; bar: string }> = {
  primary: {
    bg: 'bg-[var(--color-primary)]/10',
    icon: 'text-[var(--color-primary)]',
    tint: 'from-[var(--color-primary)]/8 to-transparent',
    bar: 'bg-[var(--color-primary)]',
  },
  success: {
    bg: 'bg-[var(--color-success)]/10',
    icon: 'text-[var(--color-success)]',
    tint: 'from-[var(--color-success)]/8 to-transparent',
    bar: 'bg-[var(--color-success)]',
  },
  warning: {
    bg: 'bg-[var(--color-warning)]/10',
    icon: 'text-[var(--color-warning)]',
    tint: 'from-[var(--color-warning)]/8 to-transparent',
    bar: 'bg-[var(--color-warning)]',
  },
  secondary: {
    bg: 'bg-[var(--color-secondary)]/10',
    icon: 'text-[var(--color-secondary)]',
    tint: 'from-[var(--color-secondary)]/8 to-transparent',
    bar: 'bg-[var(--color-secondary)]',
  },
  danger: {
    bg: 'bg-[var(--color-danger)]/10',
    icon: 'text-[var(--color-danger)]',
    tint: 'from-[var(--color-danger)]/8 to-transparent',
    bar: 'bg-[var(--color-danger)]',
  },
  info: {
    bg: 'bg-[var(--color-info)]/10',
    icon: 'text-[var(--color-info)]',
    tint: 'from-[var(--color-info)]/8 to-transparent',
    bar: 'bg-[var(--color-info)]',
  },
};

export interface MetricProgress {
  current: number;
  total: number;
  totalHasMore?: boolean;
}

export interface MetricCardProps {
  title: string;
  value?: string | number;
  icon?: LucideIcon;
  tone?: MetricTone;
  hint?: string;
  progress?: MetricProgress;
  footer?: ReactNode;
  loading?: boolean;
  to?: string;
  compact?: boolean;
  className?: string;
}

function progressLabel(progress: MetricProgress): string {
  const total = progress.totalHasMore ? `${progress.total}+` : String(progress.total);
  return `${progress.current} / ${total}`;
}

function progressRatio(progress: MetricProgress): number {
  if (progress.total <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (progress.current / progress.total) * 100));
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  tone = 'primary',
  hint,
  progress,
  footer,
  loading,
  to,
  compact,
  className,
}: MetricCardProps) {
  const palette = tones[tone];
  const display = progress ? progressLabel(progress) : value;

  const body = loading ? (
    <div className="relative flex h-full animate-pulse flex-col space-y-3">
      <div className={cn('h-10 w-10 rounded-2xl', palette.bg)} />
      <div className="h-7 w-20 rounded-md bg-[var(--color-skeleton)]" />
      <div className="h-3.5 w-24 rounded-md bg-[var(--color-skeleton-shine)]" />
    </div>
  ) : (
    <div className="relative flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        {Icon && (
          <div className={cn('flex items-center justify-center rounded-2xl', palette.bg, compact ? 'h-9 w-9' : 'h-11 w-11')}>
            <Icon className={cn(palette.icon, compact ? 'h-4 w-4' : 'h-5 w-5')} />
          </div>
        )}
        {progress && progress.total > 0 && (
          <span className="rounded-full bg-[var(--color-surface-hover)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
            {Math.round(progressRatio(progress))}%
          </span>
        )}
      </div>
      <p
        className={cn(
          'font-bold tracking-tight text-[var(--color-text)]',
          compact ? 'mt-3 text-2xl' : 'mt-4 text-3xl',
        )}
      >
        {display}
      </p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{title}</p>
      {progress && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
          <div className={cn('h-full rounded-full transition-[width] duration-500', palette.bar)} style={{ width: `${progressRatio(progress)}%` }} />
        </div>
      )}
      {hint || footer ? (
        <div className="mt-auto pt-3">
          {hint ? <p className="text-[11px] leading-snug text-[var(--color-text-tertiary)]">{hint}</p> : null}
          {footer ? <div className={hint ? 'mt-3' : undefined}>{footer}</div> : null}
        </div>
      ) : null}
    </div>
  );

  const shell = (
    <div
      className={cn(
        'relative h-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all duration-200',
        to && 'hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40 hover:shadow-[var(--shadow-md)]',
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', palette.tint)} />
      {body}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className={cn('block h-full', className)}>
        {shell}
      </Link>
    );
  }

  return <div className={cn('h-full', className)}>{shell}</div>;
}
