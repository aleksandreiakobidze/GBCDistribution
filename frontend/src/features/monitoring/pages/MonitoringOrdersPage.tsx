import { ArrowLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared';
import {
  Button,
  Card,
  EmptyState,
  Spinner,
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

export default function MonitoringOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const seesTeam = String(useAuthStore((state) => state.user?.role) ?? '').trim().toLowerCase() === 'monitoring head';
  const ordersQuery = useQuery({
    queryKey: ['monitoring-orders'],
    queryFn: () => erpApi.monitoringOrders(),
  });
  const orders = ordersQuery.data ?? [];
  const orderGroups = groupOrders(orders);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PageHeader
        className="shrink-0"
        title={t('monitoring.savedOrders')}
        subtitle={seesTeam ? t('monitoring.teamOrdersSubtitle') : t('monitoring.ordersSubtitle')}
        action={
          <Button variant="ghost" size="md" className="rounded-full" onClick={() => navigate('/monitoring')}>
            <ArrowLeft className="h-4 w-4" />
            {t('common.back')}
          </Button>
        }
      />
      <Card className="flex min-h-0 flex-1 flex-col !p-3 sm:!p-4">
        {ordersQuery.isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center"><Spinner /></div>
        ) : null}
        {ordersQuery.isError ? (
          <p className="text-sm font-medium text-[var(--color-danger)]">{t('monitoring.loadError')}</p>
        ) : null}
        {ordersQuery.data && orders.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <EmptyState title={t('monitoring.emptyOrders')} />
          </div>
        ) : null}
        {orders.length > 0 ? (
          <div className="min-h-0 flex-1 space-y-5 overflow-auto">
            {orderGroups.map(([saver, salesGroups]) => (
              <section key={saver} className="space-y-3">
                <h2 className="inline-flex rounded-full bg-[var(--color-surface-hover)] px-2.5 py-1 text-xs font-medium text-[var(--color-text)]">
                  {t('monitoring.saver')}: {saver}
                </h2>
                {salesGroups.map(([salesName, salesOrders]) => (
                  <div key={salesName} className="space-y-2">
                    <p className="sticky top-0 z-10 bg-[var(--color-surface)] py-1 text-sm font-medium text-[var(--color-text-secondary)]">
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
                              <p className="break-words text-base font-semibold text-[var(--color-text)]">{order.orgName}</p>
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
    </div>
  );
}
