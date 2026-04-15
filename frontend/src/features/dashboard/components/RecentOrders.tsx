import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui';
import { StatusBadge } from '@/components/shared';
import { ordersApi } from '@/lib/api/orders.api';
import { formatCurrency, formatRelative } from '@/lib/utils/format';

export function RecentOrders() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => ordersApi.getAll({ page: 1 }),
    select: (res) => res.data.slice(0, 10),
  });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[var(--color-text)]">
          {t('dashboard.recentOrders', 'Recent Orders')}
        </h3>
        <Link
          to="/orders"
          className="inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          {t('common.viewAll', 'View All')}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center justify-between rounded-xl bg-[var(--color-surface-hover)] px-4 py-3">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-[var(--color-skeleton)]" />
                  <div className="h-3 w-32 rounded bg-[var(--color-skeleton-shine)]" />
                </div>
                <div className="h-5 w-16 rounded-full bg-[var(--color-skeleton)]" />
              </div>
            </div>
          ))}
        </div>
      ) : !data?.length ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t('dashboard.noOrders', 'No recent orders')}
        </p>
      ) : (
        <div className="space-y-1.5">
          {data.map((order) => (
            <div
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              className="flex cursor-pointer items-center justify-between rounded-xl px-4 py-3 transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--color-text)]">
                    {order.order_number}
                  </span>
                  <StatusBadge status={order.status} type="order" />
                </div>
                <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
                  {order.customer?.name} &middot; {formatRelative(order.created_at)}
                </p>
              </div>
              <span className="ml-4 text-sm font-semibold text-[var(--color-text)] tabular-nums">
                {formatCurrency(order.total)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
