import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ordersApi } from '@/lib/api/orders.api';
import { Button, Spinner } from '@/components/ui';
import { StatusBadge } from '@/components/shared';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils/format';
import {
  ArrowLeft,
  Truck,
  FileText,
  CheckCircle,
  XCircle,
  User,
  MapPin,
  Phone,
  CalendarDays,
  Warehouse,
  Package,
  Receipt,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Order, OrderStatus } from '@/types';

const statusSteps: OrderStatus[] = ['pending', 'confirmed', 'picking', 'packed', 'dispatched', 'delivered'];

const nextActionMap: Record<string, { next: OrderStatus; labelKey: string; label: string }> = {
  pending: { next: 'confirmed', labelKey: 'orders.actions.confirm', label: 'Confirm' },
  confirmed: { next: 'picking', labelKey: 'orders.actions.startPicking', label: 'Start Picking' },
  picking: { next: 'packed', labelKey: 'orders.actions.markPacked', label: 'Mark Packed' },
  packed: { next: 'dispatched', labelKey: 'orders.actions.dispatch', label: 'Dispatch' },
  dispatched: { next: 'delivered', labelKey: 'orders.actions.deliver', label: 'Delivered' },
};

function getStepIndex(status: OrderStatus): number {
  const idx = statusSteps.indexOf(status);
  return idx === -1 ? 0 : idx;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => ordersApi.getById(Number(id)),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => ordersApi.updateStatus(Number(id), status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-hover)]">
          <Package className="h-8 w-8 text-[var(--color-text-tertiary)]" />
        </div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {t('orders.orderNotFound', 'Order not found')}
        </p>
        <Button variant="ghost" onClick={() => navigate('/orders')} className="mt-2">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('orders.backToOrders', 'Back to Orders')}
        </Button>
      </div>
    );
  }

  const nextAction = nextActionMap[order.status];
  const canAdvance = !!nextAction && order.status !== 'delivered' && order.status !== 'cancelled';
  const currentStep = getStepIndex(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="flex flex-col gap-3 pb-24 sm:gap-4 sm:pb-4">
      {/* Top nav */}
      <button
        type="button"
        onClick={() => navigate('/orders')}
        className="flex items-center gap-1.5 self-start text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('orders.backToOrders', 'Orders')}
      </button>

      {/* Order header card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-bold text-[var(--color-text)] sm:text-xl">
              {order.order_number}
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
              <Clock className="h-3 w-3" />
              {formatDateTime(order.ordered_at)}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <StatusBadge status={order.status} type="order" />
            <span className="text-lg font-bold text-[var(--color-primary)] sm:text-xl">
              {formatCurrency(order.total)}
            </span>
          </div>
        </div>

        {/* Progress tracker */}
        {!isCancelled && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              {statusSteps.map((step, i) => {
                const isCompleted = i <= currentStep;
                const isCurrent = i === currentStep;
                return (
                  <div key={step} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors sm:h-7 sm:w-7 sm:text-xs',
                          isCompleted
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'border-2 border-[var(--color-border)] text-[var(--color-text-tertiary)]',
                          isCurrent && 'ring-2 ring-[var(--color-primary)]/30',
                        )}
                      >
                        {isCompleted && i < currentStep ? '✓' : i + 1}
                      </div>
                      <span
                        className={cn(
                          'mt-1 text-center text-[9px] leading-tight sm:text-[10px]',
                          isCompleted
                            ? 'font-medium text-[var(--color-primary)]'
                            : 'text-[var(--color-text-tertiary)]',
                        )}
                      >
                        {t(`orders.status.${step}`, step)}
                      </span>
                    </div>
                    {i < statusSteps.length - 1 && (
                      <div
                        className={cn(
                          'mx-1 h-0.5 flex-1 rounded-full transition-colors',
                          i < currentStep
                            ? 'bg-[var(--color-primary)]'
                            : 'bg-[var(--color-border)]',
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Customer & Info grid */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Customer card */}
        {order.customer && (
          <div className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-sm font-bold text-[var(--color-primary)]">
              {order.customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                {order.customer.name}
              </p>
              {order.customer.city && (
                <p className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                  <MapPin className="h-3 w-3" />
                  {order.customer.city}
                </p>
              )}
              {order.customer.phone && (
                <p className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                  <Phone className="h-3 w-3" />
                  {order.customer.phone}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Order meta */}
        <div className="grid grid-cols-2 gap-2">
          <MetaChip
            icon={<User className="h-3.5 w-3.5" />}
            label={t('orders.salesRep', 'Sales Rep')}
            value={order.sales_rep?.name ?? '—'}
          />
          <MetaChip
            icon={<Warehouse className="h-3.5 w-3.5" />}
            label={t('orders.warehouse', 'Warehouse')}
            value={`#${order.warehouse_id}`}
          />
          <MetaChip
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label={t('orders.createdAt', 'Created')}
            value={formatDate(order.created_at)}
          />
          <MetaChip
            icon={<Package className="h-3.5 w-3.5" />}
            label={t('orders.items', 'Items')}
            value={String(order.items?.length ?? 0)}
          />
        </div>
      </div>

      {/* Order items - card based on mobile */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <Package className="h-4 w-4 text-[var(--color-primary)]" />
            {t('orders.orderItems', 'Order Items')}
          </h2>
          <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">
            {order.items?.length ?? 0}
          </span>
        </div>

        {/* Mobile: card list */}
        <div className="flex flex-col divide-y divide-[var(--color-border)] sm:hidden">
          {order.items?.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-hover)] text-xs font-bold text-[var(--color-text-secondary)]">
                {item.quantity}×
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                  {item.product?.name ?? `#${item.product_id}`}
                </p>
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                  <span>{formatCurrency(item.unit_price)}</span>
                  {Number(item.discount_percent) > 0 && (
                    <span className="text-[var(--color-danger)]">-{item.discount_percent}%</span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold text-[var(--color-text)]">
                {formatCurrency(item.line_total)}
              </span>
            </div>
          ))}
        </div>

        {/* Tablet+: table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-xs uppercase text-[var(--color-text-tertiary)]">
                <th className="px-4 py-2.5 text-left font-medium">{t('orders.product', 'Product')}</th>
                <th className="px-4 py-2.5 text-center font-medium">{t('orders.qty', 'Qty')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('orders.unitPrice', 'Price')}</th>
                <th className="px-4 py-2.5 text-center font-medium">{t('orders.discount', 'Disc')}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t('orders.lineTotal', 'Total')}</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item) => (
                <tr key={item.id} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">
                    {item.product?.name ?? `#${item.product_id}`}
                  </td>
                  <td className="px-4 py-2.5 text-center text-[var(--color-text)]">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right text-[var(--color-text-secondary)]">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-4 py-2.5 text-center text-[var(--color-text-secondary)]">
                    {Number(item.discount_percent) > 0 ? `${item.discount_percent}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[var(--color-text)]">
                    {formatCurrency(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t border-[var(--color-border)] px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <TotalRow label={t('orders.subtotal', 'Subtotal')} value={formatCurrency(order.subtotal)} />
            {Number(order.discount_amount) > 0 && (
              <TotalRow
                label={t('orders.discount', 'Discount')}
                value={`−${formatCurrency(order.discount_amount)}`}
                className="text-[var(--color-danger)]"
              />
            )}
            {Number(order.tax_amount) > 0 && (
              <TotalRow label={t('orders.tax', 'Tax')} value={formatCurrency(order.tax_amount)} />
            )}
            <div className="mt-1 flex items-center justify-between border-t border-[var(--color-border)] pt-2">
              <span className="text-sm font-semibold text-[var(--color-text)]">
                {t('common.total', 'Total')}
              </span>
              <span className="text-base font-bold text-[var(--color-primary)]">
                {formatCurrency(order.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery info */}
      {order.delivery && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Truck className="h-4 w-4 text-[var(--color-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              {t('orders.deliveryInfo', 'Delivery')}
            </h2>
            <StatusBadge status={order.delivery.status} type="delivery" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoField label={t('deliveries.driver', 'Driver')} value={order.delivery.driver?.name ?? t('common.unassigned', 'Unassigned')} />
            <InfoField label={t('deliveries.scheduledDate', 'Scheduled')} value={formatDate(order.delivery.scheduled_date)} />
            <InfoField
              label={t('deliveries.deliveredAt', 'Delivered')}
              value={order.delivery.delivered_at ? formatDateTime(order.delivery.delivered_at) : '—'}
            />
            {order.delivery.notes && (
              <InfoField label={t('common.notes', 'Notes')} value={order.delivery.notes} />
            )}
          </div>
        </div>
      )}

      {/* Invoice info */}
      {order.invoice && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Receipt className="h-4 w-4 text-[var(--color-primary)]" />
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              {t('orders.invoiceInfo', 'Invoice')}
            </h2>
            <StatusBadge status={order.invoice.status} type="invoice" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <InfoField label={t('invoices.invoiceNumber', 'Invoice #')} value={order.invoice.invoice_number} />
            <InfoField label={t('invoices.amount', 'Amount')} value={formatCurrency(order.invoice.amount)} />
            <InfoField label={t('invoices.paid', 'Paid')} value={formatCurrency(order.invoice.paid_amount)} />
            <InfoField label={t('invoices.dueDate', 'Due Date')} value={formatDate(order.invoice.due_date)} />
          </div>
          {/* Payment progress */}
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-inset)]">
              <div
                className="h-full rounded-full bg-[var(--color-success)] transition-all"
                style={{
                  width: `${Math.min(100, (Number(order.invoice.paid_amount) / Math.max(Number(order.invoice.amount), 1)) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-[var(--color-text-tertiary)]">
              <span>{formatCurrency(order.invoice.paid_amount)} {t('invoices.paid', 'paid')}</span>
              <span>{formatCurrency(Number(order.invoice.amount) - Number(order.invoice.paid_amount))} {t('invoices.remaining', 'remaining')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Floating action bar (mobile) */}
      {(canAdvance || order.status === 'pending') && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 p-3 backdrop-blur-sm sm:static sm:flex sm:justify-end sm:gap-3 sm:border-none sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <div className="flex gap-2 sm:gap-3">
            {order.status === 'pending' && (
              <Button
                variant="danger"
                onClick={() => statusMutation.mutate('cancelled')}
                loading={statusMutation.isPending}
                className="flex-1 gap-1.5 sm:flex-initial"
              >
                <XCircle className="h-4 w-4" />
                {t('common.cancel', 'Cancel')}
              </Button>
            )}
            {canAdvance && (
              <Button
                variant="primary"
                onClick={() => statusMutation.mutate(nextAction.next)}
                loading={statusMutation.isPending}
                className="flex-1 gap-1.5 sm:flex-initial"
              >
                <CheckCircle className="h-4 w-4" />
                {t(nextAction.labelKey, nextAction.label)}
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MetaChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
      <div className="flex items-center gap-1 text-[var(--color-text-tertiary)]">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span className="truncate text-xs font-semibold text-[var(--color-text)] sm:text-sm">{value}</span>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-tertiary)]">{label}</span>
      <span className="text-xs text-[var(--color-text)] sm:text-sm">{value}</span>
    </div>
  );
}

function TotalRow({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className={className ?? 'text-[var(--color-text)]'}>{value}</span>
    </div>
  );
}
