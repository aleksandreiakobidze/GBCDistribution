import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { TrendingUp, ShoppingCart, DollarSign, Loader2 } from 'lucide-react';
import { Card, Input } from '@/components/ui';
import { PageHeader } from '@/components/shared';
import { reportsApi } from '@/lib/api/reports.api';
import { formatCurrency } from '@/lib/utils/format';

function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export default function SalesReportPage() {
  const { t } = useTranslation();
  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const { data, isLoading } = useQuery({
    queryKey: ['reports-sales', dateFrom, dateTo],
    queryFn: () => reportsApi.sales({ date_from: dateFrom, date_to: dateTo }),
  });

  const kpis = [
    {
      label: 'Total Sales',
      value: formatCurrency(data?.total_sales ?? 0),
      icon: DollarSign,
      color: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
    },
    {
      label: 'Total Orders',
      value: String(data?.total_orders ?? 0),
      icon: ShoppingCart,
      color: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
    },
    {
      label: t('reports.averageOrderValue'),
      value: formatCurrency(data?.average_order_value ?? 0),
      icon: TrendingUp,
      color: 'bg-[var(--color-chart-4)]/10 text-[var(--color-chart-4)]',
    },
  ];

  const salesByDay = data?.sales_by_day ?? [];
  const topProducts = data?.top_products ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports.salesReport')} />

      {/* Date Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Input
            label={t('reports.dateFrom')}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            label={t('reports.dateTo')}
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {kpis.map((kpi) => (
              <Card key={kpi.label} className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${kpi.color}`}>
                    <kpi.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--color-text-secondary)]">{kpi.label}</p>
                    <p className="text-2xl font-bold text-[var(--color-text)]">{kpi.value}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Sales Trend Chart */}
          <Card className="p-6">
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Sales Trend
            </h3>
            {salesByDay.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={salesByDay}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), 'Sales']}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#salesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-secondary)]">
                No sales data for selected period
              </div>
            )}
          </Card>

          {/* Top Products */}
          <Card className="p-6">
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {t('reports.topProducts')}
            </h3>
            {topProducts.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={topProducts.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
                  <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                  <YAxis
                    type="category"
                    dataKey="product_name"
                    width={140}
                    tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                  />
                  <Bar dataKey="total_revenue" fill="var(--color-primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-secondary)]">
                No product data for selected period
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
