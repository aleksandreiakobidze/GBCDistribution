import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, Badge } from '@/components/ui';
import { PageHeader, DataTable, Pagination, type DataTableColumn } from '@/components/shared';
import { inventoryApi } from '@/lib/api/inventory.api';
import { formatDateTime } from '@/lib/utils/format';
import type { StockMovement } from '@/types';

const movementBadgeVariant: Record<string, 'success' | 'danger' | 'info' | 'warning' | 'primary'> = {
  in: 'success',
  out: 'danger',
  transfer: 'info',
  adjustment: 'warning',
  return: 'primary',
};

export default function StockMovementPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements', page],
    queryFn: () => inventoryApi.getMovements({ page }),
  });

  const movements = data?.data ?? [];
  const meta = data?.meta;

  const columns: DataTableColumn<StockMovement>[] = [
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <Badge variant={movementBadgeVariant[row.type] ?? 'default'} size="sm">
          {row.type.replace(/_/g, ' ').toUpperCase()}
        </Badge>
      ),
    },
    {
      key: 'product',
      header: t('common.name'),
      render: (row) => (
        <div>
          <p className="font-medium text-[var(--color-text)]">{row.product?.name}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">{row.product?.sku}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: t('common.quantity'),
      render: (row) => (
        <span
          className={`font-semibold ${
            row.quantity > 0
              ? 'text-[var(--color-success)]'
              : 'text-[var(--color-danger)]'
          }`}
        >
          {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
        </span>
      ),
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      render: (row) => (
        <span className="text-[var(--color-text-secondary)]">#{row.warehouse_id}</span>
      ),
    },
    {
      key: 'user',
      header: 'User',
      render: (row) => (
        <span className="text-sm text-[var(--color-text)]">{row.user?.name ?? '—'}</span>
      ),
    },
    {
      key: 'notes',
      header: t('common.notes'),
      render: (row) => (
        <span className="max-w-[200px] truncate text-sm text-[var(--color-text-secondary)]">
          {row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'created_at',
      header: t('common.date'),
      render: (row) => (
        <span className="text-sm text-[var(--color-text-secondary)]">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('inventory.movements')}
        action={
          <Link to="/inventory">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('common.back')}
            </Button>
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <DataTable<StockMovement>
          columns={columns}
          data={movements}
          loading={isLoading}
          emptyMessage={t('common.noData')}
        />
      </Card>

      {meta && meta.last_page > 1 && (
        <Pagination currentPage={meta.current_page} totalPages={meta.last_page} onPageChange={setPage} />
      )}
    </div>
  );
}
