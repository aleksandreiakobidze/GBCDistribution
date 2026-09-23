import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';

interface VisitTrendChartProps {
  data: Array<{ date: string; visits: number; customers: number }>;
  height?: number;
}

function TrendTooltip({
  active,
  payload,
  label,
  visitsLabel,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  visitsLabel: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-lg)]">
      <p className="text-xs text-[var(--color-text-secondary)]">{label}</p>
      <p className="text-sm font-semibold text-[var(--color-text)]">
        {visitsLabel}: {payload[0].value}
      </p>
    </div>
  );
}

export function VisitTrendChart({ data, height = 200 }: VisitTrendChartProps) {
  const { t } = useTranslation();
  const visitsLabel = t('dashboard.trendVisits', 'Visits');

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
        <defs>
          <linearGradient id="visitTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value: string) => value.slice(5).replace('-', '/')}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<TrendTooltip visitsLabel={visitsLabel} />} />
        <Area
          type="monotone"
          dataKey="visits"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="url(#visitTrend)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
