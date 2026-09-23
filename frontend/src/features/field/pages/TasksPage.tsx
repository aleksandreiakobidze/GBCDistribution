import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  AsyncCombobox,
  Button,
  Card,
  Combobox,
  Input,
  Modal,
  MultiCombobox,
  Spinner,
  type ComboboxOption,
} from '@/components/ui';
import { erpApi } from '@/lib/api/erp.api';
import { formatVisitClock } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import type { ErpTask } from '@/types';

function apiMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
  }
  return null;
}

function salesQuery(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value.split(',').map((part) => part.trim()).filter((part) => /^\d+$/.test(part));
}

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function TasksPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const presetPhoto = params.get('photoId');
  const supervisor = role === 'admin' || role === 'supervisor';
  const salesRep = role === 'sales_rep';
  const requestedStatus = params.get('status');

  const [salesFilter, setSalesFilter] = useState<string[]>(() => salesQuery(params.get('sales')));
  const [formOpen, setFormOpen] = useState(presetPhoto != null);
  const [salesUserId, setSalesUserId] = useState<string | null>(params.get('salesUserId'));
  const [customer, setCustomer] = useState<ComboboxOption | null>(
    params.get('customerId') ? { value: params.get('customerId') as string, label: params.get('customerId') as string } : null,
  );
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [dueOn, setDueOn] = useState(todayIso);
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const teamQuery = useQuery({
    queryKey: ['erp-team-reps'],
    queryFn: () => erpApi.teamReps(),
    enabled: supervisor,
  });

  const tasksQuery = useQuery({
    queryKey: ['erp-tasks', 'board', salesFilter],
    queryFn: () => erpApi.tasks(salesFilter.length > 0 ? { salesUserId: salesFilter.map(Number) } : undefined),
    enabled: supervisor || salesRep,
  });

  const tasks = tasksQuery.data ?? [];

  useEffect(() => {
    const ids = tasks.flatMap((task) => (task.photoId ? [task.photoId] : []));
    if (ids.length === 0) {
      return;
    }
    const created: string[] = [];
    let cancelled = false;
    (async () => {
      const next: Record<number, string> = {};
      await Promise.all(
        Array.from(new Set(ids)).map(async (id) => {
          const blob = await erpApi.galleryPhotoBlob(id).catch(() => null);
          if (!blob || cancelled) {
            return;
          }
          const url = URL.createObjectURL(blob);
          created.push(url);
          next[id] = url;
        }),
      );
      if (!cancelled) {
        setPhotoUrls(next);
      }
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [tasksQuery.data]);

  const createMutation = useMutation({
    mutationFn: () =>
      erpApi.createTask({
        salesUserId: Number(salesUserId),
        customerId: customer?.value || undefined,
        photoId: presetPhoto ? Number(presetPhoto) : undefined,
        title: title.trim(),
        note: note.trim() || undefined,
        dueOn: dueOn || undefined,
      }),
    onSuccess: async () => {
      setActionError(null);
      setTitle('');
      setNote('');
      setFormOpen(false);
      if (presetPhoto) {
        setParams(new URLSearchParams(), { replace: true });
      }
      await queryClient.invalidateQueries({ queryKey: ['erp-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
    },
    onError: (error) => setActionError(apiMessage(error) ?? t('tasks.saveError', 'The task could not be saved.')),
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => erpApi.updateTask(id, 'complete'),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['erp-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
    },
    onError: (error) => setActionError(apiMessage(error) ?? t('tasks.saveError', 'The task could not be saved.')),
  });

  const checkMutation = useMutation({
    mutationFn: (id: number) => erpApi.updateTask(id, 'check'),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['erp-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
    },
    onError: (error) => setActionError(apiMessage(error) ?? t('tasks.saveError', 'The task could not be saved.')),
  });

  const searchCustomers = useCallback(
    async (search: string): Promise<ComboboxOption[]> => {
      if (!salesUserId) {
        return [];
      }
      const page = await erpApi.customers({
        search: search || undefined,
        limit: 20,
        day: 'all',
        salesUserId: Number(salesUserId),
      });
      return page.items.map((row) => ({
        value: row.customerId,
        label: row.name,
        hint: [row.orgCode ?? row.customerId, row.city].filter(Boolean).join(' · '),
      }));
    },
    [salesUserId],
  );

  const columns = useMemo(() => {
    const today = todayIso();
    const open = tasks.filter((task) => task.status === 'open');
    const done = tasks.filter((task) => task.status === 'done' && !task.checkedAt);
    const checked = tasks.filter((task) => task.checkedAt != null);
    const overdue = open.filter((task) => task.dueOn != null && task.dueOn < today);
    const all = [
      { key: 'open', label: t('tasks.open', 'Open'), tone: 'primary' as const, rows: open },
      { key: 'done', label: t('tasks.done', 'Done'), tone: 'warning' as const, rows: done },
      { key: 'checked', label: t('tasks.check', 'Check'), tone: 'success' as const, rows: checked },
      { key: 'overdue', label: t('dashboard.overdue', 'Overdue'), tone: 'danger' as const, rows: overdue },
    ];
    if (requestedStatus === 'open' || requestedStatus === 'done' || requestedStatus === 'checked' || requestedStatus === 'overdue') {
      return all.filter((column) => column.key === requestedStatus);
    }
    return all.filter((column) => column.key !== 'overdue');
  }, [requestedStatus, t, tasks]);

  if (role && !supervisor && !salesRep) {
    return <Navigate to="/" replace />;
  }

  const today = todayIso();

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader
        title={t('tasks.title', 'Tasks')}
        subtitle={t('tasks.subtitle', 'A task for a sales rep or a customer')}
        action={
          supervisor ? (
            <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              {t('tasks.create', 'Create task')}
            </Button>
          ) : null
        }
      />

      {supervisor ? (
      <MultiCombobox
        className="sm:max-w-xs"
        label={t('tasks.sales', 'Sales rep')}
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

      {tasksQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {columns.map((column) => (
            <section key={column.key} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-2 w-2 rounded-full',
                    column.tone === 'primary' && 'bg-[var(--color-primary)]',
                    column.tone === 'warning' && 'bg-[var(--color-warning)]',
                    column.tone === 'success' && 'bg-[var(--color-success)]',
                    column.tone === 'danger' && 'bg-[var(--color-danger)]',
                  )}
                />
                <h2 className="text-sm font-semibold text-[var(--color-text)]">{column.label}</h2>
                <span className="rounded-full bg-[var(--color-surface-hover)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">
                  {column.rows.length}
                </span>
              </div>
              {column.rows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-xs text-[var(--color-text-secondary)]">
                  {t('tasks.empty', 'No tasks')}
                </p>
              ) : (
                column.rows.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    today={today}
                    photoUrl={task.photoId ? photoUrls[task.photoId] : undefined}
                    onCheck={
                      supervisor && column.key === 'done' ? () => checkMutation.mutate(task.id) : undefined
                    }
                    onComplete={
                      salesRep && (column.key === 'open' || column.key === 'overdue')
                        ? () => completeMutation.mutate(task.id)
                        : undefined
                    }
                    checking={checkMutation.isPending || completeMutation.isPending}
                  />
                ))
              )}
            </section>
          ))}
        </div>
      )}

      {actionError ? <p className="text-sm font-medium text-[var(--color-warning)]">{actionError}</p> : null}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={t('tasks.create', 'Create task')}
        description={t('tasks.subtitle', 'A task for a sales rep or a customer')}
      >
        <div className="space-y-3">
          <Combobox
            label={t('tasks.sales', 'Sales rep')}
            options={(teamQuery.data ?? []).map((rep) => ({ value: String(rep.id), label: rep.name }))}
            value={salesUserId}
            onChange={(value) => {
              setSalesUserId(value);
              setCustomer(null);
            }}
            placeholder={t('tasks.sales', 'Sales rep')}
            searchPlaceholder={t('filters.searchSales', 'Search sales rep')}
            emptyText={t('filters.noResults', 'No results')}
          />
          <AsyncCombobox
            label={t('tasks.customer', 'Customer code')}
            queryKey={['task-customer-search', salesUserId ?? 'none']}
            fetchOptions={searchCustomers}
            value={customer?.value ?? null}
            selectedLabel={customer?.label ?? null}
            onChange={setCustomer}
            placeholder={t('filters.anyStatus', 'All statuses')}
            searchPlaceholder={t('filters.searchCustomer', 'Search customer')}
            emptyText={t('filters.noResults', 'No results')}
            disabled={!salesUserId}
          />
          <Input
            label={t('tasks.titleField', 'Title')}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
          />
          <Input
            label={t('tasks.note', 'Note')}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
          />
          <Input label={t('tasks.due', 'Due')} type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} />
          {presetPhoto ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t('tasks.photo', 'Photo')} #{presetPhoto}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={createMutation.isPending || !salesUserId || title.trim() === ''}
              onClick={() => createMutation.mutate()}
            >
              {t('tasks.create', 'Create task')}
            </Button>
          </div>
          {actionError ? <p className="text-sm font-medium text-[var(--color-warning)]">{actionError}</p> : null}
        </div>
      </Modal>
    </div>
  );
}

