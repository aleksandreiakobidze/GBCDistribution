import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { productsApi } from '@/lib/api/products.api';
import { SearchInput } from '@/components/shared';
import { Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import { Plus, Minus, Trash2, Package, ChevronRight, LayoutGrid, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { Product, Category, OrderFormItem } from '@/types';

interface ProductPickerProps {
  onAddProduct: (product: Product) => void;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onRemoveProduct: (productId: number) => void;
  items: OrderFormItem[];
}

export function ProductPicker({ onAddProduct, onUpdateQuantity, onRemoveProduct, items }: ProductPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);

  const quantityMap = useMemo(() => {
    const map = new Map<number, number>();
    items.forEach((i) => map.set(i.product_id, i.quantity));
    return map;
  }, [items]);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: productsApi.getCategories,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ['products-picker-search', search],
    queryFn: () => productsApi.getAll({ search }),
    enabled: search.length >= 2,
  });

  const { data: categoryData, isLoading: catProductsLoading } = useQuery({
    queryKey: ['products-picker-category', selectedCategoryId],
    queryFn: () =>
      productsApi.getAll(
        selectedCategoryId === -1 ? {} : { category_id: selectedCategoryId! },
      ),
    enabled: selectedCategoryId !== null,
  });

  const isSearching = search.length >= 2;
  const products = isSearching ? (searchData?.data ?? []) : (categoryData?.data ?? []);
  const isLoadingProducts = isSearching ? searchLoading : catProductsLoading;

  const selectedCategory = useMemo(
    () => categories.find((c: Category) => c.id === selectedCategoryId),
    [categories, selectedCategoryId],
  );

  const showProducts = isSearching || selectedCategoryId !== null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <SearchInput
        value={search}
        onChange={(v) => {
          setSearch(v);
          if (v.length >= 2) setSelectedCategoryId(null);
        }}
        placeholder={t('products.searchAddProducts', 'Search products by name or SKU...')}
      />

      {!isSearching && selectedCategoryId !== null && (
        <button
          type="button"
          onClick={() => setSelectedCategoryId(null)}
          className="flex shrink-0 items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {t('products.allCategories', 'All Categories')}
        </button>
      )}

      {!isSearching && selectedCategoryId === null && (
        <div className="flex min-h-0 flex-1 flex-col">
          {catsLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : categories.length === 0 ? (
            <p className="py-3 text-center text-xs text-[var(--color-text-secondary)]">
              {t('products.noCategories', 'No categories available')}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 overflow-y-auto flex-1 content-start">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(-1)}
                className={cn(
                  'group flex flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] p-2 text-center transition-all',
                  'hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5',
                  selectedCategoryId === -1 && 'border-[var(--color-primary)] bg-[var(--color-primary)]/5',
                )}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface-hover)] group-hover:bg-[var(--color-primary)]/10 transition-colors">
                  <LayoutGrid className="h-4 w-4 text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)]" />
                </div>
                <span className="text-[10px] font-medium text-[var(--color-text)] leading-tight">
                  {t('products.allProducts', 'All')}
                </span>
              </button>

              {(categories as Category[]).map((cat) => (
                <CategoryTile
                  key={cat.id}
                  category={cat}
                  isSelected={selectedCategoryId === cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {showProducts && (
        <div className="flex min-h-0 flex-1 flex-col gap-1.5">
          {selectedCategory && !isSearching && (
            <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">
              {selectedCategory.name}
              {selectedCategory.products_count != null && ` (${selectedCategory.products_count})`}
            </p>
          )}

          {isSearching && search.length >= 2 && (
            <p className="shrink-0 text-[10px] font-medium text-[var(--color-text-tertiary)]">
              {t('products.searchResults', 'Search results')}
              {searchData && ` (${searchData.data.length})`}
            </p>
          )}

          {isLoadingProducts ? (
            <div className="flex justify-center py-6">
              <Spinner size="sm" />
            </div>
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
                  key={product.id}
                  product={product}
                  quantity={quantityMap.get(product.id) ?? 0}
                  onAdd={() => onAddProduct(product)}
                  onUpdateQuantity={(qty) => onUpdateQuantity(product.id, qty)}
                  onRemove={() => onRemoveProduct(product.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!isSearching && selectedCategoryId === null && !catsLoading && categories.length > 0 && (
        <p className="text-center text-[10px] text-[var(--color-text-tertiary)]">
          {t('products.selectCategoryOrSearch', 'Select a category or search to browse products')}
        </p>
      )}
    </div>
  );
}

function CategoryTile({
  category,
  isSelected,
  onClick,
}: {
  category: Category;
  isSelected: boolean;
  onClick: () => void;
}) {
  const colors = [
    'bg-[var(--color-chart-1)]',
    'bg-[var(--color-chart-2)]',
    'bg-[var(--color-chart-3)]',
    'bg-[var(--color-chart-4)]',
    'bg-[var(--color-chart-5)]',
    'bg-[var(--color-secondary)]',
  ];
  const color = colors[category.id % colors.length];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center gap-1 rounded-lg border border-[var(--color-border)] p-2 text-center transition-all',
        'hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-primary)]/5',
        isSelected && 'border-[var(--color-primary)] bg-[var(--color-primary)]/5',
      )}
    >
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', color, 'bg-opacity-15')}>
        <Package className="h-4 w-4 text-[var(--color-text-secondary)]" />
      </div>
      <div className="flex w-full items-center justify-center gap-0.5">
        <span className="text-[10px] font-medium text-[var(--color-text)] leading-tight line-clamp-2">
          {category.name}
        </span>
        <ChevronRight className="h-2.5 w-2.5 shrink-0 text-[var(--color-text-tertiary)]" />
      </div>
      {category.products_count != null && (
        <span className="text-[9px] text-[var(--color-text-tertiary)] -mt-0.5">
          {category.products_count}
        </span>
      )}
    </button>
  );
}

function ProductItem({
  product,
  quantity,
  onAdd,
  onUpdateQuantity,
  onRemove,
}: {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  const isAdded = quantity > 0;

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
          <span className="text-[10px] text-[var(--color-text-tertiary)]">{product.sku}</span>
          <span className="text-[11px] font-semibold text-[var(--color-primary)]">
            {formatCurrency(product.price)}
          </span>
        </div>
      </div>

      {isAdded ? (
        <div className="flex items-center gap-0.5 shrink-0">
          {quantity === 1 ? (
            <button
              type="button"
              onClick={onRemove}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity - 1)}
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-surface)] text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (val > 0) onUpdateQuantity(val);
              else if (e.target.value === '' || val === 0) onRemove();
            }}
            className="h-7 w-10 rounded-md border-0 bg-[var(--color-surface)] text-center text-xs font-bold text-[var(--color-text)] ring-1 ring-[var(--color-border)] focus:ring-2 focus:ring-[var(--color-primary)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={() => onUpdateQuantity(quantity + 1)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/80 transition-colors"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
