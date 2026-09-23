import { useEffect, useMemo, useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  ComboboxEmpty,
  ComboboxRow,
  ComboboxSearch,
  comboboxPanelClass,
  comboboxTriggerClass,
  matchesSearch,
  type ComboboxOption,
} from './Combobox';

export interface MultiComboboxProps {
  options: ComboboxOption[];
  values: string[];
  onChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  allLabel?: string;
  clearLabel?: string;
  summary?: (count: number) => string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function MultiCombobox({
  options,
  values,
  onChange,
  label,
  placeholder = '—',
  searchPlaceholder = 'Search',
  emptyText = 'No results',
  allLabel = 'All',
  clearLabel = 'Clear',
  summary,
  disabled,
  className,
  id,
}: MultiComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const visible = useMemo(() => options.filter((option) => matchesSearch(option, search)), [options, search]);
  const picked = options.filter((option) => values.includes(option.value));

  useEffect(() => {
    if (open) {
      setSearch('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
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
        toggle(option.value);
      }
    }
  };

  const triggerLabel =
    picked.length === 0
      ? placeholder
      : picked.length <= 2
        ? picked.map((option) => option.label).join(', ')
        : summary
          ? summary(picked.length)
          : `${picked.length}`;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-[var(--color-text)]">
          {label}
        </label>
      )}
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button type="button" id={id} disabled={disabled} className={comboboxTriggerClass}>
            <span
              className={cn('min-w-0 flex-1 truncate', picked.length === 0 && 'text-[var(--color-text-secondary)]')}
            >
              {triggerLabel}
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              {picked.length > 2 && (
                <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-primary)]">
                  {picked.length}
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
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-2 py-1.5">
              <button
                type="button"
                onClick={() => onChange(options.map((option) => option.value))}
                className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
              >
                {allLabel}
              </button>
              <button
                type="button"
                onClick={() => onChange([])}
                className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              >
                {clearLabel}
              </button>
            </div>
            <div ref={listRef} role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto p-1">
              {visible.length === 0 ? (
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
              ) : (
                visible.map((option, index) => (
                  <div key={option.value} data-index={index}>
                    <ComboboxRow
                      option={option}
                      selected={values.includes(option.value)}
                      active={index === activeIndex}
                      onSelect={() => toggle(option.value)}
                      onHover={() => setActiveIndex(index)}
                      multiple
                    />
                  </div>
                ))
              )}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
