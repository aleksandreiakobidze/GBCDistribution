import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, RotateCcw } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { PageHeader, DataTable, StatusBadge, Pagination, type DataTableColumn } from '@/components/shared';
import { returnsApi } from '@/lib/api/returns.api';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { ReturnOrder } from '@/types';

export default function ReturnListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['returns', page],
    queryFn: () => returnsApi.getAll({ page }),
  });

  const returns = data?.data ?? [];
  const meta = data?.meta;

  const columns: DataTableColumn<ReturnOrder>[] = [
    {
      key: 'return_number',
      header: t('returns.returnNumber'),
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-warning-light)] text-[var(--color-warning)]">
            <RotateCcw className="h-4 w-4" />
          </div>
          <span className="font-semibold text-[var(--color-text)]">{row.return_number}</span>
        </div>
      ),
    },
    {
      key: 'order_id',
      header: t('orders.orderNumber'),
      render: (row) => (
        <span className="text-sm text-[var(--color-text-secondary)]">#{row.order_id}</span>
      ),
    },
    {
      key: 'customer',
      header: t('orders.customer'),
      render: (row) => (
        <span className="text-sm">{row.customer?.name ?? '—'}</span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge status={row.status} type="return" />,
    },
    {
      key: 'total',
      header: t('common.total'),
      render: (row) => (
        <span className="font-semibold text-[var(--color-text)]">{formatCurrency(row.total)}</span>
      ),
    },
    {
      key: 'created_at',
      header: t('common.date'),
      render: (row) => (
        <span className="text-sm text-[var(--color-text-secondary)]">{formatDate(row.created_at)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('returns.title')}
        action={
          <Link to="/returns/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              {t('returns.createReturn')}
            </Button>
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <DataTable<ReturnOrder>
          columns={columns}
          data={returns}
          loading={isLoading}
          emptyMessage={t('common.noData')}
          onRowClick={(row) => navigate(`/returns/${row.id}`)}
        />
      </Card>

      {meta && meta.last_page > 1 && (
        <Pagination currentPage={meta.current_page} totalPages={meta.last_page} onPageChange={setPage} />
      )}
    </div>
  );
}
