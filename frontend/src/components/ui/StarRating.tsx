import { Star } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface StarRatingProps {
  value: number | null;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function StarRating({ value, onChange, size = 'sm', className }: StarRatingProps) {
  const score = value ?? 0;
  const icon = size === 'sm' ? 'h-3.5 w-3.5' : 'h-6 w-6';

  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={value == null ? undefined : `${value} / 5`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(1, score - (star - 1)));
        const glyph = (
          <span className="relative inline-flex">
            <Star className={cn(icon, 'text-[var(--color-text-tertiary)]')} />
            <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn(icon, 'fill-amber-500 text-amber-500')} />
            </span>
          </span>
        );

        if (!onChange) {
          return <span key={star}>{glyph}</span>;
        }

        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={Math.round(score) === star}
            aria-label={String(star)}
            onClick={() => onChange(star)}
            className="rounded-md p-0.5 text-[var(--color-text)]"
          >
            {glyph}
          </button>
        );
      })}
    </span>
  );
}
