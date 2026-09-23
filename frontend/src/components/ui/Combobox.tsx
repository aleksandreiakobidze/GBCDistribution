import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
  thumbnail?: string;
}

export const comboboxTriggerClass =
  'flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-left text-sm text-[var(--color-text)] transition-all duration-200 hover:border-[var(--color-border-strong)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50';

export const comboboxPanelClass =
  'z-50 w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-in fade-in-0 zoom-in-95';

export function matchesSearch(option: ComboboxOption, search: string): boolean {
  const needle = search.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  return (
    option.label.toLowerCase().includes(needle) ||
    (option.hint ?? '').toLowerCase().includes(needle) ||
    option.value.toLowerCase().includes(needle)
  );
}

interface ComboboxSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function ComboboxSearch({ value, onChange, placeholder, onKeyDown, inputRef }: ComboboxSearchProps) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3">
      <Search className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
      <input
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="h-10 w-full bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
      />
      {value !== '' && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="shrink-0 rounded-md p-1 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
          aria-label={placeholder}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface ComboboxRowProps {
  option: ComboboxOption;
  selected: boolean;
  active: boolean;
  onSelect: () => void;
  onHover: () => void;
  multiple?: boolean;
}

export function ComboboxRow({ option, selected, active, onSelect, onHover, multiple }: ComboboxRowProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onMouseEnter={onHover}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors duration-100',
        active ? 'bg-[var(--color-surface-hover)]' : 'bg-transparent',
        selected ? 'text-[var(--color-text)]' : 'text-[var(--color-text)]',
      )}
    >
      <span
        className={cn(
          'flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors',
          multiple ? '' : 'rounded-full',
          selected
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-fg)]'
            : 'border-[var(--color-border-strong)]',
        )}
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
      {option.thumbnail && (
        <img src={option.thumbnail} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{option.label}</span>
        {option.hint && (
          <span className="block truncate text-xs text-[var(--color-text-secondary)]">{option.hint}</span>
        )}
      </span>
    </button>
  );
}

export function ComboboxEmpty({ children }: { children: ReactNode }) {
  return <p className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">{children}</p>;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
  disabled?: boolean;
  error?: string;
  className?: string;
  id?: string;
  loading?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  label,
  placeholder = '—',
  searchPlaceholder = 'Search',
  emptyText = 'No results',
  clearable = false,
  disabled,
  error,
  className,
  id,
  loading,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const visible = useMemo(() => options.filter((option) => matchesSearch(option, search)), [options, search]);
  const selected = options.find((option) => option.value === value) ?? null;

  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveIndex(Math.max(0, visible.findIndex((option) => option.value === value)));
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
    // visible is intentionally read once on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [search]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(visible.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = visible[activeIndex];
      if (option) {
        pick(option.value);
      }
    }
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text)]">
          {label}
        </label>
      )}
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            id={id}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            className={cn(
              comboboxTriggerClass,
              error && 'border-[var(--color-danger)] focus-visible:border-[var(--color-danger)]',
            )}
          >
            <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-[var(--color-text-secondary)]')}>
              {selected?.label ?? placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {clearable && selected && (
                <span
                  role="button"
                  tabIndex={-1}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onChange(null);
                  }}
                  className="rounded-md p-0.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
              <ChevronDown className="h-4 w-4 text-[var(--color-text-secondary)]" />
            </span>
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content className={comboboxPanelClass} align="start" sideOffset={4}>
            <ComboboxSearch
              value={search}
              onChange={setSearch}
              placeholder={searchPlaceholder}
              onKeyDown={onKeyDown}
              inputRef={inputRef}
            />
            <div ref={listRef} role="listbox" className="max-h-64 overflow-y-auto p-1">
              {loading ? (
                <ComboboxEmpty>…</ComboboxEmpty>
              ) : visible.length === 0 ? (
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
              ) : (
                visible.map((option, index) => (
                  <div key={option.value} data-index={index}>
                    <ComboboxRow
                      option={option}
                      selected={option.value === value}
                      active={index === activeIndex}
                      onSelect={() => pick(option.value)}
                      onHover={() => setActiveIndex(index)}
                    />
                  </div>
                ))
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
