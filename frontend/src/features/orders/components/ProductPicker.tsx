import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { SearchInput } from '@/components/shared';
import { Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import { Plus, Minus, Trash2, Package } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ErpCartItem, ErpItem } from '@/types';

interface ProductPickerProps {
  customerId: string;
  onAddProduct: (item: ErpItem) => void;
  onUpdateQuantity: (itemId: string, quantity: string) => void;
  onRemoveProduct: (itemId: string) => void;
  items: ErpCartItem[];
}

export function ProductPicker({
  customerId,
  onAddProduct,
  onUpdateQuantity,
  onRemoveProduct,
  items,
}: ProductPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);

  const quantityMap = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => map.set(i.itemId, i.quantity));
    return map;
  }, [items]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['erp-items', customerId, search],
    queryFn: () => erpApi.items({ customerId, search: search.length >= 2 ? search : undefined, limit: 200 }),
    enabled: !!customerId,
  });

  const allItems = data?.items ?? [];
  const categories = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return [...set].sort();
  }, [allItems]);

  const products = useMemo(() => {
    if (search.length >= 2) return allItems;
    if (category) return allItems.filter((i) => i.category === category);
    return allItems;
  }, [allItems, category, search]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('products.searchAddProducts', 'Search products by name or SKU...')}
      />

      {categories.length > 0 && search.length < 2 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={cn(
              'rounded-md px-2 py-1 text-[10px] whitespace-nowrap',
              category === null
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
            )}
          >
            {t('products.allProducts', 'All')}
          </button>
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              className={cn(
                'rounded-md px-2 py-1 text-[10px] whitespace-nowrap',
                category === name
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : error ? (
        <p className="py-4 text-center text-xs text-[var(--color-danger)]">
          {(error as { response?: { data?: { message?: string } } }).response?.data?.message
            ?? t('products.catalogError', 'Catalog is unavailable for this customer.')}
        </p>
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 py-6">
          <Package className="h-6 w-6 text-[var(--color-text-tertiary)]" />
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t('products.noProductsFound', 'No products found')}
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {products.map((product) => (
            <ProductItem
              key={product.itemId}
              product={product}
              quantity={quantityMap.get(product.itemId) ?? '0'}
              onAdd={() => onAddProduct(product)}
              onUpdateQuantity={(qty) => onUpdateQuantity(product.itemId, qty)}
              onRemove={() => onRemoveProduct(product.itemId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProductItem({
  product,
  quantity,
  onAdd,
  onUpdateQuantity,
  onRemove,
}: {
  product: ErpItem;
  quantity: string;
  onAdd: () => void;
  onUpdateQuantity: (qty: string) => void;
  onRemove: () => void;
}) {
  const qtyNum = parseFloat(quantity) || 0;
  const isAdded = qtyNum > 0;
  const priceLabel = product.unitPrice ? formatCurrency(product.unitPrice) : '—';
  const canAdd = !!product.unitPrice;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-all',
      isAdded
        ? 'border-[var(--color-success)]/30 bg-[var(--color-success-light)]'
        : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface-hover)]',
    )}>
      <div className="flex flex-1 flex-col min-w-0">
        <span className="text-[13px] font-medium text-[var(--color-text)] truncate leading-tight">
          {product.name}
        </span>
        <div className="flex items-center gap-1.5 mt-px">
          <span className="text-[10px] text-[var(--color-text-tertiary)]">{product.itemId}</span>
          {product.unit && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">{product.unit}</span>
          )}
          <span className="text-[11px] font-semibold text-[var(--color-primary)]">{priceLabel}</span>
        </div>
      </div>

      {!canAdd ? (
        <span className="text-[10px] text-[var(--color-text-tertiary)]">N/A</span>
      ) : isAdded ? (
        <div className="flex items-center gap-0.5 shrink-0">
          {qtyNum <= 1 ? (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onUpdateQuantity(String(qtyNum - 1))}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
          <span className="w-8 text-center text-xs font-bold">{qtyNum}</span>
          <button
            type="button"
            onClick={() => onUpdateQuantity(String(qtyNum + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)] text-white"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
