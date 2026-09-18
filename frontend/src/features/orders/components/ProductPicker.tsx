import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { SearchInput } from '@/components/shared';
import { Spinner } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import { canHalfPack, formatPackQty, packSize, packStep, piecesFromPacks } from '@/lib/utils/packQty';
import { Plus, Minus, Trash2, Package } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { ErpCartItem, ErpItem } from '@/types';
import { erpErrorFromUnknown } from '@/lib/api/erp-error';
import { ProductTaxonomyFilters } from '@/features/products/components/ProductTaxonomyFilters';
import { compareItemsByProdT } from '@/lib/utils/sortItems';

interface ProductPickerProps {
  customerId: string;
  customerCanHalf?: boolean;
  /** Packs (order) or whole pieces (return). */
  quantityMode?: 'packs' | 'pieces';
  allowUnpriced?: boolean;
  fallbackCatalog?: boolean;
  onAddProduct: (item: ErpItem, quantity?: string) => void;
  onUpdateQuantity: (itemId: string, quantity: string) => void;
  onRemoveProduct: (itemId: string) => void;
  items: ErpCartItem[];
}

export function ProductPicker({
  customerId,
  customerCanHalf = false,
  quantityMode = 'packs',
  allowUnpriced = false,
  fallbackCatalog = false,
  onAddProduct,
  onUpdateQuantity,
  onRemoveProduct,
  items,
}: ProductPickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [prodS, setProdS] = useState<string | null>(null);
  const [prodT, setProdT] = useState<string | null>(null);
  const [halfNotice, setHalfNotice] = useState<string | null>(null);
  const piecesOnly = quantityMode === 'pieces';

  const quantityMap = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((i) => map.set(i.itemId, i.quantity));
    return map;
  }, [items]);

  const searching = search.length >= 2;
  const { data, isLoading, error } = useQuery({
    queryKey: ['erp-items', customerId, search, prodS, prodT, fallbackCatalog],
    queryFn: async () => {
      const params = {
        search: searching ? search : undefined,
        prodS: searching ? undefined : prodS || undefined,
        prodT: searching ? undefined : prodT || undefined,
        limit: 500,
      };
      try {
        return await erpApi.items({ customerId, ...params });
      } catch (error) {
        if (fallbackCatalog && erpErrorFromUnknown(error, '').code === 'ASSORTMENT_UNRESOLVED') {
          return erpApi.items(params);
        }
        throw error;
      }
    },
    enabled: !!customerId,
  });

  const { data: taxonomy = [] } = useQuery({
    queryKey: ['erp-item-taxonomy'],
    queryFn: () => erpApi.itemTaxonomy(),
    enabled: !!customerId,
  });

  const allItems = data?.items ?? [];
  const products = useMemo(
    () => [...allItems].sort(compareItemsByProdT),
    [allItems],
  );

  function showHalfDenied() {
    setHalfNotice(t('orders.halfPackNotAllowed', 'Half packs are not allowed for this product or channel.'));
  }

  return (
    <div className="flex h-full min-h-[min(72dvh,34rem)] flex-1 flex-col gap-2">
      <div className="shrink-0">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('products.searchAddProducts', 'Search products by name or SKU...')}
        />
      </div>

      {halfNotice && !piecesOnly && (
        <div className="shrink-0 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2">
          <p className="text-xs text-[var(--color-warning)]">{halfNotice}</p>
        </div>
      )}

      {!searching && (
        <div className="shrink-0">
          <ProductTaxonomyFilters
            taxonomy={taxonomy}
            prodS={prodS}
            prodT={prodT}
            onChange={({ prodS: nextS, prodT: nextT }) => {
              setProdS(nextS);
              setProdT(nextT);
            }}
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <Spinner size="sm" />
        </div>
      ) : error ? (
        <p className="py-4 text-center text-xs text-[var(--color-danger)]">
          {erpErrorFromUnknown(error, t('products.catalogError', 'Catalog is unavailable for this customer.')).message}
        </p>
      ) : products.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 py-6">
          <Package className="h-6 w-6 text-[var(--color-text-tertiary)]" />
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t('products.noProductsFound', 'No products found')}
          </p>
        </div>
      ) : (
        <div className="min-h-[min(48dvh,22rem)] flex-1 overflow-y-auto overscroll-contain">
          <div className="flex flex-col gap-1 pb-1">
            {products.map((product) => (
              <ProductItem
                key={product.itemId}
                product={product}
                quantity={quantityMap.get(product.itemId) ?? '0'}
                piecesOnly={piecesOnly}
                allowUnpriced={allowUnpriced}
                allowHalf={!piecesOnly && canHalfPack(customerCanHalf, product.canRealHalfComp)}
                onAdd={() => onAddProduct(product, piecesOnly ? '1' : undefined)}
                onAddHalf={() => onAddProduct(product, '0.5')}
                onUpdateQuantity={(qty) => onUpdateQuantity(product.itemId, qty)}
                onRemove={() => onRemoveProduct(product.itemId)}
                onHalfDenied={showHalfDenied}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductItem({
  product,
  quantity,
  piecesOnly,
  allowUnpriced,
  allowHalf,
  onAdd,
  onAddHalf,
  onUpdateQuantity,
  onRemove,
  onHalfDenied,
}: {
  product: ErpItem;
  quantity: string;
  piecesOnly: boolean;
  allowUnpriced: boolean;
  allowHalf: boolean;
  onAdd: () => void;
  onAddHalf: () => void;
  onUpdateQuantity: (qty: string) => void;
  onRemove: () => void;
  onHalfDenied: () => void;
}) {
  const { t } = useTranslation();
  const qtyNum = parseFloat(quantity) || 0;
  const isAdded = qtyNum > 0;
  const priceLabel = product.unitPrice ? formatCurrency(product.unitPrice) : '—';
  const canAdd = allowUnpriced || !!product.unitPrice;
  const size = piecesOnly ? 1 : packSize(product.compRaod);
  const step = piecesOnly ? 1 : packStep(allowHalf);
  const pieces = piecesFromPacks(qtyNum, product.compRaod);
  const qtyLabel = piecesOnly ? String(Math.round(qtyNum)) : formatPackQty(qtyNum);

  function setPiecesQty(raw: number) {
    if (!Number.isFinite(raw)) {
      return;
    }
    const next = Math.max(0, Math.round(raw));
    if (next < 1) {
      onRemove();
      return;
    }
    onUpdateQuantity(String(next));
  }

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
        <div className="flex items-center gap-1.5 mt-px flex-wrap">
          <span className="text-[10px] text-[var(--color-text-tertiary)]">{product.itemId}</span>
          {!piecesOnly && size > 1 && (
            <span className="text-[10px] text-[var(--color-text-secondary)]">
              {t('orders.packEquals', '1 pack = {{count}} pcs', { count: size })}
            </span>
          )}
          {piecesOnly ? (
            <span className="text-[10px] text-[var(--color-text-secondary)]">
              {t('orders.piece', 'pc')}
            </span>
          ) : (
            product.unit && size <= 1 && (
              <span className="text-[10px] text-[var(--color-text-tertiary)]">{product.unit}</span>
            )
          )}
          <span className="text-[11px] font-semibold text-[var(--color-primary)]">{priceLabel}</span>
        </div>
        {isAdded && !piecesOnly && size > 1 && (
          <span className="text-[10px] text-[var(--color-text-tertiary)] mt-px">
            {t('orders.packPieces', '{{packs}} pack = {{pieces}} pcs', {
              packs: formatPackQty(qtyNum),
              pieces: formatPackQty(pieces),
            })}
          </span>
        )}
      </div>

      {!canAdd ? (
        <span className="text-[10px] text-[var(--color-text-tertiary)]">N/A</span>
      ) : isAdded ? (
        <div className="flex items-center gap-0.5 shrink-0">
          {qtyNum <= step ? (
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
              onClick={() =>
                piecesOnly
                  ? setPiecesQty(qtyNum - 1)
                  : onUpdateQuantity(formatPackQty(qtyNum - step))
              }
              className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}
          {piecesOnly ? (
            <input
              type="number"
              min={1}
              step={1}
              value={Math.round(qtyNum)}
              onChange={(e) => setPiecesQty(parseFloat(e.target.value))}
              className="h-7 w-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-center text-xs font-bold text-[var(--color-text)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
          ) : (
            <span className="min-w-8 text-center text-xs font-bold">{qtyLabel}</span>
          )}
          <button
            type="button"
            onClick={() =>
              piecesOnly
                ? setPiecesQty(qtyNum + 1)
                : onUpdateQuantity(formatPackQty(qtyNum + step))
            }
            className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-primary)] text-white"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          {!piecesOnly && (
            <button
              type="button"
              onClick={() => {
                if (!allowHalf) onHalfDenied();
              }}
              className={cn(
                'ml-0.5 flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[10px] font-bold',
                allowHalf
                  ? 'bg-[var(--color-success-light)] text-[var(--color-success-fg)]'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] ring-1 ring-[var(--color-border)]',
              )}
              title={allowHalf
                ? t('orders.halfPackAllowed', 'Half pack allowed')
                : t('orders.halfPackNotAllowed', 'Half packs are not allowed for this product or channel.')}
            >
              ½
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-0.5 shrink-0">
          {!piecesOnly && (
            <button
              type="button"
              onClick={() => (allowHalf ? onAddHalf() : onHalfDenied())}
              className={cn(
                'flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[10px] font-bold',
                allowHalf
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] ring-1 ring-[var(--color-border)]',
              )}
              title={allowHalf
                ? t('orders.halfPackAllowed', 'Half pack allowed')
                : t('orders.halfPackNotAllowed', 'Half packs are not allowed for this product or channel.')}
            >
              ½
            </button>
          )}
          <button
            type="button"
            onClick={onAdd}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
