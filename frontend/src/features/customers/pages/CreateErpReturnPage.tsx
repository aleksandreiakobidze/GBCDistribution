import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, CheckCircle2, MapPin, Minus, Plus, RotateCcw, Trash2, Users } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { Button, Card, Select, Spinner, Textarea } from '@/components/ui';
import { ErpErrorAlert, SearchInput } from '@/components/shared';
import { ProductPicker } from '@/features/orders/components/ProductPicker';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import type { ErpCartItem, ErpItem } from '@/types';

const RETURN_REASONS = ['damaged', 'expired', 'wrong_item', 'other'] as const;

type ReturnStep = 'products' | 'review';

type ReturnLineDraft = {
  itemId: string;
  name: string;
  quantity: string;
  reason: string;
  unit: string;
  unitPrice: string | null;
};

export default function CreateErpReturnPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isReturnEdit = /^\/returns\/\d+\/edit\/?$/.test(location.pathname);
  const existingId = isReturnEdit ? Number(id) : 0;
  const routeCustomerId = isReturnEdit ? '' : (id || params.get('customerId') || '');
  const [pickedCustomerId, setPickedCustomerId] = useState(routeCustomerId);
  const [step, setStep] = useState<ReturnStep>('products');
  const [note, setNote] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [lines, setLines] = useState<ReturnLineDraft[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const existingQuery = useQuery({
    queryKey: ['erp-product-return', existingId],
    queryFn: () => erpApi.productReturn(existingId),
    enabled: isReturnEdit && Number.isFinite(existingId) && existingId > 0,
    retry: false,
  });

  const customerId = isReturnEdit
    ? (existingQuery.data?.customerId ?? '')
    : (routeCustomerId || pickedCustomerId);
  const backTo = isReturnEdit
    ? `/returns/${existingId}`
    : customerId && id
      ? `/customers/${encodeURIComponent(customerId)}`
      : '/returns';

  const customerQuery = useQuery({
    queryKey: ['erp-customer', customerId],
    queryFn: () => erpApi.customer(customerId),
    enabled: customerId !== '',
    retry: false,
  });

  const customersQuery = useQuery({
    queryKey: ['erp-customers', customerSearch],
    queryFn: () => erpApi.customers({ search: customerSearch || undefined, limit: 100 }),
    enabled: !isReturnEdit && customerId === '',
    retry: false,
  });

  const warehousesQuery = useQuery({
    queryKey: ['erp-warehouses'],
    queryFn: () => erpApi.warehouses(),
    enabled: customerId !== '',
    retry: false,
  });

  const warehouseOptions = useMemo(
    () =>
      (warehousesQuery.data?.items ?? []).map((row) => ({
        value: row.id,
        label: row.name,
      })),
    [warehousesQuery.data],
  );

  const reasonOptions = RETURN_REASONS.map((reason) => ({
    value: reason,
    label: t(`customers.reasons.${reason}`, reason),
  }));

  const pickerItems: ErpCartItem[] = useMemo(
    () =>
      lines.map((line) => ({
        itemId: line.itemId,
        name: line.name,
        unit: line.unit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      })),
    [lines],
  );

  const totalPieces = lines.reduce((sum, line) => sum + (Math.round(parseFloat(line.quantity) || 0)), 0);
  const chargedTotal = lines.reduce((sum, line) => {
    const qty = Math.round(parseFloat(line.quantity) || 0);
    const price = parseFloat(line.unitPrice ?? '');
    return Number.isFinite(price) ? sum + price * qty : sum;
  }, 0);

  const returnMutation = useMutation({
    mutationFn: () => {
      const payload = {
        customerId,
        warehouseId,
        note: note.trim() || undefined,
        lines: lines.map((line) => ({
          itemId: line.itemId,
          quantity: line.quantity,
          reason: line.reason,
        })),
      };
      return isReturnEdit
        ? erpApi.updateProductReturn(existingId, payload)
        : erpApi.createProductReturn(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['erp-product-returns'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-product-return', saved.id] });
      await queryClient.invalidateQueries({ queryKey: ['erp-product-returns', customerId] });
      navigate(`/returns/${saved.id}`);
    },
  });

  useEffect(() => {
    if (!isReturnEdit || !existingQuery.data || hydrated) {
      return;
    }
    const row = existingQuery.data;
    setNote(row.note ?? '');
    setWarehouseId(row.warehouseId ?? '');
    setLines(
      row.lines.map((line) => ({
        itemId: line.itemId,
        name: line.name || line.itemId,
        quantity: String(Math.max(1, Math.round(Number(line.quantity) || 1))),
        reason: line.reason,
        unit: 'pc',
        unitPrice: null,
      })),
    );
    setHydrated(true);
  }, [existingQuery.data, hydrated, isReturnEdit]);

  useEffect(() => {
    if (warehouseId !== '' || warehouseOptions.length !== 1) {
      return;
    }
    setWarehouseId(warehouseOptions[0].value);
  }, [warehouseId, warehouseOptions]);

  function handleAddProduct(product: ErpItem, quantity = '1') {
    const addQty = Math.max(1, Math.round(parseFloat(quantity) || 1));
    setLines((prev) => {
      const existing = prev.findIndex((line) => line.itemId === product.itemId);
      if (existing >= 0) {
        const next = [...prev];
        const current = Math.round(parseFloat(next[existing].quantity) || 0);
        next[existing] = { ...next[existing], quantity: String(current + addQty) };
        return next;
      }
      return [
        ...prev,
        {
          itemId: product.itemId,
          name: product.name,
          quantity: String(addQty),
          reason: 'damaged',
          unit: product.unit,
          unitPrice: product.unitPrice,
        },
      ];
    });
  }

  function handleUpdateQuantity(itemId: string, quantity: string) {
    const nextQty = Math.round(parseFloat(quantity) || 0);
    if (nextQty < 1) {
      handleRemoveProduct(itemId);
      return;
    }
    setLines((prev) =>
      prev.map((line) => (line.itemId === itemId ? { ...line, quantity: String(nextQty) } : line)),
    );
  }

  function handleRemoveProduct(itemId: string) {
    setLines((prev) => {
      const next = prev.filter((line) => line.itemId !== itemId);
      if (next.length === 0) {
        setStep('products');
      }
      return next;
    });
  }

  const canSubmit =
    lines.length > 0
    && lines.every((line) => Number(line.quantity) > 0)
    && warehouseId !== ''
    && !returnMutation.isPending;
  const steps = [
    { key: 'products' as const, label: t('products.title', 'Products'), done: lines.length > 0 },
    { key: 'review' as const, label: t('orders.review', 'Review'), done: false },
  ];

  if (isReturnEdit && existingQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate('/returns')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('returns.title', 'Returns')}
        </Button>
        <ErpErrorAlert
          error={existingQuery.error}
          fallback={t('returns.notFound', 'Return not found')}
        />
      </div>
    );
  }

  if (isReturnEdit && (existingQuery.isLoading || !hydrated)) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (customerId === '') {
    const customers = customersQuery.data?.items ?? [];
    return (
      <div className="flex flex-col gap-4 pb-6">
        <Button variant="ghost" className="self-start" onClick={() => navigate('/returns')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('returns.title', 'Returns')}
        </Button>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            {t('customers.returnTitle', 'Return products')}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t('orders.selectCustomer', 'Select a customer')}
          </p>
        </div>
        <Card className="flex min-h-[18rem] flex-col gap-2.5 !p-3 sm:!p-4">
          <SearchInput
            value={customerSearch}
            onChange={setCustomerSearch}
            placeholder={t('orders.searchCustomer', 'Search customer by name or city...')}
          />
          {customersQuery.isLoading ? (
            <div className="flex justify-center py-6"><Spinner size="sm" /></div>
          ) : customersQuery.isError ? (
            <ErpErrorAlert
              error={customersQuery.error}
              fallback={t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.')}
            />
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-6">
              <Users className="h-6 w-6 text-[var(--color-text-tertiary)]" />
              <p className="text-xs text-[var(--color-text-secondary)]">
                {t('orders.noCustomersFound', 'No customers found')}
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {customers.map((customer) => (
                <button
                  key={customer.customerId}
                  type="button"
                  onClick={() => setPickedCustomerId(customer.customerId)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left ring-1 ring-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-hover)] text-[11px] font-bold text-[var(--color-text-secondary)]">
                    {customer.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--color-text)]">{customer.name}</p>
                    <p className="mt-px flex items-center gap-1 truncate text-[11px] text-[var(--color-text-secondary)]">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      {[customer.address, customer.city].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <Check className="h-4 w-4 shrink-0 text-transparent" />
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (customerQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate('/customers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('customers.backToCustomers', 'Back to Customers')}
        </Button>
        <ErpErrorAlert
          error={customerQuery.error}
          fallback={t('customers.customerNotFound', 'Customer not found')}
        />
      </div>
    );
  }

  if (customerQuery.isLoading || !customerQuery.data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-16 sm:gap-3 lg:pb-4">
      <div className="sticky top-0 z-10 -mx-3 flex shrink-0 flex-col gap-1.5 bg-[var(--color-bg)] px-3 pb-1 pt-0.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {steps.map((item, index) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  if (item.key === 'review' && lines.length === 0) return;
                  setStep(item.key);
                }}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
                  step === item.key
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]'
                    : item.done
                      ? 'bg-[var(--color-success-light)] text-[var(--color-success-fg)]'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
                )}
              >
                {item.done && step !== item.key ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <span className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                    step === item.key ? 'bg-white/20' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
                  )}>
                    {index + 1}
                  </span>
                )}
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {step === 'products' && (
          <div className="shrink-0">
            <p className="text-sm font-semibold text-[var(--color-text)]">
              {t('customers.returnTitle', 'Return products')}
            </p>
            <p className="text-[11px] text-[var(--color-text-secondary)]">
              {t('customers.returnPiecesHint', 'Choose quantity in pieces. Packs and half-packs are not used.')}
            </p>
          </div>
        )}
      </div>

      {step === 'products' && (
        <Card className="flex min-h-0 flex-1 flex-col gap-2 !p-3 sm:!p-4">
          <Select
            label={t('customers.returnWarehouse', 'საწყობი')}
            options={warehouseOptions}
            value={warehouseId || undefined}
            onChange={setWarehouseId}
            placeholder={t('customers.returnWarehouseRequired', 'აირჩიეთ საწყობი')}
          />
          {warehousesQuery.isError ? (
            <ErpErrorAlert
              error={warehousesQuery.error}
              fallback={t('customers.returnWarehouseRequired', 'აირჩიეთ საწყობი')}
            />
          ) : null}
          <ProductPicker
            customerId={customerId}
            quantityMode="pieces"
            allowUnpriced
            showPromotions={false}
            assortmentMode="return"
            items={pickerItems}
            onAddProduct={handleAddProduct}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveProduct={handleRemoveProduct}
          />
        </Card>
      )}

      {step === 'review' && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-2">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)]">
              {t('orders.review', 'Review')}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t('customers.returnReviewHint', 'Return is recorded in pieces. Promotions are not used.')}
            </p>
          </div>

          <Card className="flex flex-col gap-2.5 !p-3 sm:!p-4">
            <Select
              label={t('customers.returnWarehouse', 'საწყობი')}
              options={warehouseOptions}
              value={warehouseId || undefined}
              onChange={setWarehouseId}
              placeholder={t('customers.returnWarehouseRequired', 'აირჩიეთ საწყობი')}
            />
            {warehouseId === '' ? (
              <p className="text-xs text-[var(--color-danger)]">
                {t('customers.returnWarehouseRequired', 'აირჩიეთ საწყობი')}
              </p>
            ) : null}
            {lines.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                {t('customers.returnItemsRequired', 'Add at least one product')}
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {lines.map((line) => {
                  const qty = Math.round(parseFloat(line.quantity) || 0);
                  const unitPrice = parseFloat(line.unitPrice ?? '');
                  const lineTotal = Number.isFinite(unitPrice) ? unitPrice * qty : null;
                  return (
                    <li
                      key={line.itemId}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold leading-tight text-[var(--color-text)]">
                            {line.name}
                          </p>
                          <p className="mt-px text-[10px] text-[var(--color-text-tertiary)]">
                            {formatCurrency(line.unitPrice)} / {t('orders.piece', 'pc')}
                          </p>
                        </div>
                        <p className="shrink-0 text-[13px] font-bold text-[var(--color-text)]">
                          {lineTotal == null ? '—' : formatCurrency(lineTotal)}
                        </p>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="flex items-center rounded-md border border-[var(--color-border)]">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(line.itemId, String(qty - 1))}
                            className="flex h-7 w-7 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                          >
                            {qty <= 1 ? <Trash2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          </button>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={qty}
                            onChange={(event) => handleUpdateQuantity(line.itemId, event.target.value)}
                            className="h-7 w-10 border-x border-[var(--color-border)] bg-[var(--color-surface)] text-center text-xs font-medium text-[var(--color-text)] focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(line.itemId, String(qty + 1))}
                            className="flex h-7 w-7 items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
                          {qty} {t('orders.piece', 'pc')}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(line.itemId)}
                          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-tertiary)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="mt-2">
                        <Select
                          label={t('customers.returnReason', 'Reason')}
                          options={reasonOptions}
                          value={line.reason}
                          onChange={(value) =>
                            setLines((prev) =>
                              prev.map((row) => (row.itemId === line.itemId ? { ...row, reason: value } : row)),
                            )
                          }
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="rounded-lg bg-[var(--color-surface-inset)] p-3">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <p className="text-[var(--color-text-secondary)]">{t('orders.subtotal', 'Subtotal')}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-[var(--color-text)]">
                    {t('orders.linePieces', '{{count}} pcs', { count: totalPieces })}
                  </p>
                </div>
                <span className="text-[var(--color-text)]">{formatCurrency(chargedTotal)}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-between border-t border-[var(--color-border)] pt-1.5 text-sm">
                <span className="font-semibold text-[var(--color-text)]">{t('common.total', 'Total')}</span>
                <span className="font-bold text-[var(--color-primary)]">{formatCurrency(chargedTotal)}</span>
              </div>
            </div>

            <Textarea
              label={t('common.notes', 'Notes')}
              rows={3}
              maxLength={300}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            {returnMutation.isError && (
              <ErpErrorAlert
                error={returnMutation.error}
                fallback={t('customers.returnError', 'Could not record the return.')}
              />
            )}
          </Card>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-14 z-20 sm:bottom-0">
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
          <div className="flex items-center gap-2 px-3 py-2">
            {step === 'products' && (
              lines.length > 0 ? (
                <>
                  <span className="text-xs font-bold">{totalPieces} {t('orders.piece', 'pc')}</span>
                  <Button variant="primary" size="sm" className="ml-auto" onClick={() => setStep('review')}>
                    {t('orders.review', 'Review')} ({lines.length})
                  </Button>
                </>
              ) : (
                <p className="flex-1 text-center text-xs text-[var(--color-text-tertiary)]">
                  {t('customers.returnItemsRequired', 'Add at least one product')}
                </p>
              )
            )}
            {step === 'review' && (
              <>
                <Button variant="outline" size="sm" onClick={() => setStep('products')}>
                  {t('common.back', 'Back')}
                </Button>
                <Button
                  className="flex-1"
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={!canSubmit}
                  loading={returnMutation.isPending}
                  onClick={() => returnMutation.mutate()}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  {isReturnEdit ? t('common.save', 'Save') : t('customers.returnSubmit', 'Save return')}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
