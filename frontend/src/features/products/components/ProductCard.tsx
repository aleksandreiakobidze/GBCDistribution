import type { Product } from '@/types';
import { Card, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import { Package } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
}

const categoryColors = [
  'bg-[var(--color-chart-1)]',
  'bg-[var(--color-chart-2)]',
  'bg-[var(--color-chart-4)]',
  'bg-[var(--color-chart-3)]',
  'bg-[var(--color-chart-5)]',
  'bg-[var(--color-secondary)]',
  'bg-[var(--color-primary)]',
  'bg-[var(--color-accent)]',
];

function getPlaceholderColor(id: number) {
  return categoryColors[id % categoryColors.length];
}

export function ProductCard({ product, onClick }: ProductCardProps) {
  return (
    <Card hoverable onClick={onClick} className="overflow-hidden p-0">
      <div
        className={`${getPlaceholderColor(product.id)} flex h-40 items-center justify-center`}
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <Package className="h-12 w-12 text-white/70" />
        )}
      </div>

      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)] leading-tight line-clamp-2">
            {product.name}
          </h3>
          <span
            className={`inline-flex h-2 w-2 shrink-0 rounded-full mt-1.5 ${
              product.is_active ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-tertiary)]'
            }`}
          />
        </div>

        {product.category && (
          <Badge variant="primary" size="sm">
            {product.category.name}
          </Badge>
        )}

        <p className="text-xs text-[var(--color-text-secondary)]">
          SKU: {product.sku}
        </p>

        <p className="text-lg font-bold text-[var(--color-primary)]">
          {formatCurrency(product.price)}
        </p>
      </div>
    </Card>
  );
}
