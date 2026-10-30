import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { erpApi } from '@/lib/api/erp.api';
import { Card, Badge, Button, Spinner } from '@/components/ui';
import { ErpErrorAlert } from '@/components/shared';
import { ArrowLeft, Banknote, MapPin, Navigation, Package, Percent, Phone, Plus, RotateCcw, TriangleAlert } from 'lucide-react';
import { isPlottableCoord } from '@/lib/utils/geo';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRouteDirections } from '@/hooks/useRouteDirections';
import { CustomerMap } from '../components/CustomerMap';
import { VisitActions } from '../components/VisitActions';
import { PlanogramEditor } from '@/features/shelf/PlanogramEditor';
import { useAuthStore } from '@/stores/authStore';
import type { ErpVisitSchedule } from '@/types';

const WEEKDAYS: Array<{ key: keyof ErpVisitSchedule; labelKey: string; fallback: string }> = [
  { key: 'mon', labelKey: 'customers.days.mon', fallback: 'Mon' },
  { key: 'tue', labelKey: 'customers.days.tue', fallback: 'Tue' },
  { key: 'wed', labelKey: 'customers.days.wed', fallback: 'Wed' },
  { key: 'thu', labelKey: 'customers.days.thu', fallback: 'Thu' },
  { key: 'fri', labelKey: 'customers.days.fri', fallback: 'Fri' },
  { key: 'sat', labelKey: 'customers.days.sat', fallback: 'Sat' },
  { key: 'sun', labelKey: 'customers.days.sun', fallback: 'Sun' },
];

function displayText(value: string | null | undefined): string | null {
  const text = value?.trim() || '';
  return text || null;
}

