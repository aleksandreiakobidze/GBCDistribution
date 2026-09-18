import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { PageHeader, SearchInput, DataTable, ErpErrorAlert } from '@/components/shared';
import type { DataTableColumn } from '@/components/shared';
import { Badge, Button } from '@/components/ui';
import type { ErpCustomer } from '@/types';
import { isPlottableCoord } from '@/lib/utils/geo';
import { MapPin } from 'lucide-react';
import { CustomerMap } from './CustomerMap';

type DayFilter = 'today' | 'all';

interface CustomerRouteBoardProps {
  teamMode?: boolean;
}

export function CustomerRouteBoard({ teamMode = false }: CustomerRouteBoardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [day, setDay] = useState<DayFilter>('today');
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [salesUserId, setSalesUserId] = useState<number | undefined>(undefined);

  const teamQuery = useQuery({
    queryKey: ['erp-team-reps'],
    queryFn: () => erpApi.teamReps(),
    enabled: teamMode,
    retry: false,
  });

  const selectedSalesId = teamMode ? (salesUserId ?? teamQuery.data?.[0]?.id) : undefined;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['erp-customers-list', { search, cursor, day, salesUserId: selectedSalesId }],
    queryFn: () =>
      erpApi.customers({
        search: search || undefined,
        cursor: day === 'today' ? undefined : cursor,
        limit: day === 'today' ? 500 : 100,
        day,
        salesUserId: selectedSalesId,
      }),
    enabled: !teamMode || selectedSalesId != null,
    retry: false,
  });

  const items = data?.items ?? [];
  const mapPins = items
    .filter((row) => isPlottableCoord(row.latitude, row.longitude))
    .map((row) => ({
      id: row.customerId,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
    }));

  const openCustomer = (customerId: string) => {
    const qs = selectedSalesId ? `?salesUserId=${selectedSalesId}` : '';
    navigate(`/customers/${customerId}${qs}`);
  };

  const columns: DataTableColumn<ErpCustomer>[] = [
    {
      key: 'name',
      header: t('common.name', 'Name'),
      render: (row) => <span className="font-medium text-[var(--color-text)]">{row.name}</span>,
    },
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          teamMode
            ? t('nav.routes', 'Routes')
            : t('customers.title', 'Customers')
        }
      />
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t(
          'customers.readOnlyHint',
          'Customers come from FMG. Assigned organizations only. Master data is read-only.',
        )}
      </p>

      {teamMode && (
        <div className="flex flex-wrap gap-2">
          {(teamQuery.data ?? []).map((rep) => (
            <button
              key={rep.id}
              type="button"
              onClick={() => {
                setSalesUserId(rep.id);
                setCursor(undefined);
              }}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedSalesId === rep.id
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text)]'
              }`}
            >
              {rep.name}
            </button>
          ))}
          {teamQuery.isSuccess && (teamQuery.data?.length ?? 0) === 0 && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t('customers.noTeamReps', 'No mapped sales reps on your team.')}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl border border-[var(--color-border)] p-1">
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              day === 'today'
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-secondary)]'
            }`}
            onClick={() => {
              setDay('today');
              setCursor(undefined);
            }}
          >
            {t('customers.todayRoute', 'Today route')}
          </button>
          <button
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              day === 'all'
                ? 'bg-[var(--color-primary)] text-white'
                : 'text-[var(--color-text-secondary)]'
            }`}
            onClick={() => {
              setDay('all');
              setCursor(undefined);
            }}
          >
            {t('customers.allCustomers', 'All customers')}
          </button>
        </div>
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setCursor(undefined);
          }}
          placeholder={t('customers.searchCustomers', 'Search customers...')}
          className="w-full sm:max-w-sm"
        />
      </div>

      {isError ? (
        <ErpErrorAlert
          error={error}
          fallback={t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.')}
        />
      ) : (
        <div className="flex flex-col gap-4 xl:grid xl:grid-cols-2">
          <div className="order-2 xl:order-1">
            <CustomerMap pins={mapPins} onPinClick={openCustomer} heightClass="h-52 sm:h-80" />
          </div>
          <div className="order-1 min-w-0 xl:order-2">
            <div className="flex flex-col gap-2 md:hidden">
              {isLoading ? (
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
                items.map((row) => {
                  const pinned = isPlottableCoord(row.latitude, row.longitude);
                  return (
                    <button
                      key={row.customerId}
                      type="button"
                      onClick={() => openCustomer(row.customerId)}
                      className="flex w-full flex-col gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-left shadow-[var(--shadow-sm)]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 font-semibold leading-snug text-[var(--color-text)]">
                          {row.name}
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
                      </p>
                      <p className="flex items-start gap-1 text-xs leading-snug text-[var(--color-text-secondary)]">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="min-w-0 break-words">{row.address || '—'}</span>
                      </p>
                    </button>
                  );
                })
              )}
            </div>
            <div className="hidden md:block">
              <DataTable<ErpCustomer>
                columns={columns}
                data={items}
                loading={isLoading}
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
      {data?.hasMore && day === 'all' && (
        <Button variant="outline" onClick={() => setCursor(data.nextCursor ?? undefined)}>
          {t('common.loadMore', 'Load more')}
        </Button>
      )}
    </div>
  );
}
