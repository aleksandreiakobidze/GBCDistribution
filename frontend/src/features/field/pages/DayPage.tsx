import { useMemo, useState } from 'react';
import axios from 'axios';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleDot, MessageSquareQuote, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button, Card, Input, MultiCombobox, ProgressRing, Spinner, StarRating } from '@/components/ui';
import { CustomerMap } from '@/features/customers/components/CustomerMap';
import { erpApi } from '@/lib/api/erp.api';
import { formatVisitClock } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useRouteDirections } from '@/hooks/useRouteDirections';
import { useAuthStore } from '@/stores/authStore';

function salesQuery(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value.split(',').map((part) => part.trim()).filter((part) => /^\d+$/.test(part));
}

function apiMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
  }
  return null;
}

export default function DayPage() {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [salesIds, setSalesIds] = useState<string[]>(() => salesQuery(params.get('sales')));
  const [selectedVisit, setSelectedVisit] = useState<number | null>(null);
  const [rating, setRating] = useState(3);
  const [note, setNote] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const supervisor = role === 'admin' || role === 'supervisor' || role === 'manager';

  const teamQuery = useQuery({
    queryKey: ['erp-team-reps'],
    queryFn: () => erpApi.teamReps(),
    enabled: supervisor,
  });

  const dayQuery = useQuery({
    queryKey: ['erp-day', salesIds],
    queryFn: () => erpApi.dayReport(salesIds.map(Number)),
    enabled: supervisor,
  });

  const surveysQuery = useQuery({
    queryKey: ['erp-surveys'],
    queryFn: () => erpApi.visitSurveys(),
    enabled: supervisor,
  });

  const coachingQuery = useQuery({
    queryKey: ['erp-coaching'],
    queryFn: () => erpApi.visitCoaching(),
    enabled: supervisor,
  });

  const coachMutation = useMutation({
    mutationFn: (visitId: number) =>
      erpApi.saveVisitCoaching({ visitId, rating, note: note.trim() || undefined }),
    onSuccess: async () => {
      setActionError(null);
      setNote('');
      await queryClient.invalidateQueries({ queryKey: ['erp-coaching'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
    },
    onError: (error) => {
      setActionError(apiMessage(error) ?? t('tasks.saveError', 'The task could not be saved.'));
    },
  });

  const report = dayQuery.data;
  const visits = report?.visits ?? [];
  const surveys = surveysQuery.data ?? [];
  const coaching = coachingQuery.data ?? [];

  const directions = useRouteDirections({
    origin: null,
    stops: visits.map((visit) => ({
      id: String(visit.id),
      name: visit.customerName ?? visit.customerId,
      latitude: visit.latitude,
      longitude: visit.longitude,
      done: visit.status !== 'open',
    })),
  });

  const current = useMemo(
    () => visits.find((visit) => visit.id === selectedVisit) ?? visits[0] ?? null,
    [selectedVisit, visits],
  );
  const currentSurvey = current ? surveys.find((row) => row.visitId === current.id) : undefined;
  const currentCoaching = current ? coaching.find((row) => row.visitId === current.id) : undefined;

  if (!supervisor) {
    return <Navigate to="/" replace />;
  }

  const answers = currentSurvey
    ? [
        { label: t('survey.shelfStocked', 'Shelf is stocked'), value: currentSurvey.shelfStocked },
        { label: t('survey.priceVisible', 'Price is visible'), value: currentSurvey.priceVisible },
        { label: t('survey.promoPresent', 'Promo is in place'), value: currentSurvey.promoPresent },
        { label: t('survey.competitorSeen', 'Competitor noticed'), value: currentSurvey.competitorSeen },
      ]
    : [];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <PageHeader title={t('day.title', 'Team day')} subtitle={t('day.subtitle', 'Today’s visits, coverage, and tasks')} />

      <MultiCombobox
        className="sm:max-w-xs"
        label={t('day.sales', 'Sales rep')}
        options={(teamQuery.data ?? []).map((rep) => ({ value: String(rep.id), label: rep.name }))}
        values={salesIds}
        onChange={setSalesIds}
        placeholder={t('day.all', 'Whole team')}
        searchPlaceholder={t('filters.searchSales', 'Search sales rep')}
        emptyText={t('filters.noResults', 'No results')}
        allLabel={t('filters.all', 'All')}
        clearLabel={t('filters.clear', 'Clear')}
        summary={(count) => t('filters.selected', '{{count}} selected', { count })}
      />

      {dayQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : report ? (
        <>
          <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="flex h-full items-center gap-4 p-5">
              <ProgressRing current={report.coverageVisited} total={report.coveragePlanned} size={80} thickness={8}>
                <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                  {report.coverageVisited}/{report.coveragePlanned}
                </span>
              </ProgressRing>
              <div>
                <p className="font-semibold text-[var(--color-text)]">{t('day.coverage', 'Coverage')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('dashboard.coverageHint', 'Completed visits against today plan.')}
                </p>
              </div>
            </Card>
            <Card className="flex h-full items-center gap-4 p-5">
              <ProgressRing current={report.tasksDone} total={report.tasksTotal} size={80} thickness={8} tone="success">
                <span className="text-sm font-bold tabular-nums text-[var(--color-text)]">
                  {report.tasksDone}/{report.tasksTotal}
                </span>
              </ProgressRing>
              <div>
                <p className="font-semibold text-[var(--color-text)]">{t('day.tasks', 'Tasks')}</p>
                <p className="text-xs text-[var(--color-text-secondary)]">{t('nav.tasks', 'Tasks')}</p>
              </div>
            </Card>
            <Card className="flex h-full flex-col justify-center p-5">
              <p className="text-xs text-[var(--color-text-secondary)]">{t('day.first', 'First visit')}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text)]">
                {formatVisitClock(report.firstVisitAt) || '—'}
              </p>
            </Card>
            <Card className="flex h-full flex-col justify-center p-5">
              <p className="text-xs text-[var(--color-text-secondary)]">{t('day.last', 'Last visit')}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-text)]">
                {formatVisitClock(report.lastVisitAt) || '—'}
              </p>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="space-y-4 xl:col-span-2">
              <CustomerMap
                pins={[]}
                heightClass="h-72 sm:h-96"
                directions={directions}
                selectedId={current ? String(current.id) : undefined}
                onPinClick={(id) => setSelectedVisit(Number(id))}
              />

              {visits.length === 0 ? (
                <p className="rounded-2xl border border-[var(--color-border)] px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  {t('day.empty', 'No visits today')}
                </p>
              ) : (
                <ol className="space-y-2">
                  {visits.map((visit, index) => {
                    const survey = surveys.find((row) => row.visitId === visit.id);
                    const active = current?.id === visit.id;
                    return (
                      <li key={visit.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedVisit(visit.id)}
                          className={cn(
                            'flex w-full items-start gap-3 rounded-2xl border bg-[var(--color-surface)] px-3 py-2.5 text-left transition-all duration-150',
                            active
                              ? 'border-[var(--color-primary)] shadow-[var(--shadow-sm)]'
                              : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                          )}
                        >
                          <span
                            className={cn(
                              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                              visit.status === 'arrived'
                                ? 'bg-[var(--color-success)] text-white'
                                : visit.status === 'missed'
                                  ? 'bg-[var(--color-warning)] text-white'
                                  : 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]',
                            )}
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-[var(--color-text)]">
                              {visit.customerName || visit.customerId}
                            </span>
                            <span className="block truncate text-xs text-[var(--color-text-secondary)]">
                              {[visit.salesName, formatVisitClock(visit.startedAt), formatVisitClock(visit.endedAt)]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                            {survey ? (
                              <span className="mt-1 flex flex-wrap gap-1">
                                <Chip on={survey.shelfStocked} label={t('survey.shelfStocked', 'Shelf is stocked')} />
                                <Chip on={survey.priceVisible} label={t('survey.priceVisible', 'Price is visible')} />
                                <Chip on={survey.promoPresent} label={t('survey.promoPresent', 'Promo is in place')} />
                                <Chip on={survey.competitorSeen} label={t('survey.competitorSeen', 'Competitor noticed')} />
                              </span>
                            ) : null}
                          </span>
                          {visit.status === 'missed' ? (
                            <TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
                          ) : visit.status === 'arrived' ? (
                            <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-[var(--color-success)]" />
                          ) : (
                            <CircleDot className="mt-1 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                          )}
                        </button>
                        {role === 'supervisor' || role === 'manager' || role === 'admin' ? (
                          <Link
                            to={`/customers/${encodeURIComponent(visit.customerId)}?salesUserId=${visit.salesUserId}`}
                            className="mt-1 inline-flex px-1 text-xs font-semibold text-[var(--color-primary)]"
                          >
                            {t('shelf.planogram', 'Planogram')}
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <Card className="h-fit space-y-3 p-4 xl:sticky xl:top-4">
              <p className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
                <MessageSquareQuote className="h-4 w-4 text-[var(--color-text-secondary)]" />
                {t('survey.coaching', 'Coaching')}
              </p>
              {current ? (
                <>
                  <p className="text-sm font-medium text-[var(--color-text)]">
                    {current.customerName || current.customerId}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {[current.salesName, formatVisitClock(current.startedAt)].filter(Boolean).join(' · ')}
                  </p>

                  {answers.length > 0 ? (
                    <ul className="space-y-1 rounded-xl bg-[var(--color-surface-hover)] p-2.5">
                      {answers.map((answer) => (
                        <li key={answer.label} className="flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0 truncate text-[var(--color-text)]">{answer.label}</span>
                          <span
                            className={cn(
                              'shrink-0 font-semibold',
                              answer.value ? 'text-[var(--color-success)]' : 'text-[var(--color-text-tertiary)]',
                            )}
                          >
                            {answer.value ? t('survey.yes', 'Yes') : t('survey.no', 'No')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {t('dashboard.surveyEmpty', 'No surveys today')}
                    </p>
                  )}

                  {currentCoaching ? (
                    <p className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[var(--color-success-light)] px-2.5 py-2 text-xs text-[var(--color-success-fg)]">
                      <StarRating value={currentCoaching.rating} />
                      <span>
                        {currentCoaching.supervisorName ? currentCoaching.supervisorName : ''}
                        {currentCoaching.supervisorName && currentCoaching.note ? ' · ' : ''}
                        {currentCoaching.note ?? ''}
                      </span>
                    </p>
                  ) : null}

                  <div>
                    <p className="mb-1 text-sm font-medium text-[var(--color-text)]">{t('gallery.rating', 'Rating')}</p>
                    <StarRating value={rating} onChange={setRating} size="md" />
                  </div>

                  <Input
                    label={t('survey.coachingNote', 'Note for the sales rep')}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={300}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    fullWidth
                    disabled={coachMutation.isPending}
                    onClick={() => coachMutation.mutate(current.id)}
                  >
                    {t('survey.saveCoaching', 'Save rating')}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">{t('day.empty', 'No visits today')}</p>
              )}
              {actionError ? <p className="text-sm font-medium text-[var(--color-warning)]">{actionError}</p> : null}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
        on
          ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
          : 'bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]',
      )}
    >
      {label}
    </span>
  );
}
