import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';

interface SalesChartProps {
  data: Array<{ date: string; total: number }>;
  loading?: boolean;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5 shadow-[var(--shadow-lg)]">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--color-text)]">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export function SalesChart({ data, loading }: SalesChartProps) {
  const { t } = useTranslation();

  return (
    <Card className="h-full">
      <h3 className="mb-4 text-base font-semibold text-[var(--color-text)]">
        {t('dashboard.salesOverview', 'Sales Overview')}
      </h3>

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <div className="h-full w-full animate-pulse rounded-xl bg-[var(--color-skeleton-shine)]" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={288}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `₾${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              fill="url(#salesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
