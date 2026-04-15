import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

const colorMap = {
  blue: {
    bg: 'bg-[var(--color-primary)]/10',
    icon: 'text-[var(--color-primary)]',
    accent: 'bg-[var(--color-primary)]',
  },
  green: {
    bg: 'bg-[var(--color-success)]/10',
    icon: 'text-[var(--color-success)]',
    accent: 'bg-[var(--color-success)]',
  },
  amber: {
    bg: 'bg-[var(--color-warning)]/10',
    icon: 'text-[var(--color-warning)]',
    accent: 'bg-[var(--color-warning)]',
  },
  teal: {
    bg: 'bg-[var(--color-secondary)]/10',
    icon: 'text-[var(--color-secondary)]',
    accent: 'bg-[var(--color-secondary)]',
  },
} as const;

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color: keyof typeof colorMap;
  change?: number;
  loading?: boolean;
}

export function KpiCard({ title, value, icon: Icon, color, change, loading }: KpiCardProps) {
  const colors = colorMap[color];

  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <div className={cn('absolute inset-y-0 left-0 w-1 rounded-l-2xl', colors.accent)} />
        <div className="animate-pulse space-y-3 pl-3">
          <div className="flex items-center gap-3">
            <div className={cn('h-10 w-10 rounded-xl', colors.bg)} />
            <div className="h-3.5 w-24 rounded-md bg-[var(--color-skeleton)]" />
          </div>
          <div className="h-7 w-32 rounded-md bg-[var(--color-skeleton)]" />
          <div className="h-3 w-16 rounded-md bg-[var(--color-skeleton-shine)]" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      <div className={cn('absolute inset-y-0 left-0 w-1 rounded-l-2xl', colors.accent)} />
      <div className="pl-3">
        <div className="flex items-center justify-between">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', colors.bg)}>
            <Icon className={cn('h-5 w-5', colors.icon)} />
          </div>
          {change !== undefined && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-lg px-2 py-0.5 text-xs font-medium',
                change >= 0
                  ? 'bg-[var(--color-success-light)] text-[var(--color-success-fg)]'
                  : 'bg-[var(--color-danger-light)] text-[var(--color-danger-fg)]',
              )}
            >
              {change >= 0 ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="mt-3 text-2xl font-bold text-[var(--color-text)]">{value}</p>
        <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">{title}</p>
      </div>
    </Card>
  );
}
