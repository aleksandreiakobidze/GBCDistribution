import { useEffect, useMemo, useRef, useState } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Spinner } from './Spinner';
import {
  ComboboxEmpty,
  ComboboxRow,
  ComboboxSearch,
  comboboxPanelClass,
  comboboxTriggerClass,
  type ComboboxOption,
} from './Combobox';

const DEBOUNCE_MS = 300;

export interface AsyncComboboxProps {
  queryKey: unknown[];
  fetchOptions: (search: string) => Promise<ComboboxOption[]>;
  value?: string | null;
  selectedLabel?: string | null;
  onChange: (option: ComboboxOption | null) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  minChars?: number;
  hintText?: string;
  clearable?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function AsyncCombobox({
  queryKey,
  fetchOptions,
  value,
  selectedLabel,
  onChange,
  label,
  placeholder = '—',
  searchPlaceholder = 'Search',
  emptyText = 'No results',
  minChars = 0,
  hintText,
  clearable = true,
  disabled,
  className,
  id,
}: AsyncComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(search.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTerm('');
      setActiveIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const enabled = open && term.length >= minChars;

  const optionsQuery = useQuery({
    queryKey: [...queryKey, term],
    queryFn: () => fetchOptions(term),
    enabled,
    retry: false,
  });

  const options = useMemo(() => optionsQuery.data ?? [], [optionsQuery.data]);

  useEffect(() => {
    setActiveIndex(0);
  }, [term]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const pick = (option: ComboboxOption) => {
    onChange(option);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(options.length - 1, current + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(0, current - 1));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) {
        pick(option);
      }
    }
  };

  const display = selectedLabel ?? (value ? String(value) : null);

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
            <span className={cn('min-w-0 flex-1 truncate', !display && 'text-[var(--color-text-secondary)]')}>
              {display ?? placeholder}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {clearable && display && (
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
              {!enabled ? (
                <ComboboxEmpty>{hintText ?? searchPlaceholder}</ComboboxEmpty>
              ) : optionsQuery.isFetching && options.length === 0 ? (
                <div className="flex justify-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : options.length === 0 ? (
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
              ) : (
                options.map((option, index) => (
                  <div key={option.value} data-index={index}>
                    <ComboboxRow
                      option={option}
                      selected={option.value === value}
                      active={index === activeIndex}
                      onSelect={() => pick(option)}
                      onHover={() => setActiveIndex(index)}
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