function TaskCard({
  task,
  today,
  photoUrl,
  onCheck,
  onComplete,
  checking,
}: {
  task: ErpTask;
  today: string;
  photoUrl?: string;
  onCheck?: () => void;
  onComplete?: () => void;
  checking: boolean;
}) {
  const { t } = useTranslation();
  const overdue = task.status === 'open' && task.dueOn != null && task.dueOn < today;

  return (
    <Card className={cn('flex gap-3 p-3', overdue && 'border-[var(--color-danger)]/50')}>
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug text-[var(--color-text)]">{task.title}</p>
        <p className="mt-0.5 truncate text-xs text-[var(--color-text-secondary)]">
          {[task.salesName, task.customerName].filter(Boolean).join(' · ') || '—'}
        </p>
        {task.note ? <p className="mt-1 text-xs text-[var(--color-text)]">{task.note}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
          {task.dueOn ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-medium',
                overdue
                  ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]'
                  : 'bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]',
              )}
            >
              {task.dueOn}
            </span>
          ) : null}
          {task.completedAt ? (
            <span className="text-[var(--color-text-tertiary)]">
              {t('tasks.completedBy', 'Completed {{time}}', { time: formatVisitClock(task.completedAt) })}
            </span>
          ) : null}
          {task.checkedAt && task.checkedByName ? (
            <span className="flex items-center gap-1 text-[var(--color-success)]">
              <CheckCircle2 className="h-3 w-3" />
              {t('tasks.checkedBy', 'Checked by {{name}} · {{time}}', {
                name: task.checkedByName,
                time: formatVisitClock(task.checkedAt),
              })}
            </span>
          ) : null}
        </div>
        {onComplete ? (
          <Button variant="outline" size="sm" className="mt-2" disabled={checking} onClick={onComplete}>
            {t('tasks.complete', 'Done')}
          </Button>
        ) : null}
        {onCheck ? (
          <Button variant="outline" size="sm" className="mt-2" disabled={checking} onClick={onCheck}>
            {t('tasks.check', 'Check')}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
