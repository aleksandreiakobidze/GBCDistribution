import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, List, MapPin, Navigation, Route } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { formatVisitClock } from '@/lib/utils/format';
import { PageHeader, SearchInput, DataTable, ErpErrorAlert } from '@/components/shared';
import type { DataTableColumn } from '@/components/shared';
import { Badge, Button, MultiCombobox, SegmentedControl } from '@/components/ui';
import type { ErpCustomer, ErpVisit } from '@/types';
import { isPlottableCoord, nearestNeighborOrder } from '@/lib/utils/geo';
import { formatKm, formatMin, googleMapsRouteUrl } from '@/lib/utils/routing';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRouteDirections } from '@/hooks/useRouteDirections';
import { CustomerMap } from './CustomerMap';

type DayFilter = 'today' | 'all';

type RouteRow = ErpCustomer & { salesUserId?: number; salesName?: string };

interface CustomerRouteBoardProps {
  teamMode?: boolean;
}

export function CustomerRouteBoard({ teamMode = false }: CustomerRouteBoardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [day, setDay] = useState<DayFilter>('today');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [repIds, setRepIds] = useState<number[]>([]);
  const [routeOn, setRouteOn] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const geo = useGeolocation();

  const teamQuery = useQuery({
    queryKey: ['erp-team-reps'],
    queryFn: () => erpApi.teamReps(),
    enabled: teamMode,
    retry: false,
  });

  const reps = teamQuery.data ?? [];

  useEffect(() => {
    if (teamMode && repIds.length === 0 && reps.length > 0) {
      setRepIds([reps[0].id]);
    }
  }, [teamMode, repIds.length, reps]);

  const activeIds = useMemo(() => (teamMode ? repIds : [0]), [teamMode, repIds]);
  const single = activeIds.length === 1;
  const repKey = activeIds.join(',');

  const results = useQueries({
    queries: activeIds.map((id) => ({
      queryKey: ['erp-customers-list', { search, cursor: single ? cursor : undefined, day, salesUserId: id }],
      queryFn: () =>
        erpApi.customers({
          search: search || undefined,
          cursor: day === 'today' || !single ? undefined : cursor,
          limit: day === 'today' ? 500 : 100,
          day,
          salesUserId: id === 0 ? undefined : id,
        }),
      placeholderData: keepPreviousData,
      retry: false,
    })),
  });

  const dataKey = results.map((result) => result.dataUpdatedAt).join('|');
  const firstPage = results[0]?.data;
  const listLoading = results.length === 0 || results.some((result) => result.isLoading);
  const failed = results.find((result) => result.isError);

  const pageRows = useMemo<RouteRow[]>(() => {
    const seen = new Set<string>();
    const rows: RouteRow[] = [];
    results.forEach((result, index) => {
      const id = activeIds[index];
      const name = reps.find((rep) => rep.id === id)?.name;
      for (const item of result.data?.items ?? []) {
        const key = `${id}:${item.customerId}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        rows.push({ ...item, salesUserId: id === 0 ? undefined : id, salesName: name });
      }
    });
    return rows;
    // rows are rebuilt whenever any query delivers new data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, repKey]);

  const [listed, setListed] = useState<RouteRow[]>([]);

  useEffect(() => {
    setListed([]);
    setCursor(undefined);
    setRouteOn(false);
  }, [search, day, repKey]);

  useEffect(() => {
    if (day === 'today' || !cursor || !single) {
      setListed(pageRows);
      return;
    }
    setListed((prev) => {
      const seen = new Set(prev.map((row) => `${row.salesUserId ?? 0}:${row.customerId}`));
      return [...prev, ...pageRows.filter((row) => !seen.has(`${row.salesUserId ?? 0}:${row.customerId}`))];
    });
  }, [cursor, day, pageRows, single]);

  const items = listed;
  const canRoute = day === 'today' && single;
  const routeActive = canRoute && routeOn && geo.latitude != null && geo.longitude != null;

  const ordered = useMemo(() => {
    if (!routeActive || geo.latitude == null || geo.longitude == null) {
      return items;
    }
    return nearestNeighborOrder([geo.latitude, geo.longitude], items);
  }, [routeActive, geo.latitude, geo.longitude, items]);

  const directions = useRouteDirections({
    origin: routeActive && geo.latitude != null && geo.longitude != null ? [geo.latitude, geo.longitude] : null,
    stops: ordered.map((row) => ({
      id: row.customerId,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
    })),
    enabled: routeActive,
  });

  const stopById = useMemo(
    () => new Map(directions.stops.map((stop) => [stop.id, stop])),
    [directions.stops],
  );

  const mapPins = routeActive
    ? []
    : ordered
        .filter((row) => isPlottableCoord(row.latitude, row.longitude))
        .map((row) => ({
          id: row.customerId,
          name: row.salesName ? `${row.name} · ${row.salesName}` : row.name,
          latitude: row.latitude,
          longitude: row.longitude,
        }));

  const visitQueries = useQueries({
    queries: activeIds.map((id) => ({
      queryKey: ['erp-visits-today', id],
      queryFn: () => erpApi.visits({ day: 'today', salesUserId: id === 0 ? undefined : id }),
      enabled: day === 'today',
      retry: false,
    })),
  });

  const visitKey = visitQueries.map((result) => result.dataUpdatedAt).join('|');
  const todayVisits = useMemo<Array<ErpVisit & { salesName?: string }>>(() => {
    if (day !== 'today') {
      return [];
    }
    return visitQueries.flatMap((result, index) => {
      const name = reps.find((rep) => rep.id === activeIds[index])?.name;
      return (result.data ?? []).map((visit) => ({ ...visit, salesName: name }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, visitKey, repKey]);

  const visitStatusLabel = (status: ErpVisit['status']) => {
    if (status === 'arrived') return t('customers.arrived', 'Arrived');
    if (status === 'missed') return t('customers.missed', 'Could not enter');
    return t('customers.visitInProgress', 'In progress');
  };

  const visitPins = todayVisits.flatMap((visit) => {
    let latitude = visit.latitude;
    let longitude = visit.longitude;
    if (!isPlottableCoord(latitude, longitude)) {
      const customer = items.find((row) => row.customerId === visit.customerId);
      latitude = customer?.latitude ?? null;
      longitude = customer?.longitude ?? null;
    }
    if (!isPlottableCoord(latitude, longitude) || latitude == null || longitude == null) {
      return [];
    }
    const clock = formatVisitClock(visit.endedAt ?? visit.startedAt);
    return [
      {
        id: String(visit.id),
        name: visit.customerName ?? visit.customerId,
        latitude,
        longitude,
        status: visit.status,
        label: [clock, visitStatusLabel(visit.status), visit.customerName ?? visit.customerId, visit.salesName]
          .filter(Boolean)
          .join(' · '),
      },
    ];
  });

  const openCustomer = (customerId: string) => {
    const row = items.find((item) => item.customerId === customerId);
    const qs = row?.salesUserId ? `?salesUserId=${row.salesUserId}` : '';
    navigate(`/customers/${customerId}${qs}`);
  };

  const columns: DataTableColumn<RouteRow>[] = [
    ...(routeActive
      ? [
          {
            key: 'order',
            header: '#',
            render: (row: RouteRow) => stopById.get(row.customerId)?.order ?? '—',
          },
          {
            key: 'leg',
            header: t('directions.title', 'Directions'),
            render: (row: RouteRow) => {
              const stop = stopById.get(row.customerId);
              if (!stop || stop.km == null || stop.min == null) {
                return <span className="text-xs text-[var(--color-text-secondary)]">—</span>;
              }
              return (
                <span className="whitespace-nowrap text-xs tabular-nums text-[var(--color-text-secondary)]">
                  {formatKm(stop.km)} {t('directions.km', 'km')} · {formatMin(stop.min)} {t('directions.min', 'min')}
                </span>
              );
            },
          },
        ]
      : []),
    {
      key: 'name',
      header: t('common.name', 'Name'),
      render: (row) => <span className="font-medium text-[var(--color-text)]">{row.name}</span>,
    },
    ...(teamMode && !single
      ? [
          {
            key: 'sales',
            header: t('day.sales', 'Sales rep'),
            render: (row: RouteRow) => row.salesName ?? '—',
          },
        ]
      : []),
    { key: 'orgCode', header: t('customers.orgCode', 'Code'), render: (row) => row.orgCode ?? row.customerId },
    { key: 'city', header: t('customers.city', 'City'), render: (row) => row.city ?? '—' },
    { key: 'address', header: t('common.address', 'Address'), render: (row) => row.address ?? '—' },
    {
      key: 'map',
      header: t('customers.onMap', 'Map'),
      render: (row) =>
        isPlottableCoord(row.latitude, row.longitude) ? (
          <Badge variant="info">{t('customers.hasPin', 'Pin')}</Badge>
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">—</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={teamMode ? t('nav.routes', 'Routes') : t('customers.title', 'Customers')} />
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t(
          'customers.readOnlyHint',
          'Customers come from FMG. Assigned organizations only. Master data is read-only.',
        )}
      </p>

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:flex-wrap sm:items-end">
        {teamMode && (
          <MultiCombobox
            className="w-full sm:w-56"
            label={t('day.sales', 'Sales rep')}
            options={reps.map((rep) => ({ value: String(rep.id), label: rep.name }))}
            values={repIds.map(String)}
            onChange={(values) => setRepIds(values.map(Number))}
            placeholder={t('filters.anySales', 'All sales reps')}
            searchPlaceholder={t('filters.searchSales', 'Search sales rep')}
            emptyText={t('filters.noResults', 'No results')}
            allLabel={t('filters.all', 'All')}
            clearLabel={t('filters.clear', 'Clear')}
            summary={(count) => t('filters.selected', '{{count}} selected', { count })}
          />
        )}
        <SegmentedControl
          className="w-full sm:w-auto"
          value={day}
          onChange={(value) => {
            setDay(value as DayFilter);
            setCursor(undefined);
          }}
          options={[
            {
              value: 'today',
              label: t('customers.todayRoute', 'Today route'),
              icon: CalendarCheck,
              count: firstPage?.todayTotal ?? undefined,
            },
            {
              value: 'all',
              label: t('customers.allCustomers', 'All customers'),
              icon: List,
              count: firstPage?.allTotal ?? undefined,
            },
          ]}
        />
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setCursor(undefined);
          }}
          placeholder={t('customers.searchCustomers', 'Search customers...')}
          className="w-full sm:max-w-xs"
        />
        {canRoute ? (
          <Button
            variant={routeActive ? 'primary' : 'outline'}
            loading={geo.loading}
            onClick={() => {
              setRouteOn(true);
              geo.getPosition();
            }}
          >
            <Route className="h-4 w-4" />
            {t('customers.optimalRoute', 'Optimal order')}
          </Button>
        ) : null}
      </div>
      {canRoute && routeOn && geo.error ? (
        <p className="text-sm font-medium text-[var(--color-warning)]">
          {t('customers.locationFailed', 'Location could not be found')}
        </p>
      ) : null}

      {failed ? (
        <ErpErrorAlert error={failed.error} fallback={t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.')} />
      ) : (
        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-2">
          <div className="order-2 space-y-2 xl:order-1">
            <CustomerMap
              pins={mapPins}
              onPinClick={(id) => {
                setSelectedId(id);
                if (!routeActive) {
                  openCustomer(id);
                }
              }}
              heightClass="h-64 sm:h-[26rem]"
              selectedId={selectedId}
              directions={routeActive ? directions : null}
              visitPins={visitPins}
            />
            {todayVisits.length > 0 ? (
              <ul className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
                {todayVisits.map((visit) => (
                  <li key={visit.id}>
                    {[
                      formatVisitClock(visit.endedAt ?? visit.startedAt),
                      visitStatusLabel(visit.status),
                      visit.customerName ?? visit.customerId,
                      visit.salesName,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="order-1 min-w-0 xl:order-2">
            <div className="flex flex-col gap-2 md:hidden">
              {listLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-20 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
                  />
                ))
              ) : items.length === 0 ? (
                <p className="rounded-xl border border-[var(--color-border)] px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">
                  {day === 'today'
                    ? t('customers.noTodayVisits', 'No visits scheduled for today')
                    : t('customers.noCustomers', 'No customers found')}
                </p>
              ) : (
                ordered.map((row) => {
                  const pinned = isPlottableCoord(row.latitude, row.longitude);
                  const stop = stopById.get(row.customerId);
                  return (
                    <div
                      key={`${row.salesUserId ?? 0}:${row.customerId}`}
                      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 shadow-[var(--shadow-sm)]"
                    >
                      <button
                        type="button"
                        onClick={() => openCustomer(row.customerId)}
                        className="flex w-full flex-col gap-1.5 text-left"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 font-semibold leading-snug text-[var(--color-text)]">
                            {stop ? `${stop.order}. ${row.name}` : row.name}
                          </p>
                          {pinned ? (
                            <Badge variant="info">{t('customers.hasPin', 'Pin')}</Badge>
                          ) : (
                            <span className="shrink-0 text-[11px] text-[var(--color-text-tertiary)]">
                              {t('customers.onMap', 'Map')} —
                            </span>
                          )}
                        </div>
                        <p className="text-xs tabular-nums text-[var(--color-text-secondary)]">
                          {t('customers.orgCode', 'Code')} {row.orgCode ?? row.customerId}
                          {row.city ? ` · ${row.city}` : ''}
                          {row.salesName && !single ? ` · ${row.salesName}` : ''}
                        </p>
                        <p className="flex items-start gap-1 text-xs leading-snug text-[var(--color-text-secondary)]">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="min-w-0 break-words">{row.address || '—'}</span>
                        </p>
                      </button>
                      {stop && stop.km != null && stop.min != null ? (
                        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2">
                          <span className="text-xs tabular-nums text-[var(--color-text-secondary)]">
                            {formatKm(stop.km)} {t('directions.km', 'km')} · {formatMin(stop.min)}{' '}
                            {t('directions.min', 'min')}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              window.open(
                                googleMapsRouteUrl(directions.origin, [stop.position]),
                                '_blank',
                                'noopener,noreferrer',
                              )
                            }
                          >
                            <Navigation className="h-3.5 w-3.5" />
                            {t('directions.start', 'Start')}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
            <div className="hidden md:block">
              <DataTable<RouteRow>
                columns={columns}
                data={ordered}
                loading={listLoading}
                emptyMessage={
                  day === 'today'
                    ? t('customers.noTodayVisits', 'No visits scheduled for today')
                    : t('customers.noCustomers', 'No customers found')
                }
                onRowClick={(row) => openCustomer(row.customerId)}
              />
            </div>
          </div>
        </div>
      )}
      {firstPage?.hasMore && day === 'all' && single && (
        <Button variant="outline" onClick={() => setCursor(firstPage.nextCursor ?? undefined)}>
          {t('common.loadMore', 'Load more')}
        </Button>
      )}
    </div>
  );
}
