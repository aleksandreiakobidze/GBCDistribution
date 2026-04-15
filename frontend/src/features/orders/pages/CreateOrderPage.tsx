import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ordersApi } from '@/lib/api/orders.api';
import { customersApi } from '@/lib/api/customers.api';
import { useUiStore } from '@/stores/uiStore';
import { SearchInput } from '@/components/shared';
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
import type { Product, OrderFormItem } from '@/types';

type Step = 'customer' | 'products' | 'review';

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeStep, setActiveStep] = useState<Step>('customer');
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [items, setItems] = useState<OrderFormItem[]>([]);
  const { defaultWarehouseId } = useUiStore();
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [cartExpanded, setCartExpanded] = useState(false);

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['customers-all'],
    queryFn: () => customersApi.getAll({ per_page: 100 }),
  });

  const filteredCustomers = useMemo(() => {
    const all = customersData?.data ?? [];
    if (!customerSearch.trim()) return all;
    const q = customerSearch.toLowerCase();
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.contact_person?.toLowerCase().includes(q),
    );
  }, [customersData, customerSearch]);

  const selectedCustomer = customersData?.data.find((c) => c.id === customerId);

  const createMutation = useMutation({
    mutationFn: ordersApi.create,
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      navigate(`/orders/${order.id}`);
    },
  });

  const handleAddProduct = useCallback((product: Product) => {
    setItems((prev) => {
      const existing = prev.findIndex((item) => item.product_id === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + 1,
        };
        return updated;
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: product.price,
          discount_percent: 0,
        },
      ];
    });
  }, []);

  const handleUpdateProductQuantity = useCallback((productId: number, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.product_id === productId ? { ...item, quantity } : item,
      ),
    );
  }, []);

  const handleRemoveProduct = useCallback((productId: number) => {
    setItems((prev) => prev.filter((item) => item.product_id !== productId));
  }, []);

  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleUpdateItem = useCallback(
    (index: number, updates: Partial<OrderFormItem>) => {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], ...updates };
        return updated;
      });
    },
    [],
  );

  function handleSubmit() {
    const errors: string[] = [];
    if (!customerId) errors.push(t('orders.customerRequired', 'Please select a customer'));
    if (items.length === 0) errors.push(t('orders.itemsRequired', 'Add at least one product'));
    if (errors.length > 0) {
      setValidationErrors(errors);
      if (!customerId) setActiveStep('customer');
      return;
    }
    setValidationErrors([]);

    createMutation.mutate({
      customer_id: customerId!,
      warehouse_id: Number(defaultWarehouseId),
      items: items.map(({ product_name, ...rest }) => rest),
    });
  }

  const cartTotal = items.reduce(
    (sum, item) =>
      sum + Number(item.unit_price) * item.quantity * (1 - item.discount_percent / 100),
    0,
  );
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const steps: { key: Step; label: string; done: boolean }[] = [
    { key: 'customer', label: t('orders.customer', 'Customer'), done: !!customerId },
    { key: 'products', label: t('products.title', 'Products'), done: items.length > 0 },
    { key: 'review', label: t('orders.review', 'Review'), done: false },
  ];

  return (
    <div className="flex flex-col gap-2 pb-16 sm:gap-3 lg:pb-4 h-[calc(100dvh-7rem)] sm:h-[calc(100dvh-5rem)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 -mx-3 px-3 pb-1 pt-0.5 bg-[var(--color-bg)] flex flex-col gap-1.5 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {steps.map((step, i) => (
              <button
                key={step.key}
                type="button"
                onClick={() => setActiveStep(step.key)}
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
                    activeStep === step.key
                      ? 'bg-white/20'
                      : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)]',
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
            <button
              type="button"
              onClick={() => setActiveStep('customer')}
              className="ml-auto text-[11px] font-medium text-[var(--color-primary)]"
            >
              {t('common.change', 'Change')}
            </button>
          </div>
        )}

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-light)] px-3 py-2">
            {validationErrors.map((err) => (
              <p key={err} className="text-xs text-[var(--color-danger)]">{err}</p>
            ))}
          </div>
        )}

        {createMutation.isError && (
          <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger-light)] px-3 py-2">
            <p className="text-xs text-[var(--color-danger)]">
              {t('orders.orderCreateError', 'Failed to create order. Please try again.')}
            </p>
          </div>
        )}
      </div>

      {/* Step 1: Customer */}
      {activeStep === 'customer' && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
          <Card className="flex min-h-0 flex-1 flex-col gap-2.5 !p-3 sm:!p-4 sm:gap-3">
            <SearchInput
              value={customerSearch}
              onChange={setCustomerSearch}
              placeholder={t('orders.searchCustomer', 'Search customer by name or city...')}
            />

            {customersLoading ? (
              <div className="flex justify-center py-6">
                <Spinner size="sm" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 py-6">
                <Users className="h-6 w-6 text-[var(--color-text-tertiary)]" />
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('orders.noCustomersFound', 'No customers found')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1 flex-1 overflow-y-auto -mx-0.5 px-0.5">
                {filteredCustomers.map((customer) => {
                  const isSelected = customerId === customer.id;
                  const initials = customer.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase();
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setCustomerId(customer.id)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-150',
                        'active:scale-[0.99]',
                        isSelected
                          ? 'bg-[var(--color-primary)]/8 ring-2 ring-[var(--color-primary)]'
                          : 'hover:bg-[var(--color-surface-hover)] ring-1 ring-[var(--color-border)]',
                      )}
                    >
                      <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors',
                        isSelected
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
                      )}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-[13px] font-semibold truncate leading-tight',
                          isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text)]',
                        )}>
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
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all',
                        isSelected
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'ring-1 ring-[var(--color-border)] bg-[var(--color-surface)]',
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

      {/* Step 2: Products */}
      {activeStep === 'products' && (
        <div className="flex min-h-0 flex-1 flex-col gap-2 sm:gap-3">
          <Card className="flex min-h-0 flex-1 flex-col gap-2.5 !p-3 sm:!p-4 sm:gap-3">
            <ProductPicker
              onAddProduct={handleAddProduct}
              onUpdateQuantity={handleUpdateProductQuantity}
              onRemoveProduct={handleRemoveProduct}
              items={items}
            />
          </Card>
        </div>
      )}

      {/* Step 3: Review */}
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
                  {selectedCustomer.address}, {selectedCustomer.city}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep('customer')}
                className="text-[11px] font-medium text-[var(--color-primary)]"
              >
                {t('common.edit', 'Edit')}
              </button>
            </div>
          )}

          <Card className="flex flex-col gap-2.5 !p-3 sm:!p-4 sm:gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShoppingCart className="h-4 w-4 text-[var(--color-primary)]" />
                <h2 className="text-[13px] font-semibold text-[var(--color-text)]">
                  {t('orders.orderItems', 'Order Items')}
                  <span className="ml-1.5 text-xs font-normal text-[var(--color-text-secondary)]">
                    ({items.length})
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveStep('products')}
                className="text-[11px] font-medium text-[var(--color-primary)]"
              >
                + {t('orders.addMore', 'Add More')}
              </button>
            </div>

            <OrderSummary
              items={items}
              onRemoveItem={handleRemoveItem}
              onUpdateItem={handleUpdateItem}
            />
          </Card>

        </div>
      )}

      {/* Floating bottom bar */}
      <div className="fixed inset-x-0 bottom-14 z-20 sm:bottom-0">
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)]">
          {/* Expandable cart list (products step only) */}
          {activeStep === 'products' && cartExpanded && items.length > 0 && (
            <div className="max-h-40 overflow-y-auto border-b border-[var(--color-border)] px-3 py-1.5">
              {items.map((item, index) => (
                <div key={item.product_id} className="flex items-center justify-between py-1 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[var(--color-primary)]/10 text-[10px] font-bold text-[var(--color-primary)]">
                      {item.quantity}
                    </span>
                    <span className="truncate text-[var(--color-text)]">{item.product_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[var(--color-text-secondary)]">
                      {formatCurrency(Number(item.unit_price) * item.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 px-3 py-2">
            {/* Step 1: Continue to Products */}
            {activeStep === 'customer' && (
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

            {/* Step 2: Cart summary + Review */}
            {activeStep === 'products' && (
              <>
                {items.length > 0 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setCartExpanded(!cartExpanded)}
                      className="flex items-center gap-1.5"
                    >
                      <div className="relative">
                        <ShoppingCart className="h-4 w-4 text-[var(--color-primary)]" />
                        <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-primary)] text-[9px] font-bold text-white">
                          {cartCount}
                        </span>
                      </div>
                      {cartExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                      ) : (
                        <ChevronUp className="h-3.5 w-3.5 text-[var(--color-text-secondary)]" />
                      )}
                    </button>
                    <span className="text-xs font-bold text-[var(--color-text)]">
                      {formatCurrency(cartTotal)}
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setActiveStep('review')}
                      className="ml-auto"
                    >
                      {t('orders.reviewOrder', 'Review')} ({cartCount})
                    </Button>
                  </>
                ) : (
                  <p className="flex-1 text-center text-xs text-[var(--color-text-tertiary)]">
                    {t('orders.noItemsAdded', 'Browse categories or search to add products')}
                  </p>
                )}
              </>
            )}

            {/* Step 3: Cancel + Place Order */}
            {activeStep === 'review' && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate('/orders')}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSubmit}
                  loading={createMutation.isPending}
                  disabled={items.length === 0}
                  className="flex-1"
                >
                  <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                  {t('orders.placeOrder', 'Place Order')} — {formatCurrency(cartTotal)}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
