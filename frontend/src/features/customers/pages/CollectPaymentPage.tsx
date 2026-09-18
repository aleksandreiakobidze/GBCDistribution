import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, MapPin, Users } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { Button, Card, Input, Spinner, Textarea } from '@/components/ui';
import { ErpErrorAlert, SearchInput } from '@/components/shared';

export default function CollectPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isCashEdit = /^\/collections\/\d+\/edit\/?$/.test(location.pathname);
  const cashId = isCashEdit ? Number(id) : 0;

  const routeCustomerId = isCashEdit ? '' : (id || params.get('customerId') || '');
  const [pickedCustomerId, setPickedCustomerId] = useState(routeCustomerId);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [hydrated, setHydrated] = useState(false);

  const cashQuery = useQuery({
    queryKey: ['erp-collection', cashId],
    queryFn: () => erpApi.collection(cashId),
    enabled: isCashEdit && Number.isFinite(cashId) && cashId > 0,
    retry: false,
  });

  const customerId = isCashEdit
    ? (cashQuery.data?.customerId ?? '')
    : (routeCustomerId || pickedCustomerId);
  const backTo = isCashEdit
    ? `/collections/${cashId}`
    : customerId && id
      ? `/customers/${encodeURIComponent(customerId)}`
      : '/collections';

  const customerQuery = useQuery({
    queryKey: ['erp-customer', customerId],
    queryFn: () => erpApi.customer(customerId),
    enabled: customerId !== '',
    retry: false,
  });

  const customersQuery = useQuery({
    queryKey: ['erp-customers', customerSearch],
    queryFn: () => erpApi.customers({ search: customerSearch || undefined, limit: 100 }),
    enabled: !isCashEdit && customerId === '',
    retry: false,
  });

  useEffect(() => {
    if (!isCashEdit || !cashQuery.data || hydrated) {
      return;
    }
    setAmount(cashQuery.data.amount);
    setNote(cashQuery.data.note ?? '');
    setHydrated(true);
  }, [cashQuery.data, hydrated, isCashEdit]);

  const collectMutation = useMutation({
    mutationFn: () =>
      isCashEdit
        ? erpApi.updateCollection(cashId, {
            amount: amount.trim(),
            method: 'cash',
            note: note.trim() || undefined,
          })
        : erpApi.collect({
            customerId,
            amount: amount.trim(),
            method: 'cash',
            note: note.trim() || undefined,
          }),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['erp-collections'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-collection', saved.id] });
      navigate(`/collections/${saved.id}`);
    },
  });

  if (isCashEdit && cashQuery.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate('/collections')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('collections.title', 'Cash')}
        </Button>
        <ErpErrorAlert
          error={cashQuery.error}
          fallback={t('collections.notFound', 'Cash not found')}
        />
      </div>
    );
  }

  if (customerId === '') {
    const customers = customersQuery.data?.items ?? [];
    return (
      <div className="flex flex-col gap-4 pb-6">
        <Button variant="ghost" className="self-start" onClick={() => navigate('/collections')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('collections.title', 'Cash')}
        </Button>
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            {t('customers.collectTitle', 'Collect cash')}
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

  if (customerQuery.isLoading || !customerQuery.data || (isCashEdit && !hydrated)) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  const amountNum = Number(amount.replace(',', '.'));
  const canSubmit = Number.isFinite(amountNum) && amountNum > 0 && !collectMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" className="self-start" onClick={() => navigate(backTo)}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        {customerQuery.data.name}
      </Button>

      <Card>
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          {isCashEdit ? t('common.edit', 'Edit') : t('customers.collectTitle', 'Collect cash')}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {t('customers.collectHint', 'This record stays in the app for this customer. FMG balance is not changed.')}
        </p>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) {
              collectMutation.mutate();
            }
          }}
        >
          <Input
            label={t('customers.collectAmount', 'Amount')}
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--color-text)]">
              {t('customers.collectMethod', 'Method')}
            </span>
            <p className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-3 py-2.5 text-sm">
              {t('customers.collectCashMethod', 'Cash')}
            </p>
          </div>
          <Textarea
            label={t('customers.collectNote', 'Note')}
            rows={3}
            maxLength={300}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {collectMutation.isError && (
            <ErpErrorAlert
              error={collectMutation.error}
              fallback={t('customers.collectError', 'Could not record the cash.')}
            />
          )}
          <Button type="submit" variant="primary" disabled={!canSubmit} loading={collectMutation.isPending}>
            {isCashEdit ? t('common.save', 'Save') : t('customers.collectSubmit', 'Save cash')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
