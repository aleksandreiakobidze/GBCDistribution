import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared';
import PriceListCatalog from '../components/PriceListCatalog';

export default function ProductListPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <PageHeader title={t('products.title', 'Products')} />
      <PriceListCatalog />
    </div>
  );
}
