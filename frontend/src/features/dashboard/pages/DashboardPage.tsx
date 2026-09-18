import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ShoppingCart, Banknote, Clock, Users, MapPin, Plus, Route, ChevronRight, CalendarOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader, ErpErrorAlert } from '@/components/shared';
import { reportsApi } from '@/lib/api/reports.api';
import { erpApi } from '@/lib/api/erp.api';
import { formatCurrency } from '@/lib/utils/format';
import { isPlottableCoord } from '@/lib/utils/geo';
import { KpiCard } from '../components/KpiCard';
import { SalesChart } from '../components/SalesChart';
import { RecentOrders } from '../components/RecentOrders';
import { TopProducts } from '../components/TopProducts';
import { Card } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

  if (user?.role === 'sales_rep') {
    return <SalesDashboard />;
  }
  if (user?.role === 'supervisor') {
    return <SupervisorDashboard />;
  }

  return <OperationsDashboard />;
}

function SupervisorDashboard() {
  const { t } = useTranslation();
  const teamQuery = useQuery({
    queryKey: ['erp-team-reps'],
    queryFn: () => erpApi.teamReps(),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.dashboard', 'Dashboard')}
        subtitle={t('dashboard.supervisorSubtitle', 'FMG visit days for your sales team only')}
      />
      {teamQuery.isError && (
        <ErpErrorAlert
          error={teamQuery.error}
          fallback={t('customers.noTeamReps', 'No mapped sales reps on your team.')}
        />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard
          title={t('dashboard.teamReps', 'Team sales reps')}
          value={teamQuery.isError ? '—' : String(teamQuery.data?.length ?? 0)}
          icon={Users}
          color="teal"
          loading={teamQuery.isLoading}
        />
      </div>
      <Link to="/routes" className="block">
        <Card hoverable className="flex items-center justify-between gap-3 p-5">
          <div>
            <p className="font-semibold">{t('nav.routes', 'Routes')}</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {t(
                'dashboard.supervisorHint',
                'You can view Today / All routes and the map for sales reps assigned to you. FMG schedules are read-only.',
              )}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-text-secondary)]" />
        </Card>
      </Link>
    </div>
  );
}

function countLabel(count: number, hasMore?: boolean): string {
  return hasMore ? `${count}+` : String(count);
}

function SalesDashboard() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const meQuery = useQuery({
    queryKey: ['erp-me'],
    queryFn: () => erpApi.me(),
  });

  const mapped = Boolean(user?.presellerMapped ?? meQuery.data?.presellerMapped);

  const todayQuery = useQuery({
    queryKey: ['erp-customers-dashboard', 'today'],
    queryFn: () => erpApi.customers({ day: 'today', limit: 500 }),
    enabled: mapped,
    retry: false,
  });

  const allQuery = useQuery({
    queryKey: ['erp-customers-dashboard', 'all'],
    queryFn: () => erpApi.customers({ day: 'all', limit: 100 }),
    enabled: mapped,
    retry: false,
  });

  const ordersQuery = useQuery({
    queryKey: ['erp-saved-orders'],
    queryFn: () => erpApi.savedOrders(),
    enabled: mapped,
    retry: false,
  });

  const todayItems = todayQuery.data?.items ?? [];
  const todayCount = todayItems.length;
  const assignedCount = allQuery.data?.items.length ?? 0;
  const pinCount = todayItems.filter((row) => isPlottableCoord(row.latitude, row.longitude)).length;
  const notOnToday = Math.max(0, assignedCount - todayCount);
  const compareError = todayQuery.isError || allQuery.isError;
  const scheduleHint = t('dashboard.scheduleHint', 'FMG schedule. Completed visits are not counted.');
  const presellerId = meQuery.data?.presellerId ?? (user?.id_gvari != null ? String(user.id_gvari) : null);
  const dashError = meQuery.error ?? todayQuery.error ?? allQuery.error ?? ordersQuery.error;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.dashboard', 'Dashboard')}
        subtitle={
          presellerId
            ? `${t('dashboard.salesSubtitle', 'Assigned FMG customers for this preseller session')} · ${presellerId}`
            : t('dashboard.salesSubtitle', 'Assigned FMG customers for this preseller session')
        }
      />

      {(meQuery.isError || todayQuery.isError || allQuery.isError || ordersQuery.isError) && (
        <ErpErrorAlert
          error={dashError}
          fallback={t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.')}
        />
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          title={t('dashboard.todayVisits', 'Today visits')}
          value={todayQuery.isError ? '—' : countLabel(todayItems.length, todayQuery.data?.hasMore)}
          icon={Route}
          color="blue"
          loading={todayQuery.isLoading}
        />
        <KpiCard
          title={t('dashboard.assignedCustomers', 'Assigned customers')}
          value={allQuery.isError ? '—' : countLabel(allQuery.data?.items.length ?? 0, allQuery.data?.hasMore)}
          icon={Users}
          color="teal"
          loading={allQuery.isLoading}
        />
        <KpiCard
          title={t('dashboard.submittedOrders', 'Submitted orders')}
          value={ordersQuery.isError ? '—' : String(ordersQuery.data?.length ?? 0)}
          icon={ShoppingCart}
          color="green"
          loading={ordersQuery.isLoading}
        />
        <KpiCard
          title={t('dashboard.mapPins', 'Map pins')}
          value={todayQuery.isError ? '—' : String(pinCount)}
          icon={MapPin}
          color="amber"
          loading={todayQuery.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          title={t('dashboard.planVsBook', 'Today plan / assigned')}
          icon={Route}
          color="blue"
          loading={todayQuery.isLoading || allQuery.isLoading}
          compare={compareError ? undefined : { current: todayCount, total: assignedCount, totalHasMore: allQuery.data?.hasMore }}
          value={compareError ? '—' : undefined}
          hint={scheduleHint}
        />
        <KpiCard
          title={t('dashboard.pinsVsPlan', 'Pins / today plan')}
          icon={MapPin}
          color="amber"
          loading={todayQuery.isLoading}
          compare={todayQuery.isError ? undefined : { current: pinCount, total: todayCount, totalHasMore: todayQuery.data?.hasMore }}
          value={todayQuery.isError ? '—' : undefined}
          hint={scheduleHint}
        />
        <KpiCard
          title={t('dashboard.notOnToday', 'Not on today schedule')}
          icon={CalendarOff}
          color="teal"
          loading={todayQuery.isLoading || allQuery.isLoading}
          compare={compareError ? undefined : { current: notOnToday, total: assignedCount, totalHasMore: allQuery.data?.hasMore }}
          value={compareError ? '—' : undefined}
          hint={scheduleHint}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link to="/customers" className="block">
          <Card hoverable className="flex h-full items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]">
                <Users className="h-5 w-5" />
              </div>
              <span className="font-medium">{t('dashboard.quickCustomers', 'Customers')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </Card>
        </Link>
        <Link to="/customers" className="block">
          <Card hoverable className="flex h-full items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <Route className="h-5 w-5" />
              </div>
              <span className="font-medium">{t('dashboard.quickRoute', 'Route')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </Card>
        </Link>
        <Link to="/customers" className="block">
          <Card hoverable className="flex h-full items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-success)]/10 text-[var(--color-success)]">
                <Plus className="h-5 w-5" />
              </div>
              <span className="font-medium">{t('dashboard.quickOrder', 'New order')}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </Card>
        </Link>
      </div>
    </div>
  );
}

function OperationsDashboard() {
  const { t } = useTranslation();

  const { data: salesReport, isLoading: salesLoading } = useQuery({
    queryKey: ['reports', 'sales'],
    queryFn: () => reportsApi.sales(),
  });

  const { data: inventoryReport, isLoading: inventoryLoading } = useQuery({
    queryKey: ['reports', 'inventory'],
    queryFn: () => reportsApi.inventory(),
  });

  const kpiLoading = salesLoading || inventoryLoading;

  const stats = {
    totalOrders: salesReport?.total_orders ?? 0,
    totalRevenue: salesReport?.total_sales ?? 0,
    pendingOrders: (inventoryReport as { pending_orders?: number })?.pending_orders ?? 0,
    activeCustomers: (inventoryReport as { active_customers?: number })?.active_customers ?? 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.dashboard', 'Dashboard')}
        subtitle={t('dashboard.subtitle', 'Overview of your distribution operations')}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t('dashboard.totalOrders', 'Total Orders')}
          value={stats.totalOrders.toLocaleString()}
          icon={ShoppingCart}
          color="blue"
          loading={kpiLoading}
        />
        <KpiCard
          title={t('dashboard.totalRevenue', 'Total Revenue')}
          value={formatCurrency(stats.totalRevenue)}
          icon={Banknote}
          color="green"
          loading={kpiLoading}
        />
        <KpiCard
          title={t('dashboard.pendingOrders', 'Pending Orders')}
          value={stats.pendingOrders.toLocaleString()}
          icon={Clock}
          color="amber"
          loading={kpiLoading}
        />
        <KpiCard
          title={t('dashboard.activeCustomers', 'Active Customers')}
          value={stats.activeCustomers.toLocaleString()}
          icon={Users}
          color="teal"
          loading={kpiLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SalesChart
            data={salesReport?.sales_by_day ?? []}
            loading={salesLoading}
          />
        </div>
        <TopProducts
          data={salesReport?.top_products ?? []}
          loading={salesLoading}
        />
      </div>

      <RecentOrders />
    </div>
  );
}
