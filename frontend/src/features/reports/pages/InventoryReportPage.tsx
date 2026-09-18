import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Package, AlertTriangle, DollarSign, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui';
import { PageHeader } from '@/components/shared';
import { reportsApi } from '@/lib/api/reports.api';
import { formatCurrency } from '@/lib/utils/format';

const PIE_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-danger)',
  'var(--color-chart-4)',
  'var(--color-secondary)',
  'var(--color-chart-5)',
  'var(--color-chart-3)',
];

interface InventoryReportData {
  total_stock_value: number;
  low_stock_count: number;
  low_stock_items: Array<{
    product_name: string;
    current_quantity: number;
    min_stock_level: number;
  }>;
  stock_by_category: Array<{
    category: string;
    total_quantity: number;
  }>;
}

export default function InventoryReportPage() {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<InventoryReportData>({
    queryKey: ['reports-inventory'],
    queryFn: () => reportsApi.inventory(),
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  const stockValue = data?.total_stock_value ?? 0;
  const lowStockCount = data?.low_stock_count ?? 0;
  const lowStockItems = data?.low_stock_items ?? [];
  const stockByCategory = data?.stock_by_category ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports.inventoryReport')} />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-success-light)] text-[var(--color-success)]">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Total Stock Value</p>
              <p className="text-2xl font-bold text-[var(--color-text)]">
                {formatCurrency(stockValue)}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-danger-light)] text-[var(--color-danger)]">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-secondary)]">Low Stock Items</p>
              <p className="text-2xl font-bold text-[var(--color-danger)]">{lowStockCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Low Stock Items */}
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--color-border)] px-6 py-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              Low Stock Items
            </h3>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-[var(--color-text-secondary)]">
              All stock levels are healthy
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {lowStockItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-danger-light)] text-[var(--color-danger)]">
                      <Package className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium text-[var(--color-text)]">
                      {item.product_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold text-[var(--color-danger)]">
                      {item.current_quantity}
                    </span>
                    <span className="text-[var(--color-text-secondary)]">/</span>
                    <span className="text-[var(--color-text-secondary)]">
                      {item.min_stock_level}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Stock by Category */}
        <Card className="p-6">
          <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Stock by Category
          </h3>
          {stockByCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={stockByCategory}
                  dataKey="total_quantity"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={60}
                  paddingAngle={3}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {stockByCategory.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    fontSize: 13,
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-[var(--color-text-secondary)]">
              No category data available
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
