import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { SearchInput, ErpErrorAlert } from '@/components/shared';
import { Card, Button, Spinner } from '@/components/ui';
import { ProductPicker } from '../components/ProductPicker';
import { OrderSummary } from '../components/OrderSummary';
import {
  ArrowLeft,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  Building2,
  MapPin,
  Check,
  CheckCircle2,
  Phone,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import { canHalfPack, packSize } from '@/lib/utils/packQty';
import type { ErpCartItem, ErpItem, ErpQuote, OrderFormItem } from '@/types';
import { erpErrorFromUnknown } from '@/lib/api/erp-error';

type Step = 'customer' | 'products' | 'review';

function erpErrorMessage(error: unknown, fallback: string): string {
  return erpErrorFromUnknown(error, fallback).message;
}

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id: routeId } = useParams<{ id: string }>();
  const location = useLocation();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const presetCustomerId = params.get('customerId');
  const isSavedEdit = /^\/orders\/saved\/\d+\/edit\/?$/.test(location.pathname);
  const savedId = isSavedEdit ? Number(routeId) : 0;
  const customerLocked = Boolean(presetCustomerId) || isSavedEdit;

  const [activeStep, setActiveStep] = useState<Step>(presetCustomerId || isSavedEdit ? 'products' : 'customer');
  const [customerId, setCustomerId] = useState<string | null>(presetCustomerId);
  const [customerSearch, setCustomerSearch] = useState('');
  const [items, setItems] = useState<ErpCartItem[]>([]);
  const [quote, setQuote] = useState<ErpQuote | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [cartExpanded, setCartExpanded] = useState(false);
  const [priceChanged, setPriceChanged] = useState(false);
  const [halfNotice, setHalfNotice] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const customerQuery = useQuery({
    queryKey: ['erp-customer', customerId],
    queryFn: () => erpApi.customer(customerId!),
    enabled: Boolean(customerId),
    retry: false,
  });

  const savedQuery = useQuery({
    queryKey: ['erp-saved-order', savedId],
    queryFn: () => erpApi.savedOrder(savedId),
    enabled: isSavedEdit && Number.isFinite(savedId) && savedId > 0,
    retry: false,
  });

  const { data: customersPage, isLoading: customersLoading, isError: customersError, error: customersErr } = useQuery({
    queryKey: ['erp-customers', customerSearch],
    queryFn: () => erpApi.customers({ search: customerSearch || undefined, limit: 100 }),
    enabled: !customerLocked,
    retry: false,
  });

  const filteredCustomers = customersPage?.items ?? [];
  const selectedCustomer = customerQuery.data
    ?? filteredCustomers.find((c) => c.customerId === customerId)
    ?? (customerId ? { customerId, name: customerId } as typeof filteredCustomers[0] : undefined);
  const customerCanHalf = selectedCustomer?.canRealHalfComp === true;

  const backTo = isSavedEdit
    ? `/orders/saved/${savedId}`
    : customerLocked && presetCustomerId
      ? `/customers/${encodeURIComponent(presetCustomerId)}`
      : '/orders';

  const quoteMutation = useMutation({
    mutationFn: () =>
      erpApi.quote({
        customerId: customerId!,
        lines: items.map((i) => ({ itemId: i.itemId, quantity: i.quantity })),
      }),
    onSuccess: (data) => {
      setQuote(data);
      setPriceChanged(false);
      setItems((prev) =>
        prev.map((item) => {
          const line = data.lines.find((l) => l.itemId === item.itemId);
          if (!line) return item;
          return {
            ...item,
            name: line.name,
            unit: line.unit,
            quantity: line.packQuantity ?? item.quantity,
            unitPrice: line.unitPrice,
            compRaod: line.compRaod ?? item.compRaod,
          };
        }),
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        customerId: customerId!,
        lines: items.map((item) => ({ itemId: item.itemId, quantity: item.quantity })),
      };
      return isSavedEdit
        ? erpApi.updateSavedOrder(savedId, payload)
        : erpApi.saveOrder(payload);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['erp-saved-orders'] });
      queryClient.invalidateQueries({ queryKey: ['erp-saved-order', saved.id] });
      queryClient.invalidateQueries({ queryKey: ['erp-orders'] });
      navigate(`/orders/saved/${saved.id}`);
    },
  });

  useEffect(() => {
    if (!savedQuery.data || hydrated) {
      return;
    }
    const saved = savedQuery.data;
    setCustomerId(saved.customerId);
    setItems(
      saved.lines.map((line) => ({
        itemId: line.itemId,
        name: line.name || line.itemId,
        unit: 'pc',
        quantity: String(Number(line.packQuantity)),
        unitPrice: line.unitPrice,
      })),
    );
    setActiveStep('products');
    setHydrated(true);
  }, [hydrated, savedQuery.data]);

  const handleSelectCustomer = useCallback((id: string) => {
    if (id !== customerId) {
      setItems([]);
      setQuote(null);
      setPriceChanged(false);
    }
    setCustomerId(id);
  }, [customerId]);

  const handleAddProduct = useCallback((product: ErpItem, quantity = '1') => {
    if (!product.unitPrice) return;
    setQuote(null);
    setItems((prev) => {
      const existing = prev.findIndex((item) => item.itemId === product.itemId);
      const allowHalf = canHalfPack(customerCanHalf, product.canRealHalfComp);
      if (existing >= 0) {
        const updated = [...prev];
        const next = (parseFloat(updated[existing].quantity) || 0) + (parseFloat(quantity) || 1);
        updated[existing] = {
          ...updated[existing],
          quantity: String(next),
          canRealHalfComp: allowHalf,
          compRaod: product.compRaod ?? updated[existing].compRaod,
        };
        return updated;
      }
      return [
        ...prev,
        {
          itemId: product.itemId,
          name: product.name,
          unit: product.unit,
          quantity,
          unitPrice: product.unitPrice,
          compRaod: product.compRaod,
          canRealHalfComp: allowHalf,
        },
      ];
    });
  }, [customerCanHalf]);

  const handleUpdateProductQuantity = useCallback((itemId: string, quantity: string) => {
    setQuote(null);
    setItems((prev) =>
      prev.map((item) => (item.itemId === itemId ? { ...item, quantity } : item)),
    );
  }, []);

  const handleRemoveProduct = useCallback((itemId: string) => {
    setQuote(null);
    setItems((prev) => prev.filter((item) => item.itemId !== itemId));
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setQuote(null);
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateItem = useCallback((index: number, updates: Partial<OrderFormItem>) => {
    setQuote(null);
    setItems((prev) => {
      const updated = [...prev];
      const qty = updates.quantity !== undefined ? String(updates.quantity) : updated[index].quantity;
      updated[index] = { ...updated[index], quantity: qty };
      return updated;
    });
  }, []);

  const summaryItems: OrderFormItem[] = useMemo(
    () =>
      items.map((item) => ({
        product_id: 0,
        product_name: item.name,
        quantity: parseFloat(item.quantity) || 0,
        unit_price: item.unitPrice ? parseFloat(item.unitPrice) : Number.NaN,
        discount_percent: 0,
        itemId: item.itemId,
        compRaod: item.compRaod,
        canRealHalfComp: item.canRealHalfComp === true,
      })),
    [items],
  );

  const promoByItemId = useMemo(() => {
    const map: Record<string, { promoUnitPrice: string; discount: string }> = {};
    for (const line of quote?.lines ?? []) {
      if (line.promoUnitPrice && line.promoDiscount) {
        map[line.itemId] = { promoUnitPrice: line.promoUnitPrice, discount: line.promoDiscount };
      }
    }
    return map;
  }, [quote]);

  const promoDiscountTotal = parseFloat(quote?.promoDiscountTotal ?? '0') || 0;

  async function handleReview() {
    if (items.length === 0) {
      setValidationErrors([t('orders.itemsRequired', 'Add at least one product')]);
      return;
    }
    setValidationErrors([]);
    setActiveStep('review');
    quoteMutation.mutate();
  }

  function handleSubmit() {
    if (items.length === 0) {
      setValidationErrors([t('orders.itemsRequired', 'Add at least one product')]);
      return;
    }
    saveMutation.mutate();
  }

  if (isSavedEdit && savedQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate('/orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('orders.backToOrders', 'Orders')}
        </Button>
        <ErpErrorAlert
          error={savedQuery.error}
          fallback={t('orders.orderNotFound', 'Order not found')}
        />
      </div>
    );
  }

  if (isSavedEdit && (savedQuery.isLoading || !hydrated)) {
    return (
      <div className="flex justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const displayTotal = quote?.total ?? items.reduce((sum, item) => {
    if (!item.unitPrice) return sum;
    return sum + parseFloat(item.unitPrice) * (parseFloat(item.quantity) || 0) * packSize(item.compRaod);
  }, 0);
  const cartCount = items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);

  const steps: { key: Step; label: string; done: boolean }[] = [
    { key: 'customer', label: t('orders.customer', 'Customer'), done: !!customerId },
    { key: 'products', label: t('products.title', 'Products'), done: items.length > 0 },
    { key: 'review', label: t('orders.review', 'Review'), done: false },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-16 sm:gap-3 lg:pb-4">
      <div className="sticky top-0 z-10 -mx-3 px-3 pb-1 pt-0.5 bg-[var(--color-bg)] flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(backTo)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {steps.map((step, i) => (
              <button
                key={step.key}
                type="button"
                onClick={() => {
                  if (customerLocked && step.key === 'customer') return;
                  setActiveStep(step.key);
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-all',
                  activeStep === step.key
                    ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]'
                    : step.done
                      ? 'bg-[var(--color-success-light)] text-[var(--color-success-fg)]'
                      : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
                )}
              >
                {step.done && activeStep !== step.key ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <span className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                    activeStep === step.key ? 'bg-white/20' : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
                  )}>
                    {i + 1}
                  </span>
                )}
                {step.label}
              </button>
            ))}
          </div>
        </div>

        {activeStep === 'products' && selectedCustomer && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--color-surface-hover)] px-2.5 py-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
            <span className="text-[var(--color-text-secondary)]">{t('orders.orderFor', 'Order for')}</span>
            <span className="font-semibold text-[var(--color-text)] truncate">{selectedCustomer.name}</span>
            {!customerLocked && (
              <button type="button" onClick={() => setActiveStep('customer')} className="ml-auto text-[11px] font-medium text-[var(--color-primary)]">
                {t('common.change', 'Change')}
              </button>
            )}
          </div>
        )}

        {halfNotice && (
          <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2">
            <p className="text-xs text-[var(--color-warning)]">{halfNotice}</p>
          </div>
        )}

        {priceChanged && (
          <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/10 px-3 py-2">
            <p className="text-xs text-[var(--color-warning)]">
              {t('orders.priceChanged', 'Price changed. Confirm the new quote before submitting.')}
            </p>
          </div>
        )}

        {promoDiscountTotal > 0 && (
          <div className="rounded-lg border border-[var(--color-info)]/30 bg-[var(--color-info-light)] px-3 py-2">
            <p className="text-xs text-[var(--color-info-fg)]">
              {t(
                'orders.promoNotApplied',
                'Promotions are informational: the order is placed at the full list price.',
              )}
            </p>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-light)] px-3 py-2">
            {validationErrors.map((err) => (
              <p key={err} className="text-xs text-[var(--color-danger)]">{err}</p>
            ))}
          </div>
        )}

        {(quoteMutation.isError || saveMutation.isError) && (
          <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-light)] px-3 py-2">
            <p className="text-xs text-[var(--color-danger)]">
              {erpErrorMessage(quoteMutation.error ?? saveMutation.error, t('orders.orderCreateError', 'Failed to create order. Please try again.'))}
            </p>
          </div>
        )}
      </div>

      {activeStep === 'customer' && !customerLocked && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
          <Card className="flex min-h-0 flex-1 flex-col gap-2.5 !p-3 sm:!p-4 sm:gap-3">
            <SearchInput
              value={customerSearch}
              onChange={setCustomerSearch}
              placeholder={t('orders.searchCustomer', 'Search customer by name or city...')}
            />
            {customersLoading ? (
              <div className="flex justify-center py-6"><Spinner size="sm" /></div>
            ) : customersError ? (
              <ErpErrorAlert
                error={customersErr}
                fallback={t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.')}
              />
            ) : filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6">
                <Users className="h-6 w-6 text-[var(--color-text-tertiary)]" />
                <p className="text-xs text-[var(--color-text-secondary)]">{t('orders.noCustomersFound', 'No customers found')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 flex-1 overflow-y-auto -mx-0.5 px-0.5">
                {filteredCustomers.map((customer) => {
                  const isSelected = customerId === customer.customerId;
                  const initials = customer.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
                  return (
                    <button
                      key={customer.customerId}
                      type="button"
                      onClick={() => handleSelectCustomer(customer.customerId)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-150 active:scale-[0.99]',
                        isSelected
                          ? 'bg-[var(--color-primary)]/8 ring-2 ring-[var(--color-primary)]'
                          : 'hover:bg-[var(--color-surface-hover)] ring-1 ring-[var(--color-border)]',
                      )}
                    >
                      <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        isSelected ? 'bg-[var(--color-primary)] text-white' : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
                      )}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[13px] font-semibold truncate leading-tight', isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]')}>
                          {customer.name}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-[var(--color-text-secondary)] truncate leading-tight mt-px">
                          <MapPin className="h-2.5 w-2.5 shrink-0" />
                          {[customer.address, customer.city].filter(Boolean).join(', ')}
                        </p>
                      </div>
                      {customer.phone && (
                        <span className="hidden sm:flex items-center gap-1 text-[11px] text-[var(--color-text-tertiary)] shrink-0">
                          <Phone className="h-2.5 w-2.5" />
                          {customer.phone}
                        </span>
                      )}
                      <div className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                        isSelected ? 'bg-[var(--color-primary)] text-white' : 'ring-1 ring-[var(--color-border)] bg-[var(--color-surface)]',
                      )}>
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {customerLocked && customerQuery.isLoading && (
        <div className="flex justify-center py-16"><Spinner /></div>
      )}
      {customerLocked && customerQuery.isError && (
        <ErpErrorAlert
          error={customerQuery.error}
          fallback={t('customers.customerNotFound', 'Customer not found')}
        />
      )}
      {activeStep === 'products' && customerId && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
          <Card className="flex min-h-0 flex-1 flex-col gap-2.5 !p-3 sm:!p-4 sm:gap-3">
            <ProductPicker
              customerId={customerId}
              customerCanHalf={customerCanHalf}
              onAddProduct={handleAddProduct}
              onUpdateQuantity={handleUpdateProductQuantity}
              onRemoveProduct={handleRemoveProduct}
              items={items}
            />
          </Card>
        </div>
      )}

      {activeStep === 'review' && (
        <div className="flex flex-col gap-2 sm:gap-3">
          {selectedCustomer && (
            <div className="flex items-center gap-2.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10">
                <Building2 className="h-4 w-4 text-[var(--color-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[var(--color-text)] truncate">{selectedCustomer.name}</p>
                <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                  {[selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}
          <Card className="flex flex-col gap-2.5 !p-3 sm:!p-4 sm:gap-3">
            {quoteMutation.isPending ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : (
              <OrderSummary
                items={summaryItems}
                onRemoveItem={handleRemoveItem}
                onUpdateItem={handleUpdateItem}
                hideDiscount
                serverTotal={quote?.total}
                promoByItemId={promoByItemId}
                promoDiscountTotal={quote?.promoDiscountTotal}
                onHalfDenied={() => setHalfNotice(t('orders.halfPackNotAllowed', 'Half packs are not allowed for this product or channel.'))}
              />
            )}
          </Card>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-14 z-20 sm:bottom-0">
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
          {activeStep === 'products' && cartExpanded && items.length > 0 && (
            <div className="max-h-40 overflow-y-auto border-b border-[var(--color-border)] px-3 py-1.5">
              {items.map((item, index) => (
                <div key={item.itemId} className="flex items-center justify-between py-1 text-xs">
                  <span className="truncate text-[var(--color-text)]">{item.quantity} × {item.name}</span>
                  <button type="button" onClick={() => handleRemoveItem(index)} className="text-[var(--color-text-tertiary)]">×</button>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2">
            {activeStep === 'customer' && !customerLocked && (
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (!customerId) {
                    setValidationErrors([t('orders.customerRequired', 'Please select a customer')]);
                    return;
                  }
                  setValidationErrors([]);
                  setActiveStep('products');
                }}
              >
                {t('orders.continueToProducts', 'Continue to Products')}
              </Button>
            )}
            {activeStep === 'products' && (
              items.length > 0 ? (
                <>
                  <button type="button" onClick={() => setCartExpanded(!cartExpanded)} className="flex items-center gap-1.5">
                    <ShoppingCart className="h-4 w-4 text-[var(--color-primary)]" />
                    {cartExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
                  </button>
                  <span className="text-xs font-bold">{formatCurrency(displayTotal)}</span>
                  <Button variant="primary" size="sm" onClick={handleReview} className="ml-auto">
                    {t('orders.reviewOrder', 'Review')} ({cartCount})
                  </Button>
                </>
              ) : (
                <p className="flex-1 text-center text-xs text-[var(--color-text-tertiary)]">
                  {t('orders.noItemsAdded', 'Browse categories or search to add products')}
                </p>
              )
            )}
            {activeStep === 'review' && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate(backTo)}>{t('common.cancel', 'Cancel')}</Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  loading={saveMutation.isPending}
                  disabled={items.length === 0}
                  className="flex-1"
                >
                  <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                  {isSavedEdit ? t('common.save', 'Save') : t('orders.saveOrder', 'Save order')}
                  {' — '}
                  {formatCurrency(displayTotal)}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
