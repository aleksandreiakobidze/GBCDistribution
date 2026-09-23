import { useState, type ReactNode } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Banknote,
  Camera,
  ChevronRight,
  ClipboardList,
  Clock,
  MapPin,
  MessageSquareQuote,
  RotateCcw,
  ShoppingCart,
  Sun,
} from 'lucide-react';
import { ErpErrorAlert, PageHeader } from '@/components/shared';
import { Card, MetricCard, SegmentedControl, Spinner, StarRating } from '@/components/ui';
import { VisitTrendChart } from '@/features/dashboard/components/VisitTrendChart';
import { erpApi } from '@/lib/api/erp.api';
import { formatCurrency, formatVisitClock } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import type { PresellerReport } from '@/types';

const periods = [1, 7, 30, 90] as const;

export default function MyReportsPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const [days, setDays] = useState<(typeof periods)[number]>(7);

  const reportQuery = useQuery({
    queryKey: ['my-reports', days],
    queryFn: () => erpApi.myReports(days),
    enabled: role === 'sales_rep',
    retry: false,
  });

  if (role && role !== 'sales_rep') {
    return <Navigate to="/" replace />;
  }

  const report = reportQuery.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('myReports.title', 'Reports')}
        subtitle={
          report
            ? `${t('myReports.subtitle', 'Your field work for the selected period')} · ${report.from} – ${report.to}`
            : t('myReports.subtitle', 'Your field work for the selected period')
        }
        action={
          <SegmentedControl
            ariaLabel={t('myReports.title', 'Reports')}
            size="sm"
            value={String(days)}
            onChange={(value) => setDays(Number(value) as (typeof periods)[number])}
            options={periods.map((period) => ({
              value: String(period),
              label: period === 1 ? t('myReports.today', 'Today') : t(`myReports.days${period}`, `${period} days`),
            }))}
          />
        }
      />

      {reportQuery.isError && (
        <ErpErrorAlert error={reportQuery.error} fallback={t('myReports.loadError', 'The report could not be loaded.')} />
      )}

      {reportQuery.isLoading || !role ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : report ? (
        <ReportBody report={report} />
      ) : null}
    </div>
  );
}

