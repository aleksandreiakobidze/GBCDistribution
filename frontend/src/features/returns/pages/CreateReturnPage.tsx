import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Package, Minus, Plus } from 'lucide-react';
import { Button, Card, Select, Textarea, Badge } from '@/components/ui';
import { PageHeader } from '@/components/shared';
import { returnsApi } from '@/lib/api/returns.api';
import { ordersApi } from '@/lib/api/orders.api';
import { formatCurrency } from '@/lib/utils/format';
import type { Order, OrderItem } from '@/types';

interface ReturnItemEntry {
  product_id: number;
  product_name: string;
  quantity: number;
  max_quantity: number;
  unit_price: number;
  condition: string;
}

const CONDITION_OPTIONS = [
  { value: 'damaged', label: 'Damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'wrong_item', label: 'Wrong Item' },
  { value: 'other', label: 'Other' },
];

export default function CreateReturnPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [returnItems, setReturnItems] = useState<ReturnItemEntry[]>([]);

  const { data: ordersData } = useQuery({
    queryKey: ['orders-delivered'],
    queryFn: () => ordersApi.getAll({ status: 'delivered' }),
  });

  const { data: orderDetail } = useQuery({
    queryKey: ['order-detail', selectedOrderId],
    queryFn: () => ordersApi.getById(Number(selectedOrderId)),
    enabled: !!selectedOrderId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof returnsApi.create>[0]) =>
      returnsApi.create(payload),
    onSuccess: () => navigate('/returns'),
  });

  const orders = ordersData?.data ?? [];
  const orderOptions = orders.map((o: Order) => ({
    value: String(o.id),
    label: `${o.order_number} — ${o.customer?.name ?? 'Unknown'}`,
  }));

  function handleOrderSelect(val: string) {
    setSelectedOrderId(val);
    setReturnItems([]);
  }

  function toggleItem(item: OrderItem) {
    const exists = returnItems.find((ri) => ri.product_id === item.product!.id);
    if (exists) {
      setReturnItems(returnItems.filter((ri) => ri.product_id !== item.product!.id));
    } else {
      setReturnItems([
        ...returnItems,
        {
          product_id: item.product!.id,
          product_name: item.product!.name,
          quantity: item.quantity,
          max_quantity: item.quantity,
          unit_price: item.unit_price,
          condition: 'damaged',
        },
      ]);
    }
  }

  function updateItemQuantity(productId: number, delta: number) {
    setReturnItems(
      returnItems.map((ri) =>
        ri.product_id === productId
          ? { ...ri, quantity: Math.max(1, Math.min(ri.max_quantity, ri.quantity + delta)) }
          : ri,
      ),
    );
  }

  function updateItemCondition(productId: number, condition: string) {
    setReturnItems(
      returnItems.map((ri) =>
        ri.product_id === productId ? { ...ri, condition } : ri,
      ),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOrderId || !reason || returnItems.length === 0) return;
    createMutation.mutate({
      order_id: Number(selectedOrderId),
      reason,
      items: returnItems.map((ri) => ({
        product_id: ri.product_id,
        quantity: ri.quantity,
        unit_price: ri.unit_price,
        condition: ri.condition,
      })),
    });
  }

  const returnTotal = returnItems.reduce((sum, ri) => sum + ri.quantity * ri.unit_price, 0);
  const orderItems = orderDetail?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('returns.createReturn')}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('/returns')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('common.back')}
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Selection */}
        <Card className="p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Order Information
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Select Order"
              placeholder="Choose a delivered order..."
              options={orderOptions}
              value={selectedOrderId}
              onChange={handleOrderSelect}
            />
          </div>
          <div className="mt-4">
            <Textarea
              label={t('returns.reason')}
              placeholder="Explain the reason for return..."
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </Card>

        {/* Order Items */}
        {selectedOrderId && orderItems.length > 0 && (
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--color-border)] px-6 py-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Select Items to Return
              </h3>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {orderItems.map((item) => {
                const selected = returnItems.find((ri) => ri.product_id === item.product?.id);
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 px-6 py-4 transition-colors ${
                      selected ? 'bg-[var(--color-primary)]/5' : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(item)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                        selected
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                          : 'border-[var(--color-border)]'
                      }`}
                    >
                      {selected && <span className="text-xs font-bold">✓</span>}
                    </button>

                    <div className="flex flex-1 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-[var(--color-text)]">{item.product?.name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                    </div>

                    {selected && (
                      <div className="flex items-center gap-3">
                        <Select
                          options={CONDITION_OPTIONS}
                          value={selected.condition}
                          onChange={(val) => updateItemCondition(item.product!.id, val)}
                          className="w-32"
                        />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item.product!.id, -1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-10 text-center text-sm font-semibold">
                            {selected.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateItemQuantity(item.product!.id, 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Summary & Submit */}
        {returnItems.length > 0 && (
          <Card className="p-6">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Return Summary
            </h3>
            <div className="space-y-3">
              {returnItems.map((ri) => (
                <div key={ri.product_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-text)]">{ri.product_name}</span>
                    <Badge variant="default" size="sm">
                      {ri.condition.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <span className="font-medium">
                    {ri.quantity} × {formatCurrency(ri.unit_price)} = {formatCurrency(ri.quantity * ri.unit_price)}
                  </span>
                </div>
              ))}
              <div className="border-t border-[var(--color-border)] pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[var(--color-text)]">Total Return Value</span>
                  <span className="text-lg font-bold text-[var(--color-text)]">
                    {formatCurrency(returnTotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => navigate('/returns')}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending}
                disabled={!selectedOrderId || !reason || returnItems.length === 0}
              >
                {t('returns.createReturn')}
              </Button>
            </div>
          </Card>
        )}
      </form>
    </div>
  );
}
