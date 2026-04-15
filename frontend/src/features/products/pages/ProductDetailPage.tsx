import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { productsApi } from '@/lib/api/products.api';
import { Card, Badge, Button, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import { ArrowLeft, Package } from 'lucide-react';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: () => productsApi.getById(Number(id)),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-[var(--color-text-secondary)]">
          {t('products.productNotFound', 'Product not found')}
        </p>
        <Button variant="ghost" onClick={() => navigate('/products')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('products.backToProducts', 'Back to Products')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button
        variant="ghost"
        onClick={() => navigate('/products')}
        className="self-start"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('products.backToProducts', 'Back to Products')}
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="flex items-center justify-center lg:col-span-1">
          <div className="flex h-56 w-full items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/10 to-violet-500/10">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <Package className="h-20 w-20 text-[var(--color-primary)]/40" />
            )}
          </div>
        </Card>

        <Card className="flex flex-col gap-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text)]">
                {product.name}
              </h1>
              {product.name_ka && (
                <p className="mt-0.5 text-sm text-[var(--color-text-secondary)]">
                  {product.name_ka}
                </p>
              )}
            </div>
            <Badge
              variant={product.is_active ? 'success' : 'danger'}
              size="md"
            >
              {product.is_active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InfoRow label={t('products.sku', 'SKU')} value={product.sku} />
            <InfoRow
              label={t('products.barcode', 'Barcode')}
              value={product.barcode || '—'}
            />
            <InfoRow
              label={t('products.category', 'Category')}
              value={product.category?.name || '—'}
            />
            <InfoRow label={t('products.unit', 'Unit')} value={product.unit} />
            <InfoRow
              label={t('common.price', 'Price')}
              value={formatCurrency(product.price)}
              highlight
            />
            <InfoRow
              label={t('products.costPrice', 'Cost Price')}
              value={formatCurrency(product.cost_price)}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
        {label}
      </span>
      <span
        className={
          highlight
            ? 'text-lg font-bold text-[var(--color-primary)]'
            : 'text-sm font-medium text-[var(--color-text)]'
        }
      >
        {value}
      </span>
    </div>
  );
}
