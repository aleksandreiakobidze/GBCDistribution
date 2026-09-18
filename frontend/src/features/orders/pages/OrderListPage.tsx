import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ordersApi } from '@/lib/api/orders.api';
import { erpApi } from '@/lib/api/erp.api';
import { Pagination, StatusBadge, ErpErrorAlert } from '@/components/shared';
import { Button, Spinner } from '@/components/ui';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import { useAuthStore } from '@/stores/authStore';
import {
  Plus,
  Search,
  Package,
  ChevronRight,
  ShoppingBag,
  User,
  Calendar,
  Hash,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Order, ErpSavedOrder } from '@/types';

const statuses = [
  { key: '', icon: ShoppingBag },
  { key: 'pending', icon: Package },
  { key: 'confirmed', icon: Package },
  { key: 'picking', icon: Package },
  { key: 'packed', icon: Package },
  { key: 'dispatched', icon: Package },
  { key: 'delivered', icon: Package },
  { key: 'cancelled', icon: Package },
] as const;

function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: 'var(--color-warning)',
    confirmed: 'var(--color-info)',
    picking: 'var(--color-primary)',
    packed: 'var(--color-primary)',
    dispatched: 'var(--color-info)',
    delivered: 'var(--color-success)',
    cancelled: 'var(--color-danger)',
  };
  return map[status] ?? 'var(--color-text-secondary)';
}

export default function OrderListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['orders', { page, status }],
    queryFn: () => ordersApi.getAll({ page, status: status || undefined }),
    enabled: user?.role !== 'sales_rep',
  });

  if (user?.role === 'sales_rep') {
    return <SavedErpOrderList />;
  }

  const orders = data?.data ?? [];
  const filtered = search
    ? orders.filter(
        (o) =>
          o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
          o.customer?.name?.toLowerCase().includes(search.toLowerCase()),
      )
    : orders;

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-[var(--color-text)] sm:text-xl">
            {t('orders.title', 'Orders')}
          </h1>
          {data?.meta && (
            <p className="text-xs text-[var(--color-text-tertiary)] sm:text-sm">
              {data.meta.total} {t('common.total', 'total')}
            </p>
          )}
        </div>
        <Link to="/customers">
          <Button variant="primary" className="gap-1.5 px-3 py-2 text-sm sm:px-4">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('orders.createOrder', 'New Order')}</span>
            <span className="sm:hidden">{t('common.new', 'New')}</span>
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]" />
        <input
          type="text"
          placeholder={t('orders.searchPlaceholder', 'Search orders...')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-9 pr-4 text-sm text-[var(--color-text)] placeholder-[var(--color-text-tertiary)] outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/30"
        />
      </div>

      {/* Status filter pills */}
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {statuses.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => { setStatus(s.key); setPage(1); }}
            className={cn(
              'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:text-sm',
              status === s.key
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40',
            )}
          >
            {t(s.key ? `orders.status.${s.key}` : 'common.all', s.key || 'All')}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <OrderSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-hover)]">
            <ShoppingBag className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t('orders.noOrders', 'No orders found')}
          </p>
          <Link to="/customers">
            <Button variant="primary" className="mt-1 gap-1.5 text-sm">
              <Plus className="h-4 w-4" />
              {t('orders.createFirst', 'Create your first order')}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-3">
          {filtered.map((order) => (
            <OrderCard key={order.id} order={order} onClick={() => navigate(`/orders/${order.id}`)} />
          ))}
        </div>
      )}

      {data?.meta && data.meta.last_page > 1 && (
        <Pagination
          currentPage={data.meta.current_page}
          totalPages={data.meta.last_page}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function SavedErpOrderList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['erp-saved-orders'],
    queryFn: () => erpApi.savedOrders(),
    retry: false,
  });

  const orders = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-[var(--color-text)] sm:text-xl">
          {t('orders.title', 'Orders')}
        </h1>
        <Link to="/customers">
          <Button variant="primary" className="gap-1.5 px-3 py-2 text-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('orders.createOrder', 'New Order')}</span>
            <span className="sm:hidden">{t('common.new', 'New')}</span>
          </Button>
        </Link>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t('orders.savedLocalHint', 'Orders are saved in the app. FMG is not changed.')}
      </p>
      {isError ? (
        <ErpErrorAlert
          error={error}
          fallback={t('orders.loadError', 'შეკვეთები ვერ ჩაიტვირთა.')}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-hover)]">
            <ShoppingBag className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t('orders.noSavedOrders', 'No orders saved yet')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-3">
          {orders.map((order) => (
            <SavedOrderCard
              key={order.id}
              order={order}
              onClick={() => navigate(`/orders/saved/${order.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SavedOrderCard({ order, onClick }: { order: ErpSavedOrder; onClick: () => void }) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left transition-all hover:border-[var(--color-primary)]/30 hover:shadow-sm active:scale-[0.99] sm:p-4"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-bold text-[var(--color-text)]">
            {order.customerName || order.customerId}
          </span>
          <span className="shrink-0 text-sm font-bold text-[var(--color-primary)]">
            {formatCurrency(order.total)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
          <span>{t('customers.orgCode', 'Code')} {order.customerId}</span>
          <span>
            {order.lines.length} {t('common.items', 'items')}
          </span>
          {order.createdAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateTime(order.createdAt)}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
    </button>
  );
}

function OrderCard({ order, onClick }: { order: Order; onClick: () => void }) {
  const { t } = useTranslation();
  const statusColor = getStatusColor(order.status);
  const itemCount = order.items?.length;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-stretch gap-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition-all hover:border-[var(--color-primary)]/30 hover:shadow-sm active:scale-[0.99]"
    >
      {/* Status accent bar */}
      <div
        className="w-1 shrink-0 rounded-l-xl"
        style={{ backgroundColor: statusColor }}
      />

      <div className="flex flex-1 items-center gap-3 p-3 sm:p-4">
        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          {/* Top row: order number + total */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[var(--color-text)] sm:text-base">
                {order.order_number}
              </span>
              <StatusBadge status={order.status} type="order" />
            </div>
            <span className="shrink-0 text-sm font-bold text-[var(--color-primary)] sm:text-base">
              {formatCurrency(order.total)}
            </span>
          </div>

          {/* Details row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)] sm:text-sm">
            {order.customer && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                <span className="max-w-[120px] truncate sm:max-w-[200px]">{order.customer.name}</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              {formatDate(order.ordered_at)}
            </span>
            {typeof itemCount === 'number' && itemCount > 0 && (
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                {itemCount} {t('orders.items', 'items')}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition-transform group-hover:translate-x-0.5 sm:h-5 sm:w-5" />
      </div>
    </button>
  );
}

function OrderSkeleton() {
  return (
    <div className="flex items-stretch rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="w-1 shrink-0 rounded-l-xl bg-[var(--color-skeleton)]" />
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex justify-between">
          <div className="h-4 w-28 animate-pulse rounded bg-[var(--color-skeleton)]" />
          <div className="h-4 w-16 animate-pulse rounded bg-[var(--color-skeleton)]" />
        </div>
        <div className="flex gap-3">
          <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-skeleton-shine)]" />
          <div className="h-3 w-20 animate-pulse rounded bg-[var(--color-skeleton-shine)]" />
        </div>
      </div>
    </div>
  );
}