function ReportBody({ report }: { report: PresellerReport }) {
  const { t } = useTranslation();
  const surveyTotal = report.survey.count;
  const photoTotal = report.photos.before + report.photos.survey + report.photos.shelf + report.photos.end;
  const taskTotal = report.tasks.open + report.tasks.done + report.tasks.checked;

  const promoTotal = report.promos.planned + report.promos.active + report.promos.done;

  return (
    <div className="grid grid-cols-12 gap-4">
      <MetricCard
        className="col-span-12 sm:col-span-6 lg:col-span-3"
        title={t('myReports.visits', 'Visits')}
        value={report.visits.finished}
        icon={MapPin}
        tone="primary"
        to="/customers"
        hint={
          report.visits.averageMinutes == null
            ? t('myReports.noDuration', 'No duration yet')
            : `${t('myReports.avgDuration', 'Average duration')} · ${t('myReports.minutes', { count: report.visits.averageMinutes })}`
        }
      />
      <MetricCard
        className="col-span-12 sm:col-span-6 lg:col-span-3"
        title={t('myReports.collected', 'Collected')}
        value={formatCurrency(report.money.collected)}
        icon={Banknote}
        tone="success"
        to="/collections"
      />
      <MetricCard
        className="col-span-12 sm:col-span-6 lg:col-span-3"
        title={t('myReports.tasks', 'Tasks')}
        value={report.tasks.open}
        icon={ClipboardList}
        tone={report.tasks.overdue > 0 ? 'danger' : 'warning'}
        to="/tasks?status=open"
        hint={`${t('myReports.overdue', 'Overdue')} ${report.tasks.overdue}`}
      />
      <MetricCard
        className="col-span-12 sm:col-span-6 lg:col-span-3"
        title={t('myReports.photos', 'Photos')}
        value={photoTotal}
        icon={Camera}
        tone="secondary"
        to="/gallery"
      />

      <Card className="col-span-12 flex h-full flex-col p-5 lg:col-span-8">
        <SourceTitle to="/customers" className="mb-3">{t('myReports.visitTrend', 'Visits by day')}</SourceTitle>
        <VisitTrendChart
          data={report.visits.byDay.map((point) => ({ ...point, customers: 0 }))}
          height={220}
        />
        {report.visits.finished === 0 ? (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {t('myReports.emptyVisits', 'No finished visits in this period.')}
          </p>
        ) : (
          <p className="mt-auto flex items-center gap-3 pt-2 text-xs text-[var(--color-text-secondary)]">
            <Clock className="h-3.5 w-3.5" />
            {report.visits.firstAt
              ? `${t('myReports.first', 'First')} ${formatVisitClock(report.visits.firstAt)}`
              : ''}
            {report.visits.lastAt
              ? ` · ${t('myReports.last', 'Last')} ${formatVisitClock(report.visits.lastAt)}`
              : ''}
          </p>
        )}
      </Card>

      <Card className="col-span-12 flex h-full flex-col gap-3 p-5 lg:col-span-4">
        <SectionTitle>{t('myReports.survey', 'Survey')}</SectionTitle>
        <Bar label={t('myReports.shelfStocked', 'Shelf stocked')} value={report.survey.shelfStocked} total={surveyTotal} tone="bg-[var(--color-success)]" />
        <Bar label={t('myReports.priceVisible', 'Price visible')} value={report.survey.priceVisible} total={surveyTotal} tone="bg-[var(--color-primary)]" />
        <Bar label={t('myReports.promoPresent', 'Promo in place')} value={report.survey.promoPresent} total={surveyTotal} tone="bg-[var(--color-secondary)]" />
        <Bar label={t('myReports.competitorSeen', 'Competitor seen')} value={report.survey.competitorSeen} total={surveyTotal} tone="bg-[var(--color-warning)]" />
      </Card>

      <Card className="col-span-12 flex h-full flex-col gap-3 p-5 lg:col-span-4">
        <SourceTitle to="/tasks">{t('myReports.tasks', 'Tasks')}</SourceTitle>
        <Bar label={t('myReports.open', 'Open')} value={report.tasks.open} total={taskTotal} tone="bg-[var(--color-primary)]" to="/tasks?status=open" />
        <Bar label={t('myReports.done', 'Done')} value={report.tasks.done} total={taskTotal} tone="bg-[var(--color-warning)]" to="/tasks?status=done" />
        <Bar label={t('myReports.checked', 'Checked')} value={report.tasks.checked} total={taskTotal} tone="bg-[var(--color-success)]" to="/tasks?status=checked" />
        <Bar label={t('myReports.overdue', 'Overdue')} value={report.tasks.overdue} total={Math.max(taskTotal, report.tasks.overdue)} tone="bg-[var(--color-danger)]" to="/tasks?status=overdue" />
      </Card>

      <Card className="col-span-12 flex h-full flex-col gap-3 p-5 lg:col-span-4">
        <SourceTitle to="/gallery">{t('myReports.photos', 'Photos')}</SourceTitle>
        <Bar label={t('customers.photoBefore', 'Before visit')} value={report.photos.before} total={photoTotal} tone="bg-[var(--color-primary)]" to="/gallery?phase=before" />
        <Bar label={t('customers.photoSurvey', 'Survey')} value={report.photos.survey} total={photoTotal} tone="bg-[var(--color-secondary)]" to="/gallery?phase=survey" />
        <Bar label={t('customers.photoShelf', 'Shelf')} value={report.photos.shelf} total={photoTotal} tone="bg-[var(--color-warning)]" to="/gallery?phase=shelf" />
        <Bar label={t('customers.photoEnd', 'At the end')} value={report.photos.end} total={photoTotal} tone="bg-[var(--color-success)]" to="/gallery?phase=end" />
      </Card>

      <Card className="col-span-12 flex h-full flex-col gap-3 p-5 lg:col-span-4">
        <SourceTitle to="/promos">
          <Sun className="h-4 w-4 text-[var(--color-text-secondary)]" />
          {t('myReports.promos', 'Promos')}
        </SourceTitle>
        <Bar label={t('myReports.planned', 'Planned')} value={report.promos.planned} total={promoTotal} tone="bg-[var(--color-primary)]" to="/promos?status=planned" />
        <Bar label={t('myReports.active', 'Active')} value={report.promos.active} total={promoTotal} tone="bg-[var(--color-secondary)]" to="/promos?status=active" />
        <Bar label={t('myReports.promoDone', 'Done')} value={report.promos.done} total={promoTotal} tone="bg-[var(--color-success)]" to="/promos?status=done" />
      </Card>

      <Card className="col-span-12 flex h-full flex-col justify-center p-5 sm:col-span-6">
        <SectionTitle>{t('myReports.audits', 'Audits')}</SectionTitle>
        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-[var(--color-text)]">{report.shelf.audits}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('myReports.shelf', 'Shelf audit')}</p>
      </Card>
      <Card className="col-span-12 flex h-full flex-col justify-center p-5 sm:col-span-6">
        <SectionTitle>{t('myReports.lines', 'Lines')}</SectionTitle>
        <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-[var(--color-text)]">{report.shelf.lines}</p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('myReports.shelf', 'Shelf audit')}</p>
      </Card>

      <Card className="col-span-12 flex h-full flex-col p-5 lg:col-span-8">
        <SourceTitle to="/collections" className="mb-3">{t('myReports.collectionTrend', 'Collections by day')}</SourceTitle>
        <AmountChart data={report.money.collectionsByDay} />
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Mini
            label={t('myReports.returns', 'Returns')}
            value={report.money.returns}
            hint={t('myReports.returns', 'Returns')}
            icon={RotateCcw}
            to="/returns"
          />
          <Mini
            label={t('myReports.savedOrders', 'Saved orders')}
            value={`${report.money.savedOrders} · ${formatCurrency(report.money.savedOrdersTotal)}`}
            hint={t('myReports.savedOrders', 'Saved orders')}
            icon={ShoppingCart}
            to="/orders"
          />
        </div>
      </Card>

      <div className="col-span-12 flex h-full flex-col gap-4 lg:col-span-4">
        <Card className="flex min-h-0 flex-1 flex-col p-5">
          <SectionTitle>{t('myReports.customers', 'Frequent customers')}</SectionTitle>
          {report.customers.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {t('myReports.noCustomers', 'No customers in this period.')}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {report.customers.map((customer, index) => (
                <li key={customer.customerId}>
                  <Link
                    to={`/customers/${encodeURIComponent(customer.customerId)}`}
                    className="flex items-center justify-between gap-3 rounded-lg px-1 py-0.5 hover:bg-[var(--color-surface-hover)]"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-xs font-semibold text-[var(--color-primary)]">
                        {index + 1}
                      </span>
                      <span className="truncate text-sm text-[var(--color-text)]">
                        {customer.customerName || customer.customerId}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--color-text)]">
                      {customer.visits}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <SectionTitle>
            <MessageSquareQuote className="h-4 w-4 text-[var(--color-text-secondary)]" />
            {t('myReports.coaching', 'Coaching')}
          </SectionTitle>
          {report.coaching.count === 0 ? (
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              {t('myReports.noCoaching', 'No note.')}
            </p>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-[var(--color-text)]">
                {report.coaching.note || t('myReports.noCoaching', 'No note.')}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
                {report.coaching.averageRating != null ? (
                  <StarRating value={report.coaching.averageRating} />
                ) : null}
                <span>
                  {report.coaching.averageRating != null
                    ? t('myReports.average', 'Average')
                    : ''}
                  {report.coaching.supervisorName ? ` · ${report.coaching.supervisorName}` : ''}
                </span>
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <p className={cn('flex min-h-6 items-center gap-2 font-semibold text-[var(--color-text)]', className)}>
      {children}
    </p>
  );
}

function SourceTitle({ to, className, children }: { to?: string; className?: string; children: ReactNode }) {
  const classes = cn('flex min-h-6 items-center gap-2 font-semibold text-[var(--color-text)]', className);
  if (!to) {
    return <p className={classes}>{children}</p>;
  }
  return (
    <Link to={to} className={cn(classes, 'rounded-lg hover:text-[var(--color-primary)]')}>
      {children}
      <ChevronRight className="ml-auto h-4 w-4 text-[var(--color-text-secondary)]" />
    </Link>
  );
}

function Bar({ label, value, total, tone, to }: { label: string; value: number; total: number; tone: string; to?: string }) {
  const width = total > 0 ? Math.round((value / total) * 100) : 0;
  const body = (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--color-text)]">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
        <div className={cn('h-full rounded-full transition-[width] duration-500', tone)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
  if (!to) {
    return body;
  }
  return (
    <Link to={to} className="-mx-1 block rounded-lg px-1 py-0.5 transition-colors hover:bg-[var(--color-surface-hover)]">
      {body}
    </Link>
  );
}

function Mini({
  label,
  value,
  hint,
  icon: Icon,
  to,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon?: typeof RotateCcw;
  to?: string;
}) {
  const body = (
    <div className="h-full rounded-xl bg-[var(--color-surface-inset)] px-3 py-3">
      <p className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold tabular-nums text-[var(--color-text)]" title={hint}>
        {value}
      </p>
    </div>
  );
  if (!to) {
    return body;
  }
  return (
    <Link to={to} className="block h-full rounded-xl transition-transform hover:-translate-y-0.5">
      {body}
    </Link>
  );
}

function AmountChart({ data }: { data: Array<{ date: string; amount: number }> }) {
  const { t } = useTranslation();
  const label = t('myReports.collected', 'Collected');

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="collectionTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value: string) => value.slice(5).replace('-', '/')}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={({ active, payload, label: day }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 shadow-[var(--shadow-lg)]">
                <p className="text-xs text-[var(--color-text-secondary)]">{day}</p>
                <p className="text-sm font-semibold text-[var(--color-text)]">
                  {label}: {formatCurrency(Number(payload[0].value))}
                </p>
              </div>
            );
          }}
        />
        <Area type="monotone" dataKey="amount" stroke="var(--color-chart-2)" strokeWidth={2} fill="url(#collectionTrend)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
