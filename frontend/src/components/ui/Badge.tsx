import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import type { ReactNode } from 'react';

const badgeVariants = cva(
  'inline-flex items-center font-medium',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
        primary: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
        success: 'bg-[var(--color-success-light)] text-[var(--color-success-fg)]',
        warning: 'bg-[var(--color-warning-light)] text-[var(--color-warning-fg)]',
        danger: 'bg-[var(--color-danger-light)] text-[var(--color-danger-fg)]',
        info: 'bg-[var(--color-info-light)] text-[var(--color-info-fg)]',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs rounded-md',
        md: 'px-2.5 py-1 text-sm rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
);

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
}

export function Badge({ variant, size, className, children }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))}>
      {children}
    </span>
  );
}

export { badgeVariants };
