import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { PageHeader, SearchInput, DataTable } from '@/components/shared';
import type { DataTableColumn } from '@/components/shared';
import { Badge, Button } from '@/components/ui';
import type { ErpCustomer } from '@/types';

export default function CustomerListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);

  const { data, isLoading } = useQuery({
    queryKey: ['erp-customers-list', { search, cursor }],
    queryFn: () => erpApi.customers({ search: search || undefined, cursor, limit: 100 }),
  });

  const columns: DataTableColumn<ErpCustomer>[] = [
    {
      key: 'name',
      header: t('common.name', 'Name'),
      render: (row) => <span className="font-medium text-[var(--color-text)]">{row.name}</span>,
    },
    { key: 'orgCode', header: t('customers.orgCode', 'Code'), render: (row) => row.orgCode ?? '—' },
    { key: 'phone', header: t('common.phone', 'Phone'), render: (row) => row.phone ?? '—' },
    { key: 'city', header: t('customers.city', 'City'), render: (row) => row.city ?? '—' },
    { key: 'address', header: t('common.address', 'Address'), render: (row) => row.address ?? '—' },
    {
      key: 'active',
      header: t('common.status', 'Status'),
      render: (row) => (
        <Badge variant={row.active ? 'success' : 'default'}>
          {row.active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('customers.title', 'Customers')} />
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t('customers.readOnlyHint', 'Customers come from FMG. Assigned organizations only. Master data is read-only.')}
      </p>
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          setCursor(undefined);
        }}
        placeholder={t('customers.searchCustomers', 'Search customers...')}
        className="w-full sm:max-w-sm"
      />
      <DataTable<ErpCustomer>
        columns={columns}
        data={data?.items ?? []}
        loading={isLoading}
        emptyMessage={t('customers.noCustomers', 'No customers found')}
        onRowClick={(row) => navigate(`/customers/${row.customerId}`)}
      />
      {data?.hasMore && (
        <Button variant="outline" onClick={() => setCursor(data.nextCursor ?? undefined)}>
          {t('common.loadMore', 'Load more')}
        </Button>
      )}
    </div>
  );
}
