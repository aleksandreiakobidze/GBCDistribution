import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { Card, Button, Spinner, Badge } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';

export default function ErpOrderStatusPage() {
  const { erpOrderId } = useParams<{ erpOrderId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data, isLoading, error } = useQuery({
    queryKey: ['erp-order-status', erpOrderId],
    queryFn: () => erpApi.status(erpOrderId!),
    enabled: !!erpOrderId,
  });

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" onClick={() => navigate('/orders')} className="self-start">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('orders.backToOrders', 'Orders')}
      </Button>
      <Card className="flex flex-col gap-3 p-4">
        {isLoading ? (
          <Spinner />
        ) : error || !data ? (
          <p className="text-sm text-[var(--color-danger)]">
            {t('orders.orderNotFound', 'Order not found')}
          </p>
        ) : (
          <>
            <h1 className="text-xl font-bold">{t('orders.receivedTitle', 'Order received')}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">{data.message}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-tertiary)]">ID</span>
              <span className="font-mono text-sm">{data.erpOrderId}</span>
              <Badge variant="success">{data.status}</Badge>
            </div>
            <p className="text-xs text-[var(--color-text-tertiary)]">
              {t('orders.receivedHint', 'Received means committed to FMG incoming tables, not invoiced or posted.')}
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
