import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Images,
  Map as MapIcon,
  Sun,
  Users,
} from 'lucide-react';
import { PageHeader, ErpErrorAlert } from '@/components/shared';
import { Card, MetricCard, ProgressRing, Spinner } from '@/components/ui';
import { erpApi } from '@/lib/api/erp.api';
import { formatVisitClock } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ErpDashboardRep } from '@/types';
import { VisitTrendChart } from './VisitTrendChart';

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

const quickLinks = [
  { to: '/day', labelKey: 'nav.day', fallback: 'Day', icon: Sun },
  { to: '/tasks', labelKey: 'nav.tasks', fallback: 'Tasks', icon: ClipboardList },
  { to: '/gallery', labelKey: 'nav.gallery', fallback: 'Photos', icon: Images },
  { to: '/promos', labelKey: 'nav.promoCalendar', fallback: 'Promo calendar', icon: CalendarDays },
  { to: '/routes', labelKey: 'nav.routes', fallback: 'Routes', icon: MapIcon },
];

export function SupervisorDashboard() {
  const { t } = useTranslation();

  const dashboardQuery = useQuery({
    queryKey: ['erp-dashboard'],
    queryFn: () => erpApi.fieldDashboard(),
    retry: false,
  });

  const data = dashboardQuery.data;
  const totals = data?.totals;
  const team = data?.team ?? [];
  const taskTotal = totals ? totals.openTasks + totals.doneTasks + totals.checkedTasks : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('nav.dashboard', 'Dashboard')}
        subtitle={t('dashboard.supervisorSubtitle', 'FMG visit days for your sales team only')}
      />

      {dashboardQuery.isError && (
        <ErpErrorAlert
          error={dashboardQuery.error}
          fallback={t('dashboard.loadError', 'The dashboard could not be loaded.')}
        />
      )}

      {dashboardQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : totals ? (
        <>
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link to="/day" className="block h-full">
            <Card className="flex h-full items-center gap-4 p-5 transition-transform hover:-translate-y-0.5 hover:border-[var(--color-primary)]/40">
              <ProgressRing current={totals.visited} total={totals.planned} size={96} tone="primary">
                <span className="text-lg font-bold tabular-nums text-[var(--color-text)]">
                  {totals.visited}
                  <span className="text-sm font-medium text-[var(--color-text-secondary)]">/{totals.planned}</span>
                </span>
              </ProgressRing>
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
                  {t('dashboard.coverage', 'Today coverage')}
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                </p>
                <p className="mt-1 text-xs leading-snug text-[var(--color-text-secondary)]">
                  {t('dashboard.coverageHint', 'Completed visits against today plan.')}
                </p>
                <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
                  {t('dashboard.openVisits', 'Open visits')}: {totals.openVisits} ·{' '}
                  {t('dashboard.missedVisits', 'Could not enter')}: {totals.missedVisits}
                </p>
              </div>
            </Card>
            </Link>

            <Card className="flex h-full flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-2">
                <Link to="/tasks" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
                  {t('dashboard.taskFunnel', 'Task funnel')}
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                </Link>
                {totals.overdueTasks > 0 && (
                  <Link
                    to="/tasks?status=overdue"
                    className="rounded-full bg-[var(--color-danger)]/10 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-danger)]"
                  >
                    {t('dashboard.taskOverdue', '{{count}} overdue', { count: totals.overdueTasks })}
                  </Link>
                )}
              </div>
              <Bar
                label={t('dashboard.taskOpen', 'Open')}
                value={totals.openTasks}
                total={taskTotal}
                tone="bg-[var(--color-primary)]"
                to="/tasks?status=open"
              />
              <Bar
                label={t('dashboard.taskDone', 'Done')}
                value={totals.doneTasks}
                total={taskTotal}
                tone="bg-[var(--color-warning)]"
                to="/tasks?status=done"
              />
              <Bar
                label={t('dashboard.taskChecked', 'Checked')}
                value={totals.checkedTasks}
                total={taskTotal}
                tone="bg-[var(--color-success)]"
                to="/tasks?status=checked"
              />
            </Card>

            <MetricCard
              title={t('dashboard.reviewQueue', 'Photos to review')}
              value={totals.unreviewedPhotos}
              icon={Images}
              tone="warning"
              hint={t('dashboard.reviewQueueHint', 'Photos not reviewed in the gallery.')}
              footer={
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {t('dashboard.photos', 'Photos')}: {totals.photosToday}
                </span>
              }
              to="/gallery"
            />

            <Card className="flex h-full flex-col gap-3 p-5">
              <Link to="/promos" className="flex items-center gap-2 rounded-lg font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
                {t('dashboard.promoStatus', 'Promo status')}
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
              </Link>
              <Bar
                label={t('promoCalendar.planned', 'Planned')}
                value={totals.promoPlanned}
                total={totals.promoPlanned + totals.promoActive + totals.promoDone}
                tone="bg-[var(--color-primary)]"
                to="/promos?status=planned"
              />
              <Bar
                label={t('promoCalendar.active', 'Active')}
                value={totals.promoActive}
                total={totals.promoPlanned + totals.promoActive + totals.promoDone}
                tone="bg-[var(--color-secondary)]"
                to="/promos?status=active"
              />
              <Bar
                label={t('promoCalendar.done', 'Done')}
                value={totals.promoDone}
                total={totals.promoPlanned + totals.promoActive + totals.promoDone}
                tone="bg-[var(--color-success)]"
                to="/promos?status=done"
              />
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="h-full overflow-hidden p-0 xl:col-span-2">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 py-3">
                <p className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
                  <Users className="h-4 w-4 text-[var(--color-text-secondary)]" />
                  {t('dashboard.team', 'Team')}
                  <span className="text-sm font-normal text-[var(--color-text-secondary)]">{totals.reps}</span>
                </p>
                <Link to="/day" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)]">
                  {t('nav.day', 'Day')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {team.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  {t('dashboard.teamEmpty', 'The team is empty')}
                </p>
              ) : (
                <ul className="divide-y divide-[var(--color-border)]">
                  {team.map((rep) => (
                    <TeamRow key={rep.salesUserId} rep={rep} />
                  ))}
                </ul>
              )}
            </Card>

            <div className="flex h-full flex-col gap-4">
              <Card className="p-5">
                <Link to="/day" className="mb-3 flex items-center gap-2 rounded-lg font-semibold text-[var(--color-text)] hover:text-[var(--color-primary)]">
                  {t('dashboard.trend', 'Last 7 days')}
                  <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                </Link>
                <VisitTrendChart data={data?.trend ?? []} />
              </Card>
              <Card className="flex flex-1 flex-col gap-3 p-5">
                <p className="font-semibold text-[var(--color-text)]">
                  {t('dashboard.surveySummary', 'Survey results')}
                </p>
                {totals.surveyCount === 0 ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {t('dashboard.surveyEmpty', 'No surveys today')}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Bar
                      label={t('survey.shelfStocked', 'Shelf is stocked')}
                      value={totals.shelfStocked}
                      total={totals.surveyCount}
                      tone="bg-[var(--color-success)]"
                    />
                    <Bar
                      label={t('survey.priceVisible', 'Price is visible')}
                      value={totals.priceVisible}
                      total={totals.surveyCount}
                      tone="bg-[var(--color-primary)]"
                    />
                    <Bar
                      label={t('survey.promoPresent', 'Promo is in place')}
                      value={totals.promoPresent}
                      total={totals.surveyCount}
                      tone="bg-[var(--color-secondary)]"
                    />
                    <Bar
                      label={t('survey.competitorSeen', 'Competitor noticed')}
                      value={totals.competitorSeen}
                      total={totals.surveyCount}
                      tone="bg-[var(--color-warning)]"
                    />
                  </div>
                )}
              </Card>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-[var(--color-text)]">
              {t('dashboard.quickLinks', 'Quick links')}
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
              {quickLinks.map((link) => (
                <Link key={link.to} to={link.to} className="block h-full">
                  <Card hoverable className="flex h-full items-center justify-between gap-2 p-3.5">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                        <link.icon className="h-4 w-4" />
                      </span>
                      <span className="truncate text-sm font-medium">{t(link.labelKey, link.fallback)}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-text-secondary)]" />
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function TeamRow({ rep }: { rep: ErpDashboardRep }) {
  const { t } = useTranslation();
  const first = formatVisitClock(rep.firstVisitAt);
  const last = formatVisitClock(rep.lastVisitAt);
  const sales = encodeURIComponent(String(rep.salesUserId));

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Link to={`/day?sales=${sales}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:text-[var(--color-primary)]">
        <ProgressRing current={rep.visited} total={rep.planned} size={48} thickness={6} tone="primary">
          <span className="text-[11px] font-bold tabular-nums text-[var(--color-text)]">{rep.coverage}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-[var(--color-text)]">{rep.salesName}</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t('day.coverage', 'Coverage')} {rep.visited}/{rep.planned}
            {first ? ` · ${t('dashboard.firstVisit', 'First')} ${first}` : ''}
            {last ? ` · ${t('dashboard.lastVisit', 'Last')} ${last}` : ''}
          </p>
        </div>
      </Link>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
        <Pill tone="primary" label={t('dashboard.taskOpen', 'Open')} value={rep.openTasks} to={`/tasks?status=open&sales=${sales}`} />
        <Pill tone="warning" label={t('dashboard.taskDone', 'Done')} value={rep.doneTasks} to={`/tasks?status=done&sales=${sales}`} />
        <Pill tone="success" label={t('dashboard.taskChecked', 'Checked')} value={rep.checkedTasks} to={`/tasks?status=checked&sales=${sales}`} />
        <Pill tone="secondary" label={t('dashboard.photos', 'Photos')} value={rep.photosToday} to={`/gallery?sales=${sales}`} />
      </div>
    </li>
  );
}

const pillTones = {
  primary: 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
  warning: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
  success: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
  secondary: 'bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]',
} as const;

function Pill({ tone, label, value, to }: { tone: keyof typeof pillTones; label: string; value: number; to: string }) {
  return (
    <Link to={to} className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium hover:opacity-80', pillTones[tone])}>
      {label} {value}
    </Link>
  );
}
