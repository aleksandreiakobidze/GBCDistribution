import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Crosshair, Navigation, Route as RouteIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatKm, formatMin, googleMapsRouteUrl, type RouteMode } from '@/lib/utils/routing';
import type { RouteDirections } from '@/hooks/useRouteDirections';

interface DirectionsPanelProps {
  directions: RouteDirections;
  activeId?: string;
  onStopClick?: (id: string) => void;
  onRecenter?: () => void;
}

export function DirectionsPanel({ directions, activeId, onStopClick, onRecenter }: DirectionsPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);

  if (directions.stops.length === 0) {
    return null;
  }

  const modes: { value: RouteMode; label: string }[] = [
    { value: 'road', label: t('directions.road', 'By road') },
    { value: 'straight', label: t('directions.straight', 'Straight line') },
  ];

  const navigateAll = () => {
    const url = googleMapsRouteUrl(
      directions.origin,
      directions.stops.map((stop) => stop.position),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="pointer-events-none absolute inset-y-3 right-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
      <div className="pointer-events-auto flex w-72 max-w-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/95 shadow-[var(--shadow-lg)] backdrop-blur">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
          <RouteIcon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-text)]">
              {t('directions.title', 'Directions')}
            </p>
            <p className="truncate text-[11px] text-[var(--color-text-secondary)]">
              {directions.loading
                ? t('directions.locating', 'Finding your location…')
                : t('directions.total', 'Total {{km}} km · {{min}} min', {
                    km: formatKm(directions.totalKm),
                    min: formatMin(directions.totalMin),
                  })}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? t('directions.hide', 'Hide') : t('directions.show', 'Show stops')}
            className="shrink-0 rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />
          </button>
        </div>

        {open && (
          <>
            <div className="flex items-center gap-1 border-b border-[var(--color-border)] px-2 py-1.5">
              {modes.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => directions.setMode(mode.value)}
                  disabled={mode.value === 'road' && directions.roadUnavailable}
                  className={cn(
                    'rounded-lg px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-40',
                    directions.mode === mode.value
                      ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]',
                  )}
                >
                  {mode.label}
                </button>
              ))}
              <span className="flex-1" />
              {onRecenter && (
                <button
                  type="button"
                  onClick={onRecenter}
                  aria-label={t('directions.recenter', 'Recenter')}
                  className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                >
                  <Crosshair className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <ol className="max-h-56 overflow-y-auto p-1">
              {directions.stops.map((stop) => (
                <li key={stop.id}>
                  <div
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-2 py-1.5',
                      stop.id === activeId && 'bg-[var(--color-primary)]/8',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        stop.done
                          ? 'bg-[var(--color-success)] text-white'
                          : 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]',
                      )}
                    >
                      {stop.order}
                    </span>
                    <button
                      type="button"
                      onClick={() => onStopClick?.(stop.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-xs font-medium text-[var(--color-text)]">{stop.name}</span>
                      {stop.km != null && stop.min != null && (
                        <span className="block text-[11px] text-[var(--color-text-secondary)]">
                          {formatKm(stop.km)} {t('directions.km', 'km')} · {formatMin(stop.min)}{' '}
                          {t('directions.min', 'min')}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          googleMapsRouteUrl(directions.origin, [stop.position]),
                          '_blank',
                          'noopener,noreferrer',
                        )
                      }
                      aria-label={t('directions.start', 'Start')}
                      className="shrink-0 rounded-lg p-1.5 text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={navigateAll}
              className="flex h-9 items-center justify-center gap-1.5 border-t border-[var(--color-border)] text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
            >
              <Navigation className="h-3.5 w-3.5" />
              {t('directions.navigate', 'Navigate')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
