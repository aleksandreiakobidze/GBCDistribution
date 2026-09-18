import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Pencil } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { Button, Card, Spinner } from '@/components/ui';
import { ErpErrorAlert } from '@/components/shared';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';

export default function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const collectionId = Number(id);

  const collectionQuery = useQuery({
    queryKey: ['erp-collection', collectionId],
    queryFn: () => erpApi.collection(collectionId),
    enabled: Number.isFinite(collectionId) && collectionId > 0,
    retry: false,
  });

  if (collectionQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate('/collections')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('collections.title', 'Cash')}
        </Button>
        <ErpErrorAlert
          error={collectionQuery.error}
          fallback={t('collections.notFound', 'Cash not found')}
        />
      </div>
    );
  }

  if (collectionQuery.isLoading || !collectionQuery.data) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const row = collectionQuery.data;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" className="self-start" onClick={() => navigate('/collections')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('collections.title', 'Cash')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/collections/${row.id}/edit`)}>
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
        <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
          {t('customers.collectHint', 'This record stays in the app for this customer. FMG balance is not changed.')}
        </p>
      </div>

      <Card className="flex flex-col gap-3 !p-3 sm:!p-4">
        <div className="rounded-lg bg-[var(--color-surface-inset)] p-3">
          <p className="text-xs font-medium text-[var(--color-text-tertiary)]">
            {t('customers.collectAmount', 'Amount')}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-primary)]">
            {formatCurrency(row.amount)}
          </p>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-secondary)]">
            {t('customers.collectMethod', 'Method')}
          </span>
          <span className="font-semibold">{t('customers.collectCashMethod', 'Cash')}</span>
        </div>
        {row.note ? (
          <p className="text-sm text-[var(--color-text-secondary)]">{row.note}</p>
        ) : null}
      </Card>
    </div>
  );
}
