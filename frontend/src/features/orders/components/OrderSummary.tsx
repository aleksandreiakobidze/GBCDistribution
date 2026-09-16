import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/utils/format';
import { Trash2, Minus, Plus } from 'lucide-react';
import type { OrderFormItem } from '@/types';

interface OrderSummaryProps {
  items: OrderFormItem[];
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, updates: Partial<OrderFormItem>) => void;
  hideDiscount?: boolean;
  serverTotal?: string;
}

export function OrderSummary({ items, onRemoveItem, onUpdateItem, hideDiscount, serverTotal }: OrderSummaryProps) {
  const { t } = useTranslation();

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0,
  );
  const discountTotal = items.reduce(
    (sum, item) =>
      sum + Number(item.unit_price) * item.quantity * (item.discount_percent / 100),
    0,
  );
  const grandTotal = subtotal - discountTotal;

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
        const lineTotal =
          Number(item.unit_price) * item.quantity * (1 - item.discount_percent / 100);
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
                  {formatCurrency(item.unit_price)} / unit
                </p>
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
                    onUpdateItem(index, { quantity: Math.max(1, item.quantity - 1) })
                  }
                  className="flex h-7 w-7 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-l-md transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) =>
                    onUpdateItem(index, {
                      quantity: Math.max(1, parseInt(e.target.value) || 1),
                    })
                  }
                  className="h-7 w-10 border-x border-[var(--color-border)] bg-[var(--color-surface)] text-center text-xs font-medium text-[var(--color-text)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => onUpdateItem(index, { quantity: item.quantity + 1 })}
                  className="flex h-7 w-7 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] rounded-r-md transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>

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
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-secondary)]">
              {t('orders.subtotal', 'Subtotal')} ({items.length} {items.length === 1 ? t('common.item', 'item') : t('common.items', 'items')})
            </span>
            <span className="text-[var(--color-text)]">
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
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-1.5 text-sm">
            <span className="font-semibold text-[var(--color-text)]">
              {t('common.total', 'Total')}
            </span>
            <span className="font-bold text-[var(--color-primary)]">
              {formatCurrency(serverTotal ?? grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
