import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, RotateCcw, Calendar, ChevronRight } from 'lucide-react';
import { Button, Spinner } from '@/components/ui';
import { ErpErrorAlert } from '@/components/shared';
import { erpApi } from '@/lib/api/erp.api';
import { formatDateTime } from '@/lib/utils/format';
import type { ErpProductReturn } from '@/types';

function formatPieces(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return value;
  }
  return String(num);
}

export default function ReturnListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['erp-product-returns'],
    queryFn: () => erpApi.productReturns(),
    retry: false,
  });

  const returns = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-[var(--color-text)] sm:text-xl">
          {t('returns.title', 'Returns')}
        </h1>
        <Link to="/customers">
          <Button variant="primary" className="gap-1.5 px-3 py-2 text-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t('returns.createReturn', 'New return')}</span>
            <span className="sm:hidden">{t('common.new', 'New')}</span>
          </Button>
        </Link>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t('customers.returnHint', 'This return stays in the app for this customer. FMG is not changed.')}
      </p>
      {isError ? (
        <ErpErrorAlert
          error={error}
          fallback={t('customers.returnLoadError', 'Could not load returns.')}
        />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : returns.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-surface-hover)]">
            <RotateCcw className="h-8 w-8 text-[var(--color-text-tertiary)]" />
          </div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            {t('customers.noReturns', 'No returns recorded yet')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-3">
          {returns.map((row) => (
            <ReturnCard
              key={row.id}
              row={row}
              onClick={() => navigate(`/returns/${row.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReturnCard({ row, onClick }: { row: ErpProductReturn; onClick: () => void }) {
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
          <span className="shrink-0 text-xs font-medium text-[var(--color-text-secondary)]">
            {t('customers.returnLineCount', '{{count}} products', { count: row.lines.length })}
          </span>
        </div>
        <ul className="space-y-0.5 text-xs text-[var(--color-text-secondary)]">
          {row.lines.slice(0, 3).map((line, index) => (
            <li key={`${row.id}-${line.itemId}-${index}`} className="flex justify-between gap-2">
              <span className="min-w-0 truncate">{line.name || line.itemId}</span>
              <span className="shrink-0 tabular-nums">
                {formatPieces(line.quantity)} {t('orders.piece', 'pc')}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-secondary)]">
          <span>{t('customers.orgCode', 'Code')} {row.customerId}</span>
          {row.createdAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateTime(row.createdAt)}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
    </button>
  );
}
