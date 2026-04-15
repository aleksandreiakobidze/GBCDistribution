import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { productsApi } from '@/lib/api/products.api';
import { PageHeader, SearchInput, Pagination } from '@/components/shared';
import { ProductCard } from '../components/ProductCard';
import { cn } from '@/lib/utils/cn';

export default function ProductListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [categoryId, setCategoryId] = useState<number | undefined>(
    searchParams.get('category') ? Number(searchParams.get('category')) : undefined,
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(debounceRef.current ?? undefined);
  }, [search]);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (debouncedSearch) params.q = debouncedSearch;
    if (page > 1) params.page = String(page);
    if (categoryId) params.category = String(categoryId);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, page, categoryId, setSearchParams]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: productsApi.getCategories,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', { page, search: debouncedSearch, category_id: categoryId }],
    queryFn: () =>
      productsApi.getAll({ page, search: debouncedSearch || undefined, category_id: categoryId }),
  });

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('products.title', 'Products')} />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <SearchInput
          value={search}
          onChange={handleSearch}
          placeholder={t('products.searchProducts', 'Search products...')}
          className="w-full sm:max-w-sm"
        />
      </div>

      {categories && categories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setCategoryId(undefined); setPage(1); }}
            className={cn(
              'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
              !categoryId
                ? 'bg-[var(--color-primary)] text-white shadow-sm'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text)]',
            )}
          >
            {t('common.all', 'All')}
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setCategoryId(cat.id); setPage(1); }}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200',
                categoryId === cat.id
                  ? 'bg-[var(--color-primary)] text-white shadow-sm'
                  : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 hover:text-[var(--color-text)]',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <div className="h-40 rounded-t-2xl bg-[var(--color-surface-hover)]" />
              <div className="flex flex-col gap-3 p-4">
                <div className="h-4 w-3/4 rounded bg-[var(--color-surface-hover)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--color-surface-hover)]" />
                <div className="h-3 w-1/3 rounded bg-[var(--color-surface-hover)]" />
                <div className="h-5 w-1/4 rounded bg-[var(--color-surface-hover)]" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data?.data.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onClick={() => navigate(`/products/${product.id}`)}
              />
            ))}
          </div>

          {data?.data.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-lg font-medium text-[var(--color-text-secondary)]">
                {t('products.noProducts', 'No products found')}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]/70">
                {t('products.adjustFilters', 'Try adjusting your search or filter')}
              </p>
            </div>
          )}

          {data?.meta && data.meta.last_page > 1 && (
            <Pagination
              currentPage={data.meta.current_page}
              totalPages={data.meta.last_page}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
