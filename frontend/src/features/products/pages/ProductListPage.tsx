import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { PageHeader, SearchInput, ErpErrorAlert } from '@/components/shared';
import { Badge, Card, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import type { ErpItem } from '@/types';
import { Building2, Check, MapPin, Users } from 'lucide-react';
import { ProductTaxonomyFilters } from '../components/ProductTaxonomyFilters';
import { compareItemsByProdT } from '@/lib/utils/sortItems';

function groupKey(item: ErpItem): string {
  const type = item.type?.trim();
  if (type) return type;
  const category = item.category?.trim();
  if (category) return category;
  return '';
}

export default function ProductListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const customerId = params.get('customerId');
  const [search, setSearch] = useState('');
  const [prodS, setProdS] = useState<string | null>(null);
  const [prodT, setProdT] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [pickingCustomer, setPickingCustomer] = useState(!customerId);

  const customerQuery = useQuery({
    queryKey: ['erp-customer', customerId],
    queryFn: () => erpApi.customer(customerId!),
    enabled: Boolean(customerId),
    retry: false,
  });

  const { data: customersPage, isLoading: customersLoading, isError: customersError, error: customersErr } = useQuery({
    queryKey: ['erp-customers', customerSearch],
    queryFn: () => erpApi.customers({ search: customerSearch || undefined, limit: 100 }),
    enabled: pickingCustomer,
    retry: false,
  });

  const customers = customersPage?.items ?? [];
  const selectedCustomer = customerQuery.data
    ?? customers.find((c) => c.customerId === customerId);

  const { data, isLoading, isError: itemsError, error: itemsErr } = useQuery({
    queryKey: ['erp-items', customerId, search, prodS, prodT],
    queryFn: () =>
      erpApi.items({
        customerId: customerId || undefined,
        search: search || undefined,
        prodS: search ? undefined : prodS || undefined,
        prodT: search ? undefined : prodT || undefined,
        limit: 500,
      }),
    enabled: Boolean(customerId),
    retry: false,
  });

  const { data: taxonomy = [] } = useQuery({
    queryKey: ['erp-item-taxonomy'],
    queryFn: () => erpApi.itemTaxonomy(),
    enabled: Boolean(customerId),
    retry: false,
  });

  const allItems = data?.items ?? [];
  const items = useMemo(() => {
    const filtered = !customerId
      ? allItems
      : allItems.filter((item) => {
          if (prodS && (item.prodS?.trim() ?? '') !== prodS) return false;
          if (prodT && (item.type?.trim() ?? '') !== prodT) return false;
          return true;
        });
    return [...filtered].sort(compareItemsByProdT);
  }, [allItems, customerId, prodS, prodT]);

  const grouped = useMemo(() => {
    const map = new Map<string, ErpItem[]>();
    for (const item of items) {
      const key = groupKey(item);
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'ka'));
  }, [items]);

  function selectCustomer(id: string) {
    const next = new URLSearchParams(params);
    next.set('customerId', id);
    setParams(next, { replace: true });
    setPickingCustomer(false);
    setProdS(null);
    setProdT(null);
  }

  function clearCustomer() {
    const next = new URLSearchParams(params);
    next.delete('customerId');
    setParams(next, { replace: true });
    setPickingCustomer(true);
    setProdS(null);
    setProdT(null);
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader title={t('products.title', 'Products')} />
      <p className="text-xs text-[var(--color-text-secondary)]">
        {t(
          'products.fgPriceHint',
          'List price is ProdView.Fasi matching the customer FG. FG 59 uses Fasi59.',
        )}
      </p>

      {pickingCustomer ? (
        <Card className="flex flex-col gap-2.5 !p-3 sm:!p-4">
          <SearchInput
            value={customerSearch}
            onChange={setCustomerSearch}
            placeholder={t('orders.searchCustomer', 'Search customer by name or city...')}
          />
          {customersLoading ? (
            <div className="flex justify-center py-6"><Spinner size="sm" /></div>
          ) : customersError ? (
            <ErpErrorAlert
              error={customersErr}
              fallback={t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.')}
            />
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-6">
              <Users className="h-6 w-6 text-[var(--color-text-tertiary)]" />
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t('orders.noCustomersFound', 'No customers found')}
              </p>
            </div>
          ) : (
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {customers.map((customer) => {
                const isSelected = customerId === customer.customerId;
                return (
                  <button
                    key={customer.customerId}
                    type="button"
                    onClick={() => selectCustomer(customer.customerId)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all',
                      isSelected
                        ? 'bg-[var(--color-primary)]/8 ring-2 ring-[var(--color-primary)]'
                        : 'hover:bg-[var(--color-surface-hover)] ring-1 ring-[var(--color-border)]',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className={cn('text-[13px] font-semibold truncate', isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]')}>
                        {customer.name}
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] truncate mt-px">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {[customer.address, customer.city].filter(Boolean).join(', ')}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-[var(--color-text-tertiary)] shrink-0">
                      FG {customer.priceGroup}
                    </span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-[var(--color-primary)]" />}
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      ) : selectedCustomer ? (
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
            <Building2 className="h-4 w-4 text-[var(--color-primary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-[var(--color-text)] truncate">{selectedCustomer.name}</p>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              FG {selectedCustomer.priceGroup}
              {' → '}
              Fasi{selectedCustomer.priceGroup}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCustomer}
            className="text-[11px] font-medium text-[var(--color-primary)] shrink-0"
          >
            {t('common.change', 'Change')}
          </button>
        </div>
      ) : customerQuery.isLoading ? (
        <div className="flex justify-center py-4"><Spinner size="sm" /></div>
      ) : customerQuery.isError ? (
        <ErpErrorAlert
          error={customerQuery.error}
          fallback={t('customers.customerNotFound', 'Customer not found')}
        />
      ) : null}

      {customerId && (
        <>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={t('products.searchProducts', 'Search products...')}
            className="w-full sm:max-w-sm"
          />

          {!search && (
            <ProductTaxonomyFilters
              taxonomy={taxonomy}
              prodS={prodS}
              prodT={prodT}
              onChange={({ prodS: nextS, prodT: nextT }) => {
                setProdS(nextS);
                setProdT(nextT);
              }}
            />
          )}

          {itemsError && (
            <ErpErrorAlert
              error={itemsErr}
              fallback={t('products.catalogError', 'Catalog is unavailable.')}
            />
          )}

          {isLoading ? (
            <p className="py-10 text-center text-sm">{t('common.loading', 'Loading...')}</p>
          ) : items.length === 0 && !itemsError ? (
            <p className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
              {t('products.noProducts', 'No products found')}
            </p>
          ) : (
            <div className="flex flex-col gap-6">
              {grouped.map(([key, groupItems]) => (
                <section key={key || '__empty'} className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold text-[var(--color-text-secondary)]">
                    {key || t('products.ungrouped', 'Other')}
                  </h2>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {groupItems.map((item) => (
                      <Card
                        key={item.itemId}
                        hoverable
                        onClick={() =>
                          navigate(
                            `/products/${encodeURIComponent(item.itemId)}?customerId=${encodeURIComponent(customerId)}`,
                          )
                        }
                        className="p-4"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-[var(--color-text)]">{item.name}</h3>
                          <p className="text-sm font-bold text-[var(--color-primary)] shrink-0">
                            {item.unitPrice
                              ? formatCurrency(item.unitPrice)
                              : t('products.priceUnavailable', 'Price unavailable')}
                          </p>
                        </div>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {item.prodCode || item.itemId}
                          {item.unit ? ` · ${item.unitName || item.unit}` : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.group && (
                            <Badge variant="primary" size="sm">{item.group}</Badge>
                          )}
                          {item.category && item.category !== item.group && (
                            <Badge variant="default" size="sm">{item.category}</Badge>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              ))}
              {data?.hasMore && (
                <p className="text-center text-xs text-[var(--color-text-tertiary)]">
                  {t('products.moreAvailable', 'More items exist in this filter. Narrow the type or search.')}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
