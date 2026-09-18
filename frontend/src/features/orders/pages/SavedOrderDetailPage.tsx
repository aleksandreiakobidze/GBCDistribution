import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { Button, Card, Spinner } from '@/components/ui';
import { ErpErrorAlert } from '@/components/shared';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { formatPackQty } from '@/lib/utils/packQty';

function formatQty(value: string): string {
  return formatPackQty(parseFloat(value) || 0);
}

export default function SavedOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const orderId = Number(id);

  const orderQuery = useQuery({
    queryKey: ['erp-saved-order', orderId],
    queryFn: () => erpApi.savedOrder(orderId),
    enabled: Number.isFinite(orderId) && orderId > 0,
    retry: false,
  });

  if (orderQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate('/orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('orders.backToOrders', 'Orders')}
        </Button>
        <ErpErrorAlert
          error={orderQuery.error}
          fallback={t('orders.orderNotFound', 'Order not found')}
        />
      </div>
    );
  }

  if (orderQuery.isLoading || !orderQuery.data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const order = orderQuery.data;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" className="self-start" onClick={() => navigate('/orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('orders.backToOrders', 'Orders')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/orders/saved/${order.id}/edit`)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          {t('common.edit', 'Edit')}
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {order.customerName || order.customerId}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t('customers.orgCode', 'Code')} {order.customerId}
          {order.createdAt ? ` · ${formatDateTime(order.createdAt)}` : ''}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          {t('orders.savedLocalHint', 'Orders are saved in the app. FMG is not changed.')}
        </p>
      </div>

      <Card className="flex flex-col gap-2 !p-3 sm:!p-4">
        <ul className="flex flex-col gap-1.5">
          {order.lines.map((line, index) => (
            <li
              key={`${line.itemId}-${index}`}
              className="rounded-lg border border-[var(--color-border)] px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-[var(--color-text)]">
                    {line.name || line.itemId}
                  </p>
                  <p className="mt-px text-[10px] text-[var(--color-text-tertiary)]">
                    {formatCurrency(line.unitPrice)} / {t('orders.piece', 'pc')}
                    {' · '}
                    {t('orders.subtotalQty', '{{packs}} packs · {{pieces}} pcs', {
                      packs: formatQty(line.packQuantity),
                      pieces: formatQty(line.pieces),
                    })}
                  </p>
                </div>
                <p className="shrink-0 text-[13px] font-bold">{formatCurrency(line.lineTotal)}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="rounded-lg bg-[var(--color-surface-inset)] p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">{t('common.total', 'Total')}</span>
            <span className="font-bold text-[var(--color-primary)]">{formatCurrency(order.total)}</span>
          </div>
        </div>
        {order.note ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{order.note}</p>
        ) : null}
      </Card>
    </div>
  );
}
