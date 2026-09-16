import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { Card, Badge, Button, Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import { ArrowLeft, Package } from 'lucide-react';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const customerId = params.get('customerId') ?? '';
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { data: product, isLoading } = useQuery({
    queryKey: ['erp-item', id, customerId],
    queryFn: () => erpApi.item(id!, customerId),
    enabled: !!id && !!customerId,
  });

  if (!customerId) {
    return (
      <div className="py-10 text-center text-sm text-[var(--color-text-secondary)]">
        {t('products.selectCustomerFirst', 'Select a customer to load the authorized assortment and prices.')}
        <div className="mt-4">
          <Button variant="ghost" onClick={() => navigate('/products')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('products.backToProducts', 'Back to Products')}
          </Button>
        </div>
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
        <Button variant="ghost" onClick={() => navigate('/products')} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('products.backToProducts', 'Back to Products')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" onClick={() => navigate('/products')} className="self-start">
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
          <div>
            <p className="text-xs text-[var(--color-text-tertiary)]">{t('products.unit', 'Unit')}: {product.unit}</p>
            <p className="text-xl font-bold text-[var(--color-primary)]">
              {product.unitPrice ? formatCurrency(product.unitPrice) : t('products.priceUnavailable', 'Price unavailable')}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
