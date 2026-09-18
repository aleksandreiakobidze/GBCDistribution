import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Users, Loader2 } from 'lucide-react';
import { Card, Input } from '@/components/ui';
import { PageHeader, DataTable, type DataTableColumn } from '@/components/shared';
import { reportsApi } from '@/lib/api/reports.api';
import { formatCurrency } from '@/lib/utils/format';

interface SalesRepPerformance {
  id: number;
  name: string;
  orders_count: number;
  total_sales: number;
  customers_visited: number;
}

function getDefaultDates() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  };
}

export default function PerformanceReportPage() {
  const { t } = useTranslation();
  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);

  const { data, isLoading } = useQuery<{ sales_reps: SalesRepPerformance[] }>({
    queryKey: ['reports-performance', dateFrom, dateTo],
    queryFn: () => reportsApi.performance({ date_from: dateFrom, date_to: dateTo }),
  });

  const reps = data?.sales_reps ?? [];

  const columns: DataTableColumn<SalesRepPerformance>[] = [
    {
      key: 'name',
      header: t('common.name'),
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Users className="h-4 w-4" />
          </div>
          <span className="font-medium text-[var(--color-text)]">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'orders_count',
      header: 'Orders',
      render: (row) => <span className="font-semibold">{row.orders_count}</span>,
    },
    {
      key: 'total_sales',
      header: 'Total Sales',
      render: (row) => (
        <span className="font-semibold text-[var(--color-success)]">
          {formatCurrency(row.total_sales)}
        </span>
      ),
    },
    {
      key: 'customers_visited',
      header: 'Customers Visited',
      render: (row) => (
        <span className="text-[var(--color-text-secondary)]">{row.customers_visited}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports.performanceReport')} />

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
          {/* Performance Table */}
          <Card className="overflow-hidden">
            <DataTable<SalesRepPerformance>
              columns={columns}
              data={reps}
              loading={isLoading}
              emptyMessage="No performance data for selected period"
            />
          </Card>

          {/* Performance Bar Chart */}
          {reps.length > 0 && (
            <Card className="p-6">
              <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Sales Comparison
              </h3>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={reps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }}
                    interval={0}
                    angle={-30}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 12,
                      fontSize: 13,
                    }}
                    formatter={(value, name) => [
                      name === 'total_sales' ? formatCurrency(Number(value)) : value,
                      name === 'total_sales'
                        ? 'Sales'
                        : name === 'orders_count'
                          ? 'Orders'
                          : 'Visits',
                    ]}
                  />
                  <Legend
                    formatter={(value) =>
                      value === 'total_sales'
                        ? 'Sales'
                        : value === 'orders_count'
                          ? 'Orders'
                          : 'Visits'
                    }
                  />
                  <Bar dataKey="total_sales" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="orders_count" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="customers_visited" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
