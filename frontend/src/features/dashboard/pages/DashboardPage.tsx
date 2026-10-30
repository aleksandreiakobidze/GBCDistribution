import { useQuery } from '@tanstack/react-query';
import { ShoppingCart, Banknote, Clock, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared';
import { reportsApi } from '@/lib/api/reports.api';
import { formatCurrency } from '@/lib/utils/format';
import { KpiCard } from '../components/KpiCard';
import { SalesChart } from '../components/SalesChart';
import { RecentOrders } from '../components/RecentOrders';
import { TopProducts } from '../components/TopProducts';
import { SupervisorDashboard } from '../components/SupervisorDashboard';
import { SalesDashboard } from '../components/SalesDashboard';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

  if (user?.role === 'sales_rep') {
    return <SalesDashboard />;
  }
  if (user?.role === 'supervisor' || user?.role === 'manager') {
    return <SupervisorDashboard />;
  }

  return <OperationsDashboard />;
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
    <div className="space-y-4">
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
          to="/orders"
        />
        <KpiCard
          title={t('dashboard.totalRevenue', 'Total Revenue')}
          value={formatCurrency(stats.totalRevenue)}
          icon={Banknote}
          color="green"
          loading={kpiLoading}
          to="/reports"
        />
        <KpiCard
          title={t('dashboard.pendingOrders', 'Pending Orders')}
          value={stats.pendingOrders.toLocaleString()}
          icon={Clock}
          color="amber"
          loading={kpiLoading}
          to="/reports/inventory"
        />
        <KpiCard
          title={t('dashboard.activeCustomers', 'Active Customers')}
          value={stats.activeCustomers.toLocaleString()}
          icon={Users}
          color="teal"
          loading={kpiLoading}
          to="/customers"
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3">
        <div className="h-full lg:col-span-2">
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
