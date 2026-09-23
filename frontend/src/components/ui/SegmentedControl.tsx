import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: LucideIcon;
  count?: number;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
  ariaLabel?: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'md',
  fullWidth,
  className,
  ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-inset)] p-1',
        fullWidth && 'w-full',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-all duration-150',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
              fullWidth && 'flex-1',
              active
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]',
            )}
          >
            {Icon && <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
            <span className="truncate">{option.label}</span>
            {option.count != null && (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] font-semibold',
                  active
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
