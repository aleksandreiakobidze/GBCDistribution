import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { customersApi } from '@/lib/api/customers.api';
import { PageHeader, SearchInput, DataTable, Pagination } from '@/components/shared';
import type { DataTableColumn } from '@/components/shared';
import { Button, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import { Plus } from 'lucide-react';
import type { Customer } from '@/types';

const categoryVariants = {
  A: 'success',
  B: 'warning',
  C: 'danger',
} as const;

export default function CustomerListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', { page, search }],
    queryFn: () =>
      customersApi.getAll({ page, search: search || undefined }),
  });

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  const columns: DataTableColumn<Customer>[] = [
    {
      key: 'name',
      header: t('common.name', 'Name'),
      render: (row) => (
        <span className="font-medium text-[var(--color-text)]">{row.name}</span>
      ),
    },
    {
      key: 'contact_person',
      header: t('customers.contactPerson', 'Contact Person'),
    },
    {
      key: 'phone',
      header: t('common.phone', 'Phone'),
    },
    {
      key: 'city',
      header: t('customers.city', 'City'),
    },
    {
      key: 'category',
      header: t('products.category', 'Category'),
      render: (row) => (
        <Badge variant={categoryVariants[row.category]}>
          {t(`customers.category${row.category}`, `Category ${row.category}`)}
        </Badge>
      ),
    },
    {
      key: 'credit_limit',
      header: t('customers.creditLimit', 'Credit Limit'),
      render: (row) => formatCurrency(row.credit_limit),
      className: 'text-right',
    },
    {
      key: 'outstanding_balance',
      header: t('customers.balance', 'Balance'),
      render: (row) => (
        <span className={row.outstanding_balance > 0 ? 'font-medium text-[var(--color-warning)]' : ''}>
          {formatCurrency(row.outstanding_balance)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'is_active',
      header: t('common.status', 'Status'),
      render: (row) => (
        <Badge variant={row.is_active ? 'success' : 'default'}>
          {row.is_active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
        </Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('customers.title', 'Customers')}
        action={
          <Link to="/customers/new">
            <Button variant="primary">
              <Plus className="mr-2 h-4 w-4" />
              {t('customers.addCustomer', 'Add Customer')}
            </Button>
          </Link>
        }
      />

      <SearchInput
        value={search}
        onChange={handleSearch}
        placeholder={t('customers.searchCustomers', 'Search customers...')}
        className="w-full sm:max-w-sm"
      />

      <DataTable<Customer>
        columns={columns}
        data={data?.data ?? []}
        loading={isLoading}
        emptyMessage={t('customers.noCustomers', 'No customers found')}
        onRowClick={(row) => navigate(`/customers/${row.id}`)}
      />

      {data?.meta && data.meta.last_page > 1 && (
        <Pagination
          currentPage={data.meta.current_page}
          totalPages={data.meta.last_page}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
