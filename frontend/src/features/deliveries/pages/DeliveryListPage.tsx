import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Truck, MapPin, Clock, ChevronRight } from 'lucide-react';
import { Card, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { PageHeader, DataTable, StatusBadge, Pagination, type DataTableColumn } from '@/components/shared';
import { deliveriesApi } from '@/lib/api/deliveries.api';
import { useAuthStore } from '@/stores/authStore';
import { formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Delivery } from '@/types';

const STATUS_TABS = ['all', 'assigned', 'loading', 'in_transit', 'delivered', 'failed'] as const;

export default function DeliveryListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isDriver = user?.role === 'driver';

  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['deliveries', page, status],
    queryFn: () => deliveriesApi.getAll({ page } as Record<string, unknown>),
  });

  const allDeliveries = data?.data ?? [];
  const meta = data?.meta;

  const deliveries =
    status === 'all'
      ? allDeliveries
      : allDeliveries.filter((d) => d.status === status);

  const columns: DataTableColumn<Delivery>[] = [
    {
      key: 'order',
      header: t('orders.orderNumber'),
      render: (row) => (
        <span className="font-medium text-[var(--color-text)]">
          {row.order?.order_number ?? `#${row.order_id}`}
        </span>
      ),
    },
    {
      key: 'customer',
      header: t('orders.customer'),
      render: (row) => (
        <span className="text-sm">{row.order?.customer?.name ?? '—'}</span>
      ),
    },
    {
      key: 'driver',
      header: t('deliveries.driver'),
      render: (row) => (
        <span className="text-sm">{row.driver?.name ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge status={row.status} type="delivery" />,
    },
    {
      key: 'scheduled_date',
      header: t('deliveries.scheduledDate'),
      render: (row) => (
        <span className="text-sm text-[var(--color-text-secondary)]">
          {formatDate(row.scheduled_date)}
        </span>
      ),
    },
    {
      key: 'delivered_at',
      header: t('deliveries.deliveredAt'),
      render: (row) => (
        <span className="text-sm text-[var(--color-text-secondary)]">
          {row.delivered_at ? formatDate(row.delivered_at) : '—'}
        </span>
      ),
    },
  ];

  function DriverCardView() {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {deliveries.map((delivery) => (
          <Card
            key={delivery.id}
            hoverable
            className="cursor-pointer p-5 transition-shadow hover:shadow-md"
            onClick={() => navigate(`/deliveries/${delivery.id}`)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-[var(--color-text)]">
                    {delivery.order?.order_number ?? `#${delivery.order_id}`}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {delivery.order?.customer?.name}
                  </p>
                </div>
              </div>
              <StatusBadge status={delivery.status} type="delivery" />
            </div>

            <div className="mt-4 space-y-2">
              {delivery.order?.customer?.address && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{delivery.order.customer.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{formatDate(delivery.scheduled_date)}</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end text-xs font-medium text-[var(--color-primary)]">
              View Details
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </div>
          </Card>
        ))}
        {deliveries.length === 0 && !isLoading && (
          <div className="col-span-full py-12 text-center text-[var(--color-text-secondary)]">
            {t('common.noData')}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('deliveries.title')} />

      <Tabs value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
        <TabsList className={cn('w-full overflow-x-auto')}>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab === 'all'
                ? t('common.all')
                : tab.replace(/_/g, ' ')}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={status}>
          {isDriver ? (
            <DriverCardView />
          ) : (
            <Card className="overflow-hidden">
              <DataTable<Delivery>
                columns={columns}
                data={deliveries}
                loading={isLoading}
                emptyMessage={t('common.noData')}
                onRowClick={(row) => navigate(`/deliveries/${row.id}`)}
              />
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {meta && meta.last_page > 1 && (
        <Pagination currentPage={meta.current_page} totalPages={meta.last_page} onPageChange={setPage} />
      )}
    </div>
  );
}
