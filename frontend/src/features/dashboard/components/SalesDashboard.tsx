import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Banknote,
  BarChart3,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  MapPin,
  MessageSquareQuote,
  Navigation,
  Plus,
  Route,
  ShoppingCart,
  Users,
} from 'lucide-react';
import { PageHeader, ErpErrorAlert } from '@/components/shared';
import { Button, Card, ProgressRing, Spinner, StarRating } from '@/components/ui';
import { CustomerMap } from '@/features/customers/components/CustomerMap';
import { erpApi } from '@/lib/api/erp.api';
import { formatVisitClock } from '@/lib/utils/format';
import { isPlottableCoord } from '@/lib/utils/geo';
import { cn } from '@/lib/utils/cn';
import { formatKm, formatMin } from '@/lib/utils/routing';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useRouteDirections } from '@/hooks/useRouteDirections';
import { useAuthStore } from '@/stores/authStore';
import type { ErpTask } from '@/types';

export function SalesDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [routeOn, setRouteOn] = useState(false);
  const geo = useGeolocation();

  const meQuery = useQuery({
    queryKey: ['erp-me'],
    queryFn: () => erpApi.me(),
  });

  const mapped = Boolean(user?.presellerMapped ?? meQuery.data?.presellerMapped);

  const dashboardQuery = useQuery({
    queryKey: ['erp-dashboard'],
    queryFn: () => erpApi.fieldDashboard(),
    enabled: mapped,
    retry: false,
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => erpApi.updateTask(id, 'complete'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-tasks'] });
    },
  });

  const me = dashboardQuery.data?.me ?? null;
  const next = me?.nextStop ?? null;
  const nextPinned = isPlottableCoord(next?.latitude, next?.longitude);

  const directions = useRouteDirections({
    origin: routeOn && geo.latitude != null && geo.longitude != null ? [geo.latitude, geo.longitude] : null,
    stops:
      next && nextPinned
        ? [{ id: next.customerId, name: next.name, latitude: next.latitude, longitude: next.longitude }]
        : [],
    enabled: routeOn,
  });

  const leg = directions.stops[0];
  const presellerId = meQuery.data?.presellerId ?? (user?.id_gvari != null ? String(user.id_gvari) : null);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('nav.dashboard', 'Dashboard')}
        subtitle={
          presellerId
            ? `${t('dashboard.salesSubtitle', 'Assigned FMG customers for this preseller session')} · ${presellerId}`
            : t('dashboard.salesSubtitle', 'Assigned FMG customers for this preseller session')
        }
      />

      {(meQuery.isError || dashboardQuery.isError) && (
        <ErpErrorAlert
          error={meQuery.error ?? dashboardQuery.error}
          fallback={t('dashboard.loadError', 'The dashboard could not be loaded.')}
        />
      )}

      {dashboardQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : me ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="flex h-full flex-col justify-center gap-3 p-5">
              <Link
                to="/customers"
                className="flex items-center gap-4 rounded-xl transition-transform hover:-translate-y-0.5"
              >
                <ProgressRing current={me.visited} total={me.planned} size={104} tone="primary">
                  <span className="text-xl font-bold tabular-nums text-[var(--color-text)]">
                    {me.visited}
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">/{me.planned}</span>
                  </span>
                </ProgressRing>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
                    {t('dashboard.todayRing', 'Today')}
                    <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {t('dashboard.coverageHint', 'Completed visits against today plan.')}
                  </p>
                  <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                    {me.firstVisitAt ? `${t('dashboard.firstVisit', 'First')} ${formatVisitClock(me.firstVisitAt)}` : ''}
                    {me.lastVisitAt ? ` · ${t('dashboard.lastVisit', 'Last')} ${formatVisitClock(me.lastVisitAt)}` : ''}
                  </p>
                </div>
              </Link>
              {me.openVisit ? (
                <Link
                  to={`/customers/${encodeURIComponent(me.openVisit.customerId)}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]"
                >
                  {t('dashboard.openVisitNow', 'Visit in progress')}: {me.openVisit.customerName ?? me.openVisit.customerId}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </Card>

            <Card className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[var(--color-text)]">{t('dashboard.nextStop', 'Next stop')}</p>
                <Route className="h-4 w-4 text-[var(--color-text-secondary)]" />
              </div>
              {next ? (
                <>
                  <button
                    type="button"
                    onClick={() => navigate(`/customers/${encodeURIComponent(next.customerId)}`)}
                    className="text-left"
                  >
                    <p className="font-semibold leading-snug text-[var(--color-text)]">{next.name}</p>
                    <p className="mt-1 flex items-start gap-1 text-xs text-[var(--color-text-secondary)]">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="min-w-0 break-words">
                        {[next.address, next.city].filter(Boolean).join(', ') || '—'}
                      </span>
                    </p>
                  </button>
                  {leg && leg.km != null && leg.min != null ? (
                    <p className="text-xs font-medium tabular-nums text-[var(--color-text-secondary)]">
                      {formatKm(leg.km)} {t('directions.km', 'km')} · {formatMin(leg.min)} {t('directions.min', 'min')}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {nextPinned ? (
                      <Button
                        variant={routeOn ? 'primary' : 'outline'}
                        size="sm"
                        loading={geo.loading}
                        onClick={() => {
                          setRouteOn(true);
                          geo.getPosition();
                        }}
                      >
                        <Navigation className="h-4 w-4" />
                        {t('directions.open', 'Directions')}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/customers/${encodeURIComponent(next.customerId)}`)}
                    >
                      {t('customers.startVisit', 'Start visit')}
                    </Button>
                  </div>
                  {routeOn && nextPinned ? (
                    <CustomerMap pins={[]} heightClass="h-52" directions={directions} selectedId={next.customerId} />
                  ) : null}
                  {routeOn && geo.error ? (
                    <p className="text-xs font-medium text-[var(--color-warning)]">
                      {t('customers.locationFailed', 'Location could not be found')}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {t('dashboard.nextStopEmpty', 'Today route is finished')}
                </p>
              )}
            </Card>
          </div>

          {me.coaching ? (
            <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <MessageSquareQuote className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {t('dashboard.supervisorNote', 'Supervisor note')}
                </p>
                <p className="truncate text-sm text-[var(--color-text)]">{me.coaching.note || '—'}</p>
              </div>
              <span className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                <StarRating value={me.coaching.rating} />
                {me.coaching.supervisorName ? <span>{me.coaching.supervisorName}</span> : null}
              </span>
            </Card>
          ) : null}

          <TaskPanel
            tasks={me.openTasks}
            pending={completeMutation.isPending}
            onComplete={(id) => completeMutation.mutate(id)}
          />

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <QuickLink
              to="/my-reports"
              icon={BarChart3}
              label={t('nav.myReports', 'Reports')}
              className="col-span-2 sm:col-span-1"
            />
            <QuickLink to="/customers" icon={Users} label={t('dashboard.quickCustomers', 'Customers')} />
            <QuickLink to="/customers" icon={Route} label={t('dashboard.quickRoute', 'Route')} />
            <QuickLink to="/orders/new" icon={Plus} label={t('dashboard.quickOrder', 'New order')} />
            <QuickLink
              to="/orders"
              icon={ShoppingCart}
              label={`${t('dashboard.savedOrders', 'Saved orders')} ${me.savedOrders}`}
            />
          </div>
        </>
      ) : mapped ? null : (
        <Card className="flex items-center gap-3 p-5">
          <Banknote className="h-5 w-5 text-[var(--color-text-secondary)]" />
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('dashboard.salesSubtitle', 'Assigned FMG customers for this preseller session')}
          </p>
        </Card>
      )}
    </div>
  );
}

function tbilisiToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function TaskPanel({
  tasks,
  pending,
  onComplete,
}: {
  tasks: ErpTask[];
  pending: boolean;
  onComplete: (id: number) => void;
}) {
  const { t } = useTranslation();
  const many = tasks.length > 2;
  const [touched, setTasksTouched] = useState(false);
  const [preferOpen, setPreferOpen] = useState(false);
  const open = touched ? preferOpen : !many;
  const today = tbilisiToday();
  const ordered = [...tasks].sort((left, right) => {
    const leftOverdue = left.dueOn != null && left.dueOn < today ? 0 : 1;
    const rightOverdue = right.dueOn != null && right.dueOn < today ? 0 : 1;
    if (leftOverdue !== rightOverdue) {
      return leftOverdue - rightOverdue;
    }
    return (left.dueOn ?? '9999-99-99').localeCompare(right.dueOn ?? '9999-99-99');
  });
  const visible = open ? ordered : ordered.slice(0, 1);
  const hidden = ordered.length - visible.length;
  const overdueCount = ordered.filter((task) => task.dueOn != null && task.dueOn < today).length;

  const toggle = () => {
    if (tasks.length === 0) {
      return;
    }
    setTasksTouched(true);
    setPreferOpen(!open);
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex w-full items-center gap-2 px-4 py-3">
        <Link
          to="/tasks?status=open"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg hover:text-[var(--color-primary)]"
        >
          <ClipboardList className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
          <span className="font-semibold text-[var(--color-text)]">{t('dashboard.myTasks', 'My tasks')}</span>
          <span className="rounded-full bg-[var(--color-surface-inset)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
            {tasks.length}
          </span>
          {overdueCount > 0 ? (
            <span className="rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
              {t('dashboard.overdue', 'Overdue')} {overdueCount}
            </span>
          ) : null}
          <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
        </Link>
        <button
          type="button"
          className="rounded-lg p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          aria-label={t('dashboard.myTasks', 'My tasks')}
          aria-expanded={tasks.length > 0 ? open : undefined}
          onClick={toggle}
        >
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 transition-transform',
              open && 'rotate-180',
              tasks.length === 0 && 'opacity-0',
            )}
          />
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-[var(--color-text-secondary)]">{t('dashboard.noTasks', 'No tasks')}</p>
      ) : (
        <ul className="space-y-1 px-2 pb-2">
          {visible.map((task) => {
            const overdue = task.dueOn != null && task.dueOn < today;
            return (
              <li
                key={task.id}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-[var(--color-surface-hover)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">{task.title}</p>
                  <p className="truncate text-xs text-[var(--color-text-secondary)]">
                    {task.customerId ? (
                      <Link
                        to={`/customers/${encodeURIComponent(task.customerId)}`}
                        className="hover:text-[var(--color-primary)]"
                      >
                        {task.customerName || task.customerId}
                      </Link>
                    ) : (
                      task.customerName || '—'
                    )}
                    {task.dueOn ? (
                      <span className={overdue ? 'text-[var(--color-danger)]' : undefined}>
                        {` · ${task.dueOn}`}
                        {overdue ? ` · ${t('dashboard.overdue', 'Overdue')}` : ''}
                      </span>
                    ) : null}
                    {task.note ? ` · ${task.note}` : ''}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => onComplete(task.id)}>
                  {t('tasks.complete', 'Done')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {!open && hidden > 0 ? (
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center justify-center border-t border-[var(--color-border)] px-4 py-2.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]"
        >
          {t('dashboard.tasksMore', { count: hidden })}
        </button>
      ) : null}
    </Card>
  );
}

function QuickLink({
  to,
  icon: Icon,
  label,
  hint,
  className,
}: {
  to: string;
  icon: typeof Users;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <Link to={to} className={cn('block h-full', className)}>
      <Card hoverable className="flex h-full items-center justify-between gap-2 p-3.5">
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Icon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{label}</span>
            {hint ? (
              <span className="block truncate text-xs text-[var(--color-text-secondary)]">{hint}</span>
            ) : null}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
      </Card>
    </Link>
  );
}
