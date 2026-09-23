import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type RingTone = 'primary' | 'success' | 'warning' | 'secondary' | 'danger';

const toneStroke: Record<RingTone, string> = {
  primary: 'var(--color-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  secondary: 'var(--color-secondary)',
  danger: 'var(--color-danger)',
};

export interface ProgressRingProps {
  current: number;
  total: number;
  size?: number;
  thickness?: number;
  tone?: RingTone;
  children?: ReactNode;
  className?: string;
}

export function ProgressRing({
  current,
  total,
  size = 104,
  thickness = 10,
  tone = 'primary',
  children,
  className,
}: ProgressRingProps) {
  const ratio = total > 0 ? Math.min(1, Math.max(0, current / total)) : 0;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.round(ratio * 100);

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`${percent}%`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-hover)"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={toneStroke[tone]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children ?? (
          <span className="text-xl font-bold tracking-tight text-[var(--color-text)]">{percent}%</span>
        )}
      </div>
    </div>
  );
}