function formatKegQty(value: string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return value;
  }
  return String(num);
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--color-surface-hover)] px-3 py-2.5">
      <p className="text-[11px] font-medium leading-none text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1.5 break-words text-sm font-semibold leading-snug text-[var(--color-text)]">{value}</p>
    </div>
  );
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const salesUserIdRaw = params.get('salesUserId');
  const salesUserId = salesUserIdRaw ? Number(salesUserIdRaw) : undefined;
  const backTo = role === 'supervisor' || role === 'manager' ? '/routes' : '/customers';
  const isSales = role === 'sales_rep';

  const { data: customer, isLoading, isError, error } = useQuery({
    queryKey: ['erp-customer', id, salesUserId],
    queryFn: () => erpApi.customer(id!, { salesUserId }),
    enabled: !!id,
  });

  const [routeOn, setRouteOn] = useState(false);
  const geo = useGeolocation();
  const pinned = isPlottableCoord(customer?.latitude, customer?.longitude);
  const directions = useRouteDirections({
    origin: routeOn && geo.latitude != null && geo.longitude != null ? [geo.latitude, geo.longitude] : null,
    stops:
      customer && pinned
        ? [
            {
              id: customer.customerId,
              name: customer.name,
              latitude: customer.latitude,
              longitude: customer.longitude,
            },
          ]
        : [],
    enabled: routeOn,
  });

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="ghost" onClick={() => navigate(backTo)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('customers.backToCustomers', 'Back to Customers')}
        </Button>
        <ErpErrorAlert
          error={error}
          fallback={t('customers.customerNotFound', 'Customer not found')}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg font-medium text-[var(--color-text-secondary)]">
          {t('customers.customerNotFound', 'Customer not found')}
        </p>
        <Button variant="ghost" onClick={() => navigate(backTo)} className="mt-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('customers.backToCustomers', 'Back to Customers')}
        </Button>
      </div>
    );
  }

  const schedule = customer.schedule;
  const encodedId = encodeURIComponent(customer.customerId);
  const newOrderTo = `/orders/new?customerId=${encodedId}`;
  const collectTo = `/customers/${encodedId}/collect`;
  const returnTo = `/customers/${encodedId}/return`;
  const promotionsTo = `/customers/${encodedId}/promotions`;
  const address = [customer.address, customer.city].filter(Boolean).join(', ') || '—';
  const kegs = customer.kegs ?? [];
  const code = customer.orgCode || customer.customerId;
  const channel = displayText(customer.orgT);
  const paymentDay = Number.isFinite(customer.paymentDay) ? Number(customer.paymentDay) : 0;
  const valiLimitText =
    customer.valiLimit != null && customer.valiLimit !== ''
      ? formatCurrency(customer.valiLimit)
      : null;
  const monthLimitText =
    customer.monthLimit != null && Number.isFinite(Number(customer.monthLimit))
      ? String(customer.monthLimit)
      : null;
  const facts = [
    { label: t('customers.orgT', 'Channel'), value: channel },
    { label: t('customers.sagad', 'Vatnumber'), value: displayText(customer.sagad) },
    { label: t('customers.qseli', 'Qseli'), value: displayText(customer.qseli) },
    { label: t('customers.orgCategory', 'OrgCategory'), value: displayText(customer.orgCategory) },
    { label: t('customers.creditLimit', 'საკრედიტო ლიმიტი'), value: valiLimitText },
    {
      label: t('customers.paymentDay', 'გადახდის თარიღი'),
      value: paymentDay === 0 ? t('customers.monthEnd', 'თვის ბოლო') : String(paymentDay),
    },
    { label: t('customers.monthLimit', 'თვის ლიმიტი'), value: monthLimitText },
  ].filter((row): row is { label: string; value: string } => row.value != null && row.value !== '');

  const balanceNum =
    customer.balance != null && customer.balance !== '' ? Number(customer.balance) : null;
  const hasBalance = balanceNum != null && Number.isFinite(balanceNum);
  const debtTone = !hasBalance ? null : balanceNum > 0 ? 'debt' : balanceNum < 0 ? 'credit' : 'even';
  const minOrder =
    customer.minOrderTotal != null && customer.minOrderTotal !== ''
      ? Number(customer.minOrderTotal)
      : null;
  const maxOrder =
    customer.maxOrderTotal != null && customer.maxOrderTotal !== ''
      ? Number(customer.maxOrderTotal)
      : null;
  const hasMinOrder = minOrder != null && Number.isFinite(minOrder) && minOrder > 0;
  const hasMaxOrder = maxOrder != null && Number.isFinite(maxOrder) && maxOrder > 0;
  const overdueNum =
    customer.overdueBalance != null && customer.overdueBalance !== ''
      ? Number(customer.overdueBalance)
      : null;
  const hasOverdue = overdueNum != null && Number.isFinite(overdueNum) && overdueNum > 0;
  const moneyTiles = [hasBalance, hasMinOrder, hasMaxOrder, hasOverdue].filter(Boolean).length;
  const phone = displayText(customer.phone);
  const phoneHref = phone && /[\d+]/.test(phone) ? `tel:${phone.replace(/[^\d+]/g, '')}` : null;

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Button variant="ghost" className="self-start -ml-2" onClick={() => navigate(backTo)}>
        <ArrowLeft className="h-4 w-4" />
        {t('customers.backToCustomers', 'Back to Customers')}
      </Button>

      {!pinned ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-light)] px-3 py-2.5">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
          <p className="text-sm font-semibold text-[var(--color-warning-fg)]">
            {t('customers.unpinnedNotice', 'ობიექტი არ არის დაპინული')}
          </p>
        </div>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-[var(--color-border)] px-4 py-4 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-[var(--color-text)] sm:text-2xl">
                {customer.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-lg bg-[var(--color-surface-hover)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--color-text-secondary)]">
                  {t('customers.orgCode', 'Code')} {code}
                </span>
              </div>
            </div>
            <Badge variant={customer.active ? 'success' : 'default'}>
              {customer.active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}
            </Badge>
          </div>

          <div className={cn('mt-3 grid gap-2', phone ? 'sm:grid-cols-2' : '')}>
            <div className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-hover)] px-3 py-2.5 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
              <span className="min-w-0 break-words">{address}</span>
            </div>
            {phoneHref ? (
              <a
                href={phoneHref}
                className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-hover)] px-3 py-2.5 text-sm text-[var(--color-text)]"
              >
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                <span className="min-w-0 break-words">{phone}</span>
              </a>
            ) : phone ? (
              <div className="flex items-start gap-3 rounded-xl bg-[var(--color-surface-hover)] px-3 py-2.5 text-sm">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                <span className="min-w-0 break-words">{phone}</span>
              </div>
            ) : null}
          </div>

          {moneyTiles > 0 || kegs.length > 0 ? (
            <div
              className={cn(
                'mt-4 grid gap-2',
                moneyTiles + (kegs.length > 0 ? 1 : 0) > 1 ? 'sm:grid-cols-2' : '',
                moneyTiles >= 3 ? 'lg:grid-cols-3' : '',
                moneyTiles >= 4 ? 'xl:grid-cols-4' : '',
              )}
            >
              {hasBalance ? (
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3',
                    debtTone === 'debt' && 'bg-[var(--color-danger-light)]',
                    debtTone === 'credit' && 'bg-[var(--color-success-light)]',
                    debtTone === 'even' && 'bg-[var(--color-surface-hover)]',
                  )}
                >
                  <p
                    className={cn(
                      'text-[11px] font-medium',
                      debtTone === 'debt' && 'text-[var(--color-danger-fg)]',
                      debtTone === 'credit' && 'text-[var(--color-success-fg)]',
                      debtTone === 'even' && 'text-[var(--color-text-tertiary)]',
                    )}
                  >
                    {t('customers.outstandingBalance', 'დავალიანება')}
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 text-2xl font-bold tabular-nums tracking-tight',
                      debtTone === 'debt' && 'text-[var(--color-danger-fg)]',
                      debtTone === 'credit' && 'text-[var(--color-success-fg)]',
                      debtTone === 'even' && 'text-[var(--color-text)]',
                    )}
                  >
                    {formatCurrency(customer.balance)}
                  </p>
                </div>
              ) : null}

              {hasOverdue ? (
                <div className="rounded-2xl bg-[var(--color-danger-light)] px-4 py-3">
                  <p className="text-[11px] font-medium text-[var(--color-danger-fg)]">
                    {t('customers.overdueBalance', 'ვადაგადაცილება')}
                  </p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-[var(--color-danger-fg)]">
                    {formatCurrency(customer.overdueBalance)}
                  </p>
                </div>
              ) : null}

              {hasMinOrder ? (
                <div className="rounded-2xl bg-[var(--color-surface-hover)] px-4 py-3">
                  <p className="text-[11px] font-medium text-[var(--color-text-tertiary)]">
                    {t('customers.minOrderTotal', 'მინ. შეკვეთა')}
                  </p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-[var(--color-text)]">
                    {formatCurrency(customer.minOrderTotal)}
                  </p>
                </div>
              ) : null}

              {hasMaxOrder ? (
                <div className="rounded-2xl bg-[var(--color-surface-hover)] px-4 py-3">
                  <p className="text-[11px] font-medium text-[var(--color-text-tertiary)]">
                    {t('customers.maxOrderTotal', 'მაქს. შეკვეთა')}
                  </p>
                  <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-[var(--color-text)]">
                    {formatCurrency(customer.maxOrderTotal)}
                  </p>
                </div>
              ) : null}

              {kegs.length > 0 ? (
                <div className="rounded-2xl bg-[var(--color-surface-hover)] px-4 py-3">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-text-tertiary)]">
                    <Package className="h-3.5 w-3.5" />
                    {t('customers.kegs', 'Kegs')}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {kegs.map((keg, index) => (
                      <li
                        key={`${keg.itemId}-${index}`}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 break-words text-[var(--color-text)]">
                          {keg.name || keg.itemId}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text)]">
                          {formatKegQty(keg.quantity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {hasOverdue ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-light)] px-3 py-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
              <p className="text-sm font-semibold text-[var(--color-danger-fg)]">
                {t('customers.overdueNotice', 'ვადაგადაცილებული დავალიანება: {{amount}}', {
                  amount: formatCurrency(customer.overdueBalance),
                })}
              </p>
            </div>
          ) : null}

          {facts.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {facts.map((row) => (
                <Fact key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          ) : null}

          {schedule ? (
            <div className="mt-3">
              <h2 className="mb-2 text-sm font-semibold">{t('customers.visitSchedule', 'Visit schedule')}</h2>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => {
                  const on = Boolean(schedule[day.key]);
                  return (
                    <span
                      key={day.key}
                      className={cn(
                        'inline-flex h-8 min-w-9 items-center justify-center rounded-lg px-2 text-xs font-medium',
                        on
                          ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]'
                          : 'bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]',
                      )}
                    >
                      {t(day.labelKey, day.fallback)}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}

          {pinned ? (
            <>
              <div className="-mx-4 mt-3 sm:-mx-5">
                <CustomerMap
                  pins={
                    routeOn
                      ? []
                      : [
                          {
                            id: customer.customerId,
                            name: customer.name,
                            latitude: customer.latitude,
                            longitude: customer.longitude,
                          },
                        ]
                  }
                  heightClass="h-52 rounded-none border-x-0 border-b-0 sm:h-64"
                  selectedId={customer.customerId}
                  directions={routeOn ? directions : null}
                />
              </div>
              <Button
                variant={routeOn ? 'primary' : 'outline'}
                className="mt-3"
                loading={geo.loading}
                onClick={() => {
                  setRouteOn(true);
                  geo.getPosition();
                }}
              >
                <Navigation className="h-4 w-4" />
                {t('customers.getDirections', 'Get directions')}
              </Button>
              {routeOn && geo.error ? (
                <p className="mt-2 text-sm font-medium text-[var(--color-warning)]">
                  {t('customers.locationFailed', 'Location could not be found')}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        {isSales ? <VisitActions customerId={customer.customerId} /> : null}
        {!isSales && (role === 'supervisor' || role === 'manager' || role === 'admin') ? (
          <div className="px-4 py-3 sm:px-5">
            <PlanogramEditor
              customerId={customer.customerId}
              orgCategoryId={customer.idOrgCategory}
              orgCategory={customer.orgCategory}
              salesUserId={salesUserId}
            />
          </div>
        ) : null}

        {isSales && (
          <div className="grid grid-cols-2 gap-2 border-b border-[var(--color-border)] px-4 py-3 sm:grid-cols-4 sm:px-5">
            <Button
              variant="primary"
              size="sm"
              fullWidth
              className="h-auto min-h-11 flex-col gap-1 px-1.5 py-2 text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:text-sm sm:px-3"
              onClick={() => navigate(newOrderTo)}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="text-center">{t('nav.newOrder', 'New Order')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              className="h-auto min-h-11 flex-col gap-1 px-1.5 py-2 text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:text-sm sm:px-3"
              onClick={() => navigate(promotionsTo)}
            >
              <Percent className="h-4 w-4 shrink-0" />
              <span className="text-center">{t('nav.promotions', 'Promotions')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              className="h-auto min-h-11 flex-col gap-1 px-1.5 py-2 text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:text-sm sm:px-3"
              onClick={() => navigate(collectTo)}
            >
              <Banknote className="h-4 w-4 shrink-0" />
              <span className="text-center">{t('customers.collectCash', 'Collect cash')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              className="h-auto min-h-11 flex-col gap-1 px-1.5 py-2 text-[11px] leading-tight sm:flex-row sm:gap-1.5 sm:text-sm sm:px-3"
              onClick={() => navigate(returnTo)}
            >
              <RotateCcw className="h-4 w-4 shrink-0" />
              <span className="text-center">{t('customers.returnProducts', 'Return products')}</span>
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
