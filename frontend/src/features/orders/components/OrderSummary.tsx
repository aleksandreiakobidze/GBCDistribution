import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/utils/format';
import { formatPackQty, packSize, packStep, piecesFromPacks } from '@/lib/utils/packQty';
import { Trash2, Minus, Plus } from 'lucide-react';
import type { OrderFormItem } from '@/types';

interface OrderSummaryProps {
  items: OrderFormItem[];
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, updates: Partial<OrderFormItem>) => void;
  hideDiscount?: boolean;
  serverTotal?: string;
  /** Promo values are shown for information only and never change the total. */
  promoByItemId?: Record<string, { promoUnitPrice: string; discount: string }>;
  promoDiscountTotal?: string;
  /** True while a fresh quote is in flight: promo values shown are still the previous ones. */
  promoPending?: boolean;
  onHalfDenied?: () => void;
}

export function OrderSummary({
  items,
  onRemoveItem,
  onUpdateItem,
  hideDiscount,
  serverTotal,
  promoByItemId,
  promoDiscountTotal,
  promoPending,
  onHalfDenied,
}: OrderSummaryProps) {
  const { t } = useTranslation();
  const promoTotal = parseFloat(promoDiscountTotal ?? '0') || 0;
  const promoMuted = promoPending ? 'opacity-60' : '';

  const linePieces = (item: OrderFormItem) => piecesFromPacks(item.quantity, item.compRaod);

  const totalPacks = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const totalPieces = items.reduce((sum, item) => sum + linePieces(item), 0);

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price) * linePieces(item),
    0,
  );
  const discountTotal = items.reduce(
    (sum, item) =>
      sum + Number(item.unit_price) * linePieces(item) * (item.discount_percent / 100),
    0,
  );
  const grandTotal = subtotal - discountTotal;
  const chargedTotal = Number(serverTotal ?? grandTotal);
  const promoAdjustedTotal = chargedTotal - promoTotal;

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[var(--color-border)] py-8 px-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-surface-hover)]">
          <svg className="h-5 w-5 text-[var(--color-text-tertiary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
        </div>
        <p className="text-xs font-medium text-[var(--color-text-secondary)]">
          {t('orders.emptyCart', 'Your cart is empty')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item, index) => {
        const pieces = linePieces(item);
        const size = packSize(item.compRaod);
        const allowHalf = item.canRealHalfComp === true;
        const step = packStep(allowHalf);
        const lineTotal =
          Number(item.unit_price) * pieces * (1 - item.discount_percent / 100);
        const promo = item.itemId ? promoByItemId?.[item.itemId] : undefined;
        return (
          <div
            key={`${item.product_id}-${index}`}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[var(--color-text)] truncate leading-tight">
                  {item.product_name || `Product #${item.product_id}`}
                </p>
                <p className="text-[10px] text-[var(--color-text-tertiary)] mt-px">
                  {formatCurrency(item.unit_price)} / {t('orders.piece', 'pc')}
                  {size > 1 ? ` · ${t('orders.packEquals', '1 pack = {{count}} pcs', { count: size })}` : ''}
                </p>
                {promo && (
                  <p className={`text-[10px] text-[var(--color-info-fg)] mt-px ${promoMuted}`}>
                    {t('orders.promoLineHint', 'Promotion {{price}} / unit — {{amount}} would be saved', {
                      price: formatCurrency(promo.promoUnitPrice),
                      amount: formatCurrency(promo.discount),
                    })}
                  </p>
                )}
              </div>
              <p className="text-[13px] font-bold text-[var(--color-text)] shrink-0">
                {formatCurrency(lineTotal)}
              </p>
            </div>

            <div className="mt-2 flex items-center gap-2">
              <div className="flex items-center rounded-md border border-[var(--color-border)]">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateItem(index, { quantity: Math.max(step, item.quantity - step) })
                  }
                  className="flex h-7 w-7 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-l-md transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  min={step}
                  step={step}
                  value={item.quantity}
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value);
                    if (!Number.isFinite(raw) || raw < step) {
                      onUpdateItem(index, { quantity: step });
                      return;
                    }
                    const snapped = allowHalf ? Math.round(raw * 2) / 2 : Math.round(raw);
                    if (!allowHalf && snapped !== raw && raw % 1 !== 0) {
                      onHalfDenied?.();
                    }
                    onUpdateItem(index, { quantity: Math.max(step, snapped) });
                  }}
                  className="h-7 w-10 border-x border-[var(--color-border)] bg-[var(--color-surface)] text-center text-xs font-medium text-[var(--color-text)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => onUpdateItem(index, { quantity: item.quantity + step })}
                  className="flex h-7 w-7 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-r-md transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                {t('orders.linePieces', '{{count}} pcs', { count: formatPackQty(pieces) })}
              </span>

              {!hideDiscount && (
              <div className="flex items-center gap-0.5">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={item.discount_percent}
                  onChange={(e) =>
                    onUpdateItem(index, {
                      discount_percent: Math.min(
                        100,
                        Math.max(0, parseFloat(e.target.value) || 0),
                      ),
                    })
                  }
                  className="h-7 w-12 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-center text-xs text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]/20 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-[10px] text-[var(--color-text-tertiary)]">%</span>
              </div>
              )}

              <button
                type="button"
                onClick={() => onRemoveItem(index)}
                className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)] transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Totals */}
      <div className="rounded-lg bg-[var(--color-surface-inset)] p-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs gap-2">
            <div className="min-w-0">
              <p className="text-[var(--color-text-secondary)]">{t('orders.subtotal', 'Subtotal')}</p>
              <p className="text-[10px] font-medium text-[var(--color-text)] mt-0.5">
                {t('orders.subtotalQty', '{{packs}} packs · {{pieces}} pcs', {
                  packs: formatPackQty(totalPacks),
                  pieces: formatPackQty(totalPieces),
                })}
              </p>
            </div>
            <span className="text-[var(--color-text)] shrink-0">
              {formatCurrency(subtotal)}
            </span>
          </div>
          {discountTotal > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--color-text-secondary)]">
                {t('orders.discount', 'Discount')}
              </span>
              <span className="text-[var(--color-danger)]">
                −{formatCurrency(discountTotal)}
              </span>
            </div>
          )}
          {promoTotal > 0 && (
            <div className={`flex items-center justify-between text-xs ${promoMuted}`}>
              <span className="text-[var(--color-text-secondary)]">
                {t('orders.promoWouldBeDiscount', 'Promotion (not applied)')}
              </span>
              <span className="text-[var(--color-info-fg)]">
                −{formatCurrency(promoTotal)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-1.5 text-sm">
            <span className="font-semibold text-[var(--color-text)]">
              {t('common.total', 'Total')}
            </span>
            <span className="font-bold text-[var(--color-primary)]">
              {formatCurrency(chargedTotal)}
            </span>
          </div>
          {promoTotal > 0 && (
            <div className={`flex items-center justify-between text-sm ${promoMuted}`}>
              <span className="font-medium text-[var(--color-info-fg)]">
                {t('orders.promoWouldBeTotal', 'With promotion')}
              </span>
              <span className="font-bold text-[var(--color-info-fg)]">
                {formatCurrency(promoAdjustedTotal)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
