import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useUiStore, type ThemeMode } from '@/stores/uiStore';

const options: { value: ThemeMode; icon: typeof Sun; label: string }[] = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'system', icon: Monitor, label: 'System' },
  { value: 'dark', icon: Moon, label: 'Dark' },
];

interface ThemeToggleProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function ThemeToggle({ size = 'sm', className }: ThemeToggleProps) {
  const { theme, setTheme } = useUiStore();

  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const btnSize = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-xl bg-[var(--color-surface-inset)] p-0.5',
        className,
      )}
      role="radiogroup"
      aria-label="Theme"
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'relative flex items-center justify-center rounded-lg transition-all duration-200',
              btnSize,
              active
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
            )}
          >
            <Icon className={iconSize} />
          </button>
        );
      })}
    </div>
  );
}

interface ThemeSegmentedProps {
  className?: string;
}

export function ThemeSegmented({ className }: ThemeSegmentedProps) {
  const { theme, setTheme } = useUiStore();

  return (
    <div
      className={cn(
        'inline-flex w-full items-center gap-1 rounded-xl bg-[var(--color-surface-inset)] p-1',
        className,
      )}
      role="radiogroup"
      aria-label="Theme"
    >
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
              active
                ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
