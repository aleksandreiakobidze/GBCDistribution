import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { Card, Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { PageHeader, DataTable, StatusBadge, Pagination, type DataTableColumn } from '@/components/shared';
import { invoicesApi } from '@/lib/api/invoices.api';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Invoice } from '@/types';

const STATUS_TABS = ['all', 'draft', 'sent', 'paid', 'partial', 'overdue'] as const;

export default function InvoiceListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<string>('all');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, status],
    queryFn: () =>
      invoicesApi.getAll({
        page,
        status: status === 'all' ? undefined : status,
      }),
  });

  const invoices = data?.data ?? [];
  const meta = data?.meta;

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: 'invoice_number',
      header: t('invoices.invoiceNumber'),
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <FileText className="h-4 w-4" />
          </div>
          <span className="font-semibold text-[var(--color-text)]">{row.invoice_number}</span>
        </div>
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
      key: 'amount',
      header: t('invoices.amount'),
      render: (row) => (
        <span className="font-semibold text-[var(--color-text)]">{formatCurrency(row.amount)}</span>
      ),
    },
    {
      key: 'paid_amount',
      header: t('invoices.paidAmount'),
      render: (row) => (
        <span className="text-[var(--color-success)]">{formatCurrency(row.paid_amount)}</span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => <StatusBadge status={row.status} type="invoice" />,
    },
    {
      key: 'due_date',
      header: t('invoices.dueDate'),
      render: (row) => {
        const isOverdue =
          row.status !== 'paid' && new Date(row.due_date) < new Date();
        return (
          <span
            className={cn(
              'text-sm',
              isOverdue
                ? 'font-medium text-[var(--color-danger)]'
                : 'text-[var(--color-text-secondary)]',
            )}
          >
            {formatDate(row.due_date)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('invoices.title')} />

      <Tabs value={status} onValueChange={(val) => { setStatus(val); setPage(1); }}>
        <TabsList className="w-full overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab} className="capitalize">
              {tab === 'all' ? t('common.all') : tab}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={status}>
          <Card className="overflow-hidden">
            <DataTable<Invoice>
              columns={columns}
              data={invoices}
              loading={isLoading}
              emptyMessage={t('common.noData')}
              onRowClick={(row) => navigate(`/invoices/${row.id}`)}
            />
          </Card>
        </TabsContent>
      </Tabs>

      {meta && meta.last_page > 1 && (
        <Pagination currentPage={meta.current_page} totalPages={meta.last_page} onPageChange={setPage} />
      )}
    </div>
  );
}
