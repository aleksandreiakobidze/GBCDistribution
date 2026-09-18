import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Banknote, Calendar, ChevronRight } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { ErpErrorAlert } from '@/components/shared';
import { erpApi } from '@/lib/api/erp.api';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import type { ErpCollection } from '@/types';

export default function CollectionListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['erp-collections'],
    queryFn: () => erpApi.collections(),
    retry: false,
  });

  const collections = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-[var(--color-text)] sm:text-xl">
          {t('collections.title', 'Cash')}
        </h1>
        <Link to="/customers">
          <Button variant="primary" className="gap-1.5 px-3 py-2 text-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('collections.createCollection', 'New cash')}</span>
            <span className="sm:hidden">{t('common.new', 'New')}</span>
          </Button>
        </Link>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t('customers.collectHint', 'This record stays in the app for this customer. FMG balance is not changed.')}
      </p>
      {isError ? (
        <ErpErrorAlert
          error={error}
          fallback={t('customers.collectLoadError', 'Could not load cash.')}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-hover)]">
            <Banknote className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t('customers.noCollections', 'No cash yet')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-3">
          {collections.map((row) => (
            <CollectionCard
              key={row.id}
              row={row}
              onClick={() => navigate(`/collections/${row.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionCard({ row, onClick }: { row: ErpCollection; onClick: () => void }) {
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
            {row.customerName || row.customerId}
          </span>
          <span className="shrink-0 text-sm font-bold tabular-nums text-[var(--color-primary)]">
            {formatCurrency(row.amount)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
          <span>{t('customers.collectCashMethod', 'Cash')}</span>
          <span>{t('customers.orgCode', 'Code')} {row.customerId}</span>
          {row.createdAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateTime(row.createdAt)}
            </span>
          )}
        </div>
        {row.note ? (
          <p className="truncate text-xs text-[var(--color-text-tertiary)]">{row.note}</p>
        ) : null}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
    </button>
  );
}
