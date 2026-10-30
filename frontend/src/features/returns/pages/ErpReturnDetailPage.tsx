import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { Button, Card, Spinner } from '@/components/ui';
import { ErpErrorAlert } from '@/components/shared';
import { formatDateTime } from '@/lib/utils/format';

function formatPieces(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return value;
  }
  return String(num);
}

export default function ErpReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const returnId = Number(id);

  const returnQuery = useQuery({
    queryKey: ['erp-product-return', returnId],
    queryFn: () => erpApi.productReturn(returnId),
    enabled: Number.isFinite(returnId) && returnId > 0,
    retry: false,
  });

  if (returnQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate('/returns')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('returns.title', 'Returns')}
        </Button>
        <ErpErrorAlert
          error={returnQuery.error}
          fallback={t('returns.notFound', 'Return not found')}
        />
      </div>
    );
  }

  if (returnQuery.isLoading || !returnQuery.data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const row = returnQuery.data;
  const totalPieces = row.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" className="self-start" onClick={() => navigate('/returns')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('returns.title', 'Returns')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/returns/${row.id}/edit`)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          {t('common.edit', 'Edit')}
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {row.customerName || row.customerId}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t('customers.orgCode', 'Code')} {row.customerId}
          {row.createdAt ? ` · ${formatDateTime(row.createdAt)}` : ''}
        </p>
        {row.warehouseName || row.warehouseId ? (
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t('customers.returnWarehouse', 'Warehouse')}: {row.warehouseName || row.warehouseId}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          {t('customers.returnHint', 'This return stays in the app for this customer. FMG is not changed.')}
        </p>
      </div>

      <Card className="flex flex-col gap-2 !p-3 sm:!p-4">
        <ul className="flex flex-col gap-1.5">
          {row.lines.map((line, index) => (
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
                    {t(`customers.reasons.${line.reason}`, line.reason)}
                  </p>
                </div>
                <p className="shrink-0 text-[13px] font-bold tabular-nums">
                  {formatPieces(line.quantity)} {t('orders.piece', 'pc')}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="rounded-lg bg-[var(--color-surface-inset)] p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">{t('orders.subtotal', 'Subtotal')}</span>
            <span className="font-bold text-[var(--color-primary)]">
              {t('orders.linePieces', '{{count}} pcs', { count: formatPieces(String(totalPieces)) })}
            </span>
          </div>
        </div>
        {row.note ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{row.note}</p>
        ) : null}
      </Card>
    </div>
  );
}
