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

export default function DashboardPage() {
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

      {/* KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title={t('dashboard.totalOrders', 'Total Orders')}
          value={stats.totalOrders.toLocaleString()}
          icon={ShoppingCart}
          color="blue"
          change={12.5}
          loading={kpiLoading}
        />
        <KpiCard
          title={t('dashboard.totalRevenue', 'Total Revenue')}
          value={formatCurrency(stats.totalRevenue)}
          icon={Banknote}
          color="green"
          change={8.2}
          loading={kpiLoading}
        />
        <KpiCard
          title={t('dashboard.pendingOrders', 'Pending Orders')}
          value={stats.pendingOrders.toLocaleString()}
          icon={Clock}
          color="amber"
          change={-3.1}
          loading={kpiLoading}
        />
        <KpiCard
          title={t('dashboard.activeCustomers', 'Active Customers')}
          value={stats.activeCustomers.toLocaleString()}
          icon={Users}
          color="teal"
          change={5.7}
          loading={kpiLoading}
        />
      </div>

      {/* Charts Row */}
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

      {/* Recent Orders */}
      <RecentOrders />
    </div>
  );
}
