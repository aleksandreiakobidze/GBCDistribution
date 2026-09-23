import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

interface TopProductsProps {
  data: Array<{ product_name: string; total_quantity: number; total_revenue: number }>;
  loading?: boolean;
}

const barColors = [
  'bg-[var(--color-chart-1)]',
  'bg-[var(--color-chart-2)]',
  'bg-[var(--color-chart-4)]',
  'bg-[var(--color-chart-3)]',
  'bg-[var(--color-chart-5)]',
];

export function TopProducts({ data, loading }: TopProductsProps) {
  const { t } = useTranslation();
  const maxRevenue = data.length ? Math.max(...data.map((d) => d.total_revenue)) : 1;

  return (
    <Card className="h-full">
      <h3 className="mb-4 text-base font-semibold text-[var(--color-text)]">
        {t('dashboard.topProducts', 'Top Products')}
      </h3>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-1.5">
              <div className="flex justify-between">
                <div className="h-3.5 w-28 rounded bg-[var(--color-skeleton)]" />
                <div className="h-3.5 w-16 rounded bg-[var(--color-skeleton)]" />
              </div>
              <div className="h-2.5 w-full rounded-full bg-[var(--color-skeleton-shine)]" />
            </div>
          ))}
        </div>
      ) : !data.length ? (
        <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t('dashboard.noData', 'No data available')}
        </p>
      ) : (
        <div className="space-y-4">
          {data.slice(0, 5).map((item, i) => {
            const pct = (item.total_revenue / maxRevenue) * 100;
            return (
              <div key={item.product_name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-[var(--color-text)]">
                    <span className="mr-2 text-xs text-[var(--color-text-tertiary)]">
                      #{i + 1}
                    </span>
                    {item.product_name}
                  </span>
                  <span className="ml-3 shrink-0 tabular-nums text-[var(--color-text-secondary)]">
                    {formatCurrency(item.total_revenue)}
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-inset)]">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700 ease-out',
                      barColors[i % barColors.length],
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
                  {item.total_quantity} {t('dashboard.unitsSold', 'units sold')}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
