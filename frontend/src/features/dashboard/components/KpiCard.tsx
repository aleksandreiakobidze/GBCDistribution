import type { LucideIcon } from 'lucide-react';
import { MetricCard, type MetricTone } from '@/components/ui';

const toneMap = {
  blue: 'primary',
  green: 'success',
  amber: 'warning',
  teal: 'secondary',
} as const satisfies Record<string, MetricTone>;

export type KpiCompare = {
  current: number;
  total: number;
  totalHasMore?: boolean;
};

interface KpiCardProps {
  title: string;
  value?: string | number;
  icon: LucideIcon;
  color: keyof typeof toneMap;
  loading?: boolean;
  compare?: KpiCompare;
  hint?: string;
  to?: string;
}

export function KpiCard({ title, value, icon, color, loading, compare, hint, to }: KpiCardProps) {
  return (
    <MetricCard
      title={title}
      value={value}
      icon={icon}
      tone={toneMap[color]}
      loading={loading}
      progress={compare}
      hint={hint}
      to={to}
    />
  );
}
