import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { PageHeader, SearchInput } from '@/components/shared';
import { Card } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import type { ErpCustomer, ErpItem } from '@/types';

export default function ProductListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [customerId, setCustomerId] = useState('');
  const [search, setSearch] = useState('');

  const { data: customers } = useQuery({
    queryKey: ['erp-customers-for-products'],
    queryFn: () => erpApi.customers({ limit: 200 }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['erp-items-catalog', customerId, search],
    queryFn: () => erpApi.items({ customerId, search: search || undefined, limit: 100 }),
    enabled: !!customerId,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('products.title', 'Products')} />
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t('products.customerPriceHint', 'Prices are customer-specific. Select an assigned customer. Unknown prices show as unavailable, never zero.')}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm"
        >
          <option value="">{t('orders.selectCustomer', 'Select Customer')}</option>
          {(customers?.items ?? []).map((c: ErpCustomer) => (
            <option key={c.customerId} value={c.customerId}>{c.name}</option>
          ))}
        </select>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('products.searchProducts', 'Search products...')}
          className="w-full sm:max-w-sm"
        />
      </div>

      {!customerId ? (
        <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
          {t('products.selectCustomerFirst', 'Select a customer to load the authorized assortment and prices.')}
        </p>
      ) : isLoading ? (
        <p className="py-10 text-center text-sm">{t('common.loading', 'Loading...')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((item: ErpItem) => (
            <Card
              key={item.itemId}
              hoverable
              onClick={() => navigate(`/products/${encodeURIComponent(item.itemId)}?customerId=${encodeURIComponent(customerId)}`)}
              className="p-4"
            >
              <h3 className="font-semibold text-[var(--color-text)]">{item.name}</h3>
              <p className="text-xs text-[var(--color-text-tertiary)]">{item.itemId} · {item.unit}</p>
              <p className="mt-2 text-lg font-bold text-[var(--color-primary)]">
                {item.unitPrice ? formatCurrency(item.unitPrice) : t('products.priceUnavailable', 'Price unavailable')}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
