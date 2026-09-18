import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { Card, Badge, Button, Spinner } from '@/components/ui';
import { ArrowLeft, Package } from 'lucide-react';
import { ErpErrorAlert } from '@/components/shared';
import { formatCurrency } from '@/lib/utils/format';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const customerId = params.get('customerId');
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: ['erp-item', id, customerId],
    queryFn: () => erpApi.item(id!, customerId || undefined),
    enabled: !!id,
  });

  const backTo = customerId
    ? `/products?customerId=${encodeURIComponent(customerId)}`
    : '/products';

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate(backTo)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('products.backToProducts', 'Back to Products')}
        </Button>
        <ErpErrorAlert
          error={error}
          fallback={t('products.productNotFound', 'Product not found')}
        />
      </div>
    );
  }

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
        <Button variant="ghost" onClick={() => navigate(backTo)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('products.backToProducts', 'Back to Products')}
        </Button>
      </div>
    );
  }

  const rows: Array<{ label: string; value: string }> = [
    { label: t('products.sku', 'SKU'), value: product.prodCode || product.itemId },
    { label: t('products.unit', 'Unit'), value: product.unitName || product.unit },
    { label: t('products.prodS', 'Category'), value: product.prodS || '—' },
    { label: t('products.type', 'Type'), value: product.type || '—' },
    { label: t('products.group', 'Group'), value: product.group || '—' },
    { label: t('products.category', 'Category'), value: product.category || '—' },
  ];
  if (product.compRaod) {
    rows.push({ label: t('products.packQty', 'Pack qty'), value: product.compRaod });
  }
  if (customerId) {
    rows.unshift({
      label: t('products.listPrice', 'List price'),
      value: product.unitPrice
        ? formatCurrency(product.unitPrice)
        : t('products.priceUnavailable', 'Price unavailable'),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" onClick={() => navigate(backTo)} className="self-start">
        <ArrowLeft className="mr-2 h-4 w-4" />
        {t('products.backToProducts', 'Back to Products')}
      </Button>
      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">{product.itemId}</p>
          </div>
          <Badge variant={product.active ? 'success' : 'default'}>
            {product.active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          <Package className="h-10 w-10 text-[var(--color-primary)]/40" />
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-[var(--color-text-tertiary)]">{row.label}</dt>
              <dd className="text-sm font-medium text-[var(--color-text)]">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}
