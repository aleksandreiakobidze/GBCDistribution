import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/shared';
import {
  Button,
  Card,
  Combobox,
  EmptyState,
  Input,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { erpApi, type MonitoringOrderSummary } from '@/lib/api/erp.api';
import { formatCurrency } from '@/lib/utils/format';
import { useAuthStore } from '@/stores/authStore';

function formatSavedAt(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function groupOrders(orders: MonitoringOrderSummary[]): Array<[string, Array<[string, MonitoringOrderSummary[]]>]> {
  const savers = new Map<string, Map<string, MonitoringOrderSummary[]>>();
  for (const order of orders) {
    const saver = order.saverName || '—';
    const sales = order.salesName || '—';
    const bySales = savers.get(saver) ?? new Map<string, MonitoringOrderSummary[]>();
    const list = bySales.get(sales) ?? [];
    list.push(order);
    bySales.set(sales, list);
    savers.set(saver, bySales);
  }
  return [...savers.entries()].map(([saver, sales]) => [saver, [...sales.entries()]]);
}

export default function MonitoringPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const seesTeam = String(useAuthStore((state) => state.user?.role) ?? '').trim().toLowerCase() === 'monitoring head';
  const [params, setParams] = useSearchParams();
  const userId = params.get('user');
  const [orgSearch, setOrgSearch] = useState('');
  const repsQuery = useQuery({
    queryKey: ['monitoring-reps'],
    queryFn: () => erpApi.monitoringReps(),
  });
  const orgsQuery = useQuery({
    queryKey: ['monitoring-orgs', userId],
    queryFn: () => erpApi.monitoringOrgs(Number(userId)),
    enabled: Boolean(userId),
  });
  const ordersQuery = useQuery({
    queryKey: ['monitoring-orders'],
    queryFn: () => erpApi.monitoringOrders(),
  });
  const needle = orgSearch.trim().toLowerCase();
  const allOrgs = orgsQuery.data ?? [];
  const orgs = allOrgs.filter((org) => needle === '' || org.name.toLowerCase().includes(needle));
  const showSearch = Boolean(userId && orgsQuery.data && allOrgs.length > 0);
  const orders = ordersQuery.data ?? [];
  const orderGroups = groupOrders(orders);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        className="shrink-0"
        title={t('monitoring.title')}
        subtitle={t('monitoring.subtitle')}
        action={
          <Button variant="outline" size="md" className="rounded-full px-5" onClick={() => navigate('/monitoring/orders')}>
            {t('monitoring.savedOrders')}
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <Card className="flex max-h-64 min-h-0 shrink-0 flex-col !p-3 sm:!p-4 lg:order-2 lg:max-h-none lg:w-96">
          <h2 className="mb-2 shrink-0 text-sm font-semibold text-[var(--color-text)]">
            {seesTeam ? t('monitoring.teamOrders') : t('monitoring.myOrders')}
          </h2>
          {ordersQuery.isLoading ? (
            <div className="flex min-h-0 flex-1 items-center justify-center py-6"><Spinner /></div>
          ) : null}
          {ordersQuery.isError ? (
            <p className="text-sm font-medium text-[var(--color-danger)]">{t('monitoring.loadError')}</p>
          ) : null}
          {ordersQuery.data && orders.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-text-secondary)]">{t('monitoring.emptyOrders')}</p>
          ) : null}
          {orders.length > 0 ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-auto">
              {orderGroups.map(([saver, salesGroups]) => (
                <section key={saver} className="space-y-2">
                  <h3 className="inline-flex rounded-full bg-[var(--color-surface-hover)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)]">
                    {t('monitoring.saver')}: {saver}
                  </h3>
                  {salesGroups.map(([salesName, salesOrders]) => (
                    <div key={salesName} className="space-y-2">
                      <p className="sticky top-0 z-10 bg-[var(--color-surface)] py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                        {t('monitoring.salesperson')}: {salesName}
                      </p>
                      <ul className="space-y-2">
                        {salesOrders.map((order) => (
                          <li key={order.id}>
                            <button
                              type="button"
                              className="flex w-full items-center gap-3 rounded-xl bg-[var(--color-surface-inset)] px-3 py-3 text-left transition-colors hover:bg-[var(--color-surface-hover)]"
                              onClick={() => navigate(`/monitoring/orders/${order.id}`)}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="break-words text-sm font-semibold leading-snug text-[var(--color-text)]">{order.orgName}</p>
                                {order.address ? (
                                  <p className="mt-0.5 break-words text-sm text-[var(--color-text-secondary)]">{order.address}</p>
                                ) : null}
                                <p className="mt-1 text-xs tabular-nums text-[var(--color-text-tertiary)]">{formatSavedAt(order.savedAt)}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-xs tabular-nums text-[var(--color-text-secondary)]">{formatCurrency(order.systemDebt)}</p>
                                <p className="text-base font-semibold tabular-nums text-[var(--color-text)]">{formatCurrency(order.actualDebt)}</p>
                              </div>
                              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-text-secondary)]">
                                <ChevronRight className="h-4 w-4" />
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          ) : null}
        </Card>
      <Card className="flex min-h-0 flex-1 flex-col gap-3 !p-3 sm:!p-4 lg:order-1">
        <div className="flex shrink-0 flex-col gap-2 md:flex-row md:items-center">
          <div className="w-full md:w-72 md:shrink-0">
            <Combobox
              options={(repsQuery.data ?? []).map((rep) => ({ value: String(rep.id), label: rep.name }))}
              value={userId}
              loading={repsQuery.isLoading}
              placeholder={t('monitoring.salesperson')}
              searchPlaceholder={t('monitoring.searchSales')}
              emptyText={t('monitoring.salesperson')}
              onChange={(next) => {
                setOrgSearch('');
                if (next) {
                  setParams({ user: next });
                  return;
                }
                setParams({});
              }}
            />
          </div>
          {showSearch ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="min-w-0 flex-1 md:max-w-sm">
                <Input
                  value={orgSearch}
                  placeholder={t('monitoring.search')}
                  onChange={(event) => setOrgSearch(event.target.value)}
                />
              </div>
              <span className="ml-auto inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-hover)] px-2.5 text-sm font-medium tabular-nums text-[var(--color-text-secondary)]">
                {orgs.length}
              </span>
            </div>
          ) : null}
        </div>
        {repsQuery.isError || orgsQuery.isError ? (
          <p className="shrink-0 text-sm font-medium text-[var(--color-danger)]">{t('monitoring.loadError')}</p>
        ) : null}
        {userId && orgsQuery.isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center"><Spinner /></div>
        ) : null}
        {userId && orgsQuery.data && allOrgs.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <EmptyState title={t('monitoring.emptyOrgs')} />
          </div>
        ) : null}
        {showSearch && orgs.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <p className="text-sm text-[var(--color-text-secondary)]">{t('monitoring.noMatches')}</p>
          </div>
        ) : null}
        {showSearch && orgs.length > 0 ? (
          <Table containerClassName="min-h-0 flex-1">
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead className="first:static first:left-auto first:z-auto bg-[var(--color-surface-hover)] first:bg-[var(--color-surface-hover)] normal-case tracking-normal">{t('monitoring.organization')}</TableHead>
                <TableHead className="first:static bg-[var(--color-surface-hover)] normal-case tracking-normal text-right">{t('monitoring.debt')}</TableHead>
                <TableHead className="w-12 bg-[var(--color-surface-hover)] px-2" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orgs.map((org) => {
                const visited = Boolean(org.lastOrderAt);
                const visitedCell = visited
                  ? 'border-l-0 bg-[var(--color-success-light)] first:static first:left-auto first:z-auto first:border-l-4 first:border-l-[var(--color-success)] first:bg-[var(--color-success-light)] hover:bg-[var(--color-success-light)]'
                  : 'first:static first:left-auto first:z-auto bg-transparent first:bg-transparent';
                return (
                <TableRow
                  key={org.idOrg}
                  className={visited
                    ? 'cursor-pointer bg-[var(--color-success-light)] hover:bg-[var(--color-success-light)]'
                    : 'cursor-pointer'}
                  onClick={() => navigate(`/monitoring/${userId}/${encodeURIComponent(org.idOrg)}`)}
                >
                  <TableCell className={`whitespace-normal break-words py-4 ${visitedCell}`}>
                    <p className="text-base font-semibold leading-snug">{org.name}</p>
                    {org.address ? (
                      <p className="mt-1 text-sm font-normal leading-snug text-[var(--color-text-secondary)]">{org.address}</p>
                    ) : null}
                    {visited ? (
                      <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-xs font-medium text-[var(--color-success-fg)]">
                        {t('monitoring.visited')}
                        <span className="font-normal tabular-nums text-[var(--color-text-secondary)]">{formatSavedAt(org.lastOrderAt)}</span>
                      </p>
                    ) : (
                      <p className="mt-2 inline-flex rounded-full bg-[var(--color-surface-hover)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)]">
                        {t('monitoring.notVisited')}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className={`whitespace-nowrap py-4 text-right text-base font-semibold tabular-nums ${visitedCell}`}>
                    {formatCurrency(org.debt)}
                  </TableCell>
                  <TableCell className={`w-12 px-3 py-4 text-[var(--color-text-secondary)] ${visitedCell}`}>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-surface)]">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : null}
      </Card>
      </div>
    </div>
  );
}
