import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

const colorMap = {
  blue: {
    bg: 'bg-[var(--color-primary)]/10',
    icon: 'text-[var(--color-primary)]',
    tint: 'from-[var(--color-primary)]/8 to-transparent',
    bar: 'bg-[var(--color-primary)]',
  },
  green: {
    bg: 'bg-[var(--color-success)]/10',
    icon: 'text-[var(--color-success)]',
    tint: 'from-[var(--color-success)]/8 to-transparent',
    bar: 'bg-[var(--color-success)]',
  },
  amber: {
    bg: 'bg-[var(--color-warning)]/10',
    icon: 'text-[var(--color-warning)]',
    tint: 'from-[var(--color-warning)]/8 to-transparent',
    bar: 'bg-[var(--color-warning)]',
  },
  teal: {
    bg: 'bg-[var(--color-secondary)]/10',
    icon: 'text-[var(--color-secondary)]',
    tint: 'from-[var(--color-secondary)]/8 to-transparent',
    bar: 'bg-[var(--color-secondary)]',
  },
} as const;

export type KpiCompare = {
  current: number;
  total: number;
  totalHasMore?: boolean;
};

interface KpiCardProps {
  title: string;
  value?: string | number;
  icon: LucideIcon;
  color: keyof typeof colorMap;
  loading?: boolean;
  compare?: KpiCompare;
  hint?: string;
}

function compareLabel(compare: KpiCompare): string {
  const total = compare.totalHasMore ? `${compare.total}+` : String(compare.total);
  return `${compare.current} / ${total}`;
}

function compareRatio(compare: KpiCompare): number {
  if (compare.total <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, (compare.current / compare.total) * 100));
}

export function KpiCard({ title, value, icon: Icon, color, loading, compare, hint }: KpiCardProps) {
  const colors = colorMap[color];
  const display = compare ? compareLabel(compare) : value;

  if (loading) {
    return (
      <Card className="relative overflow-hidden p-5">
        <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', colors.tint)} />
        <div className="relative animate-pulse space-y-4">
          <div className={cn('h-11 w-11 rounded-2xl', colors.bg)} />
          <div className="h-8 w-24 rounded-md bg-[var(--color-skeleton)]" />
          <div className="h-3.5 w-28 rounded-md bg-[var(--color-skeleton-shine)]" />
          {compare && <div className="h-1.5 w-full rounded-full bg-[var(--color-skeleton)]" />}
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden p-5">
      <div className={cn('pointer-events-none absolute inset-0 bg-gradient-to-br', colors.tint)} />
      <div className="relative">
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', colors.bg)}>
          <Icon className={cn('h-5 w-5', colors.icon)} />
        </div>
        <p className="mt-4 text-3xl font-bold tracking-tight text-[var(--color-text)]">{display}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{title}</p>
        {compare && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
            <div
              className={cn('h-full rounded-full', colors.bar)}
              style={{ width: `${compareRatio(compare)}%` }}
            />
          </div>
        )}
        {hint && (
          <p className="mt-2 text-[11px] leading-snug text-[var(--color-text-tertiary)]">{hint}</p>
        )}
      </div>
    </Card>
  );
}
