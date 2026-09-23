import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  AsyncCombobox,
  Button,
  Card,
  Combobox,
  Input,
  Modal,
  MultiCombobox,
  SegmentedControl,
  Select,
  Spinner,
  type ComboboxOption,
} from '@/components/ui';
import { erpApi } from '@/lib/api/erp.api';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import type { ErpPromoPlan } from '@/types';

function apiMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
  }
  return null;
}

function isoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function mondayOf(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, date));
  const weekday = cursor.getUTCDay();
  cursor.setUTCDate(cursor.getUTCDate() + (weekday === 0 ? -6 : 1 - weekday));
  return cursor;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function gridDays(view: 'month' | 'week', month: string, weekDay: string): string[] {
  if (view === 'week') {
    const start = mondayOf(weekDay);
    return Array.from({ length: 7 }, (_, index) => isoDate(addDays(start, index)));
  }
  const [year, monthNumber] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const last = new Date(Date.UTC(year, monthNumber, 0));
  const start = mondayOf(isoDate(first));
  const days: string[] = [];
  let cursor = start;
  while (cursor <= last || days.length % 7 !== 0) {
    days.push(isoDate(cursor));
    cursor = addDays(cursor, 1);
    if (days.length > 42) {
      break;
    }
  }
  return days;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const weekdayKeys = [
  'customers.days.mon',
  'customers.days.tue',
  'customers.days.wed',
  'customers.days.thu',
  'customers.days.fri',
  'customers.days.sat',
  'customers.days.sun',
];
const weekdayFallbacks = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const statusTone: Record<ErpPromoPlan['status'], string> = {
  planned: 'bg-[var(--color-primary)]/12 text-[var(--color-primary)] border-[var(--color-primary)]/30',
  active: 'bg-[var(--color-secondary)]/12 text-[var(--color-secondary)] border-[var(--color-secondary)]/30',
  done: 'bg-[var(--color-success)]/12 text-[var(--color-success)] border-[var(--color-success)]/30',
};

interface Draft {
  id: number | null;
  salesUserId: string | null;
  customer: ComboboxOption | null;
  title: string;
  startsOn: string;
  endsOn: string;
  status: ErpPromoPlan['status'];
  note: string;
  photoId: number | null;
}

function emptyDraft(day: string): Draft {
  return {
    id: null,
    salesUserId: null,
    customer: null,
    title: '',
    startsOn: day,
    endsOn: day,
    status: 'planned',
    note: '',
    photoId: null,
  };
}

export default function PromoCalendarPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const supervisor = role === 'admin' || role === 'supervisor';
  const salesRep = role === 'sales_rep';
  const requestedStatus = params.get('status');
  const statusFilter = requestedStatus === 'planned' || requestedStatus === 'active' || requestedStatus === 'done'
    ? requestedStatus
    : null;

  const [view, setView] = useState<'month' | 'week'>('month');
  const [month, setMonth] = useState(() => todayIso().slice(0, 7));
  const [weekDay, setWeekDay] = useState(todayIso);
  const [salesFilter, setSalesFilter] = useState<string[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const days = useMemo(() => gridDays(view, month, weekDay), [view, month, weekDay]);
  const range = { from: days[0], to: days[days.length - 1] };

  const teamQuery = useQuery({
    queryKey: ['erp-team-reps'],
    queryFn: () => erpApi.teamReps(),
    enabled: supervisor,
  });

  const plansQuery = useQuery({
    queryKey: ['erp-promos', range.from, range.to, salesFilter],
    queryFn: () =>
      erpApi.promoPlans({
        from: range.from,
        to: range.to,
        salesUserId: salesFilter.length > 0 ? salesFilter.map(Number) : undefined,
      }),
    enabled: supervisor || salesRep,
  });

  const plans = (plansQuery.data ?? []).filter((plan) => (statusFilter ? plan.status === statusFilter : true));

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['erp-promos'] });
    await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!draft) {
        throw new Error('missing');
      }
      if (draft.id == null) {
        return erpApi.createPromoPlan({
          salesUserId: Number(draft.salesUserId),
          customerId: draft.customer?.value || undefined,
          title: draft.title.trim(),
          startsOn: draft.startsOn,
          endsOn: draft.endsOn,
          note: draft.note.trim() || undefined,
        });
      }
      return erpApi.updatePromoPlan(draft.id, {
        title: draft.title.trim(),
        startsOn: draft.startsOn,
        endsOn: draft.endsOn,
        status: draft.status,
        customerId: draft.customer?.value ?? null,
        note: draft.note.trim() || null,
        photoId: draft.status === 'done' ? draft.photoId : null,
      });
    },
    onSuccess: async () => {
      setActionError(null);
      setDraft(null);
      await refresh();
    },
    onError: (error) => setActionError(apiMessage(error) ?? t('promoCalendar.saveError', 'The plan could not be saved.')),
  });

  const copyMutation = useMutation({
    mutationFn: (id: number) => erpApi.copyPromoPlan(id),
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => setActionError(apiMessage(error) ?? t('promoCalendar.saveError', 'The plan could not be saved.')),
  });

  const searchCustomers = useCallback(
    async (search: string): Promise<ComboboxOption[]> => {
      if (!draft?.salesUserId) {
        return [];
      }
      const page = await erpApi.customers({
        search: search || undefined,
        limit: 20,
        day: 'all',
        salesUserId: Number(draft.salesUserId),
      });
      return page.items.map((row) => ({
        value: row.customerId,
        label: row.name,
        hint: [row.orgCode ?? row.customerId, row.city].filter(Boolean).join(' · '),
      }));
    },
    [draft?.salesUserId],
  );

  const searchPhotos = useCallback(
    async (search: string): Promise<ComboboxOption[]> => {
      if (!draft?.salesUserId) {
        return [];
      }
      const photos = await erpApi.galleryPhotos({
        salesUserId: [Number(draft.salesUserId)],
        customer: draft.customer?.value || undefined,
        q: search || undefined,
      });
      const options = await Promise.all(
        photos.slice(0, 12).map(async (photo) => {
          const blob = await erpApi.galleryPhotoBlob(photo.id).catch(() => null);
          let thumbnail: string | undefined;
          if (blob) {
            thumbnail = URL.createObjectURL(blob);
            objectUrls.current.push(thumbnail);
          }
          return {
            value: String(photo.id),
            label: `#${photo.id} ${photo.customerName ?? ''}`.trim(),
            hint: [photo.phase, photo.takenAt?.slice(0, 16).replace('T', ' ')].filter(Boolean).join(' · '),
            thumbnail,
          };
        }),
      );
      return options;
    },
    [draft?.customer?.value, draft?.salesUserId],
  );

  if (role && !supervisor && !salesRep) {
    return <Navigate to="/" replace />;
  }

  const today = todayIso();
  const statusLabel = (status: ErpPromoPlan['status']) => t(`promoCalendar.${status}`, status);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader
        title={t('promoCalendar.title', 'Promo calendar')}
        subtitle={t('promoCalendar.subtitle', 'Shelf presence plan')}
        action={
          supervisor ? (
            <Button variant="primary" size="sm" onClick={() => setDraft(emptyDraft(today))}>
              <Plus className="h-4 w-4" />
              {t('promoCalendar.create', 'Add plan')}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <SegmentedControl
          value={view}
          onChange={(value) => setView(value as 'month' | 'week')}
          options={[
            { value: 'month', label: t('promoCalendar.month', 'Month') },
            { value: 'week', label: t('promoCalendar.week', 'Week') },
          ]}
        />
        {view === 'month' ? (
          <div className="flex items-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setMonth((value) => shiftMonth(value, -1))} aria-label={t('common.previous', 'Previous')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Input label={t('promoCalendar.month', 'Month')} type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            <Button variant="ghost" size="sm" onClick={() => setMonth((value) => shiftMonth(value, 1))} aria-label={t('common.next', 'Next')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Input label={t('promoCalendar.week', 'Week')} type="date" value={weekDay} onChange={(event) => setWeekDay(event.target.value)} />
        )}
        {supervisor ? (
        <MultiCombobox
          className="w-full sm:w-56"
          label={t('promoCalendar.sales', 'Sales rep')}
          options={(teamQuery.data ?? []).map((rep) => ({ value: String(rep.id), label: rep.name }))}
          values={salesFilter}
          onChange={setSalesFilter}
          placeholder={t('filters.anySales', 'All sales reps')}
          searchPlaceholder={t('filters.searchSales', 'Search sales rep')}
          emptyText={t('filters.noResults', 'No results')}
          allLabel={t('filters.all', 'All')}
          clearLabel={t('filters.clear', 'Clear')}
          summary={(count) => t('filters.selected', '{{count}} selected', { count })}
        />
        ) : null}
        <p className="pb-2 text-sm tabular-nums text-[var(--color-text-secondary)]">
          {range.from} – {range.to}
        </p>
      </div>

      {plansQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface-inset)]">
            {weekdayKeys.map((key, index) => (
              <div key={key} className="px-2 py-1.5 text-center text-[11px] font-semibold text-[var(--color-text-secondary)]">
                {t(key, weekdayFallbacks[index])}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dayPlans = plans.filter((plan) => plan.startsOn <= day && plan.endsOn >= day);
              const inMonth = view === 'week' || day.slice(0, 7) === month;
              return (
                <div
                  key={day}
                  className={cn(
                    'min-h-24 border-b border-r border-[var(--color-border)] p-1.5 last:border-r-0',
                    !inMonth && 'bg-[var(--color-surface-inset)]/60',
                    day === today && 'bg-[var(--color-primary)]/5',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-[11px] font-semibold tabular-nums',
                        day === today ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-tertiary)]',
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {supervisor ? (
                      <button
                        type="button"
                        onClick={() => setDraft(emptyDraft(day))}
                        aria-label={t('promoCalendar.create', 'Add plan')}
                        className="rounded p-0.5 text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-1">
                    {dayPlans.map((plan) =>
                      supervisor ? (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() =>
                            setDraft({
                              id: plan.id,
                              salesUserId: String(plan.salesUserId),
                              customer: plan.customerId
                                ? { value: plan.customerId, label: plan.customerName ?? plan.customerId }
                                : null,
                              title: plan.title,
                              startsOn: plan.startsOn,
                              endsOn: plan.endsOn,
                              status: plan.status,
                              note: plan.note ?? '',
                              photoId: plan.photoId,
                            })
                          }
                          className={cn(
                            'block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium',
                            statusTone[plan.status],
                          )}
                          title={`${plan.title} · ${plan.salesName ?? ''} · ${statusLabel(plan.status)}`}
                        >
                          {plan.title}
                        </button>
                      ) : (
                        <span
                          key={plan.id}
                          className={cn(
                            'block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] font-medium',
                            statusTone[plan.status],
                          )}
                          title={`${plan.title} · ${statusLabel(plan.status)}`}
                        >
                          {plan.title}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {plans.length === 0 && !plansQuery.isLoading ? (
        <p className="flex items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <CalendarDays className="h-4 w-4" />
          {t('promoCalendar.empty', 'No plans in this period')}
        </p>
      ) : null}

      {actionError ? <p className="text-sm font-medium text-[var(--color-warning)]">{actionError}</p> : null}

      <Modal
        open={draft != null}
        onClose={() => setDraft(null)}
        title={draft?.id == null ? t('promoCalendar.create', 'Add plan') : t('common.edit', 'Edit')}
        description={t('promoCalendar.subtitle', 'Shelf presence plan')}
      >
        {draft ? (
          <div className="space-y-3">
            <Combobox
              label={t('promoCalendar.sales', 'Sales rep')}
              options={(teamQuery.data ?? []).map((rep) => ({ value: String(rep.id), label: rep.name }))}
              value={draft.salesUserId}
              onChange={(value) =>
                setDraft((current) => (current ? { ...current, salesUserId: value, customer: null } : current))
              }
              placeholder={t('promoCalendar.sales', 'Sales rep')}
              searchPlaceholder={t('filters.searchSales', 'Search sales rep')}
              emptyText={t('filters.noResults', 'No results')}
              disabled={draft.id != null}
            />
            <AsyncCombobox
              label={t('promoCalendar.customer', 'Customer code')}
              queryKey={['promo-customer-search', draft.salesUserId ?? 'none']}
              fetchOptions={searchCustomers}
              value={draft.customer?.value ?? null}
              selectedLabel={draft.customer?.label ?? null}
              onChange={(option) => setDraft((current) => (current ? { ...current, customer: option } : current))}
              placeholder={t('filters.all', 'All')}
              searchPlaceholder={t('filters.searchCustomer', 'Search customer')}
              emptyText={t('filters.noResults', 'No results')}
              disabled={!draft.salesUserId}
            />
            <Input
              label={t('promoCalendar.titleField', 'Title')}
              value={draft.title}
              onChange={(event) => setDraft((current) => (current ? { ...current, title: event.target.value } : current))}
              maxLength={160}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('promoCalendar.starts', 'Starts')}
                type="date"
                value={draft.startsOn}
                onChange={(event) => setDraft((current) => (current ? { ...current, startsOn: event.target.value } : current))}
              />
              <Input
                label={t('promoCalendar.ends', 'Ends')}
                type="date"
                value={draft.endsOn}
                onChange={(event) => setDraft((current) => (current ? { ...current, endsOn: event.target.value } : current))}
              />
            </div>
            <Input
              label={t('promoCalendar.note', 'Note')}
              value={draft.note}
              onChange={(event) => setDraft((current) => (current ? { ...current, note: event.target.value } : current))}
              maxLength={300}
            />
            {draft.id != null ? (
              <Select
                label={t('common.status', 'Status')}
                value={draft.status}
                onChange={(value) =>
                  setDraft((current) => (current ? { ...current, status: value as ErpPromoPlan['status'] } : current))
                }
                options={[
                  { value: 'planned', label: t('promoCalendar.planned', 'Planned') },
                  { value: 'active', label: t('promoCalendar.active', 'Active') },
                  { value: 'done', label: t('promoCalendar.done', 'Done') },
                ]}
              />
            ) : null}
            {draft.id != null && draft.status === 'done' ? (
              <AsyncCombobox
                label={t('promoCalendar.photo', 'Visit photo')}
                queryKey={['promo-photo-search', draft.salesUserId ?? 'none', draft.customer?.value ?? 'any']}
                fetchOptions={searchPhotos}
                value={draft.photoId ? String(draft.photoId) : null}
                selectedLabel={draft.photoId ? `#${draft.photoId}` : null}
                onChange={(option) =>
                  setDraft((current) => (current ? { ...current, photoId: option ? Number(option.value) : null } : current))
                }
                placeholder={t('promoCalendar.noPhoto', 'No photo')}
                searchPlaceholder={t('filters.searchPhoto', 'Search photo')}
                emptyText={t('promoCalendar.noPhoto', 'No photo')}
              />
            ) : null}
            <div className="flex items-center justify-between gap-2">
              {draft.id != null ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={copyMutation.isPending}
                  onClick={() => copyMutation.mutate(draft.id as number)}
                >
                  <Copy className="h-4 w-4" />
                  {t('promoCalendar.copy', 'Copy')}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={
                    saveMutation.isPending ||
                    !draft.salesUserId ||
                    draft.title.trim() === '' ||
                    !draft.startsOn ||
                    !draft.endsOn
                  }
                  onClick={() => saveMutation.mutate()}
                >
                  {t('promoCalendar.save', 'Save')}
                </Button>
              </div>
            </div>
            {actionError ? <p className="text-sm font-medium text-[var(--color-warning)]">{actionError}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
