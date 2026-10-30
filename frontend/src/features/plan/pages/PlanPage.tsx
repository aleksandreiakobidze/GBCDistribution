import { useEffect, useState } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Upload } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Button,
  Card,
  Combobox,
  MultiCombobox,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  type ComboboxOption,
} from '@/components/ui';
import { planApi, type PlanChoices, type PlanFilters, type PlanRank } from '@/lib/api/plan.api';
import { cn } from '@/lib/utils/cn';

const PAGE_SIZE = 100;
const RANK_PREVIEW = 10;
const planScrollBox = 'min-w-0 max-h-[calc(100dvh-12rem)]';
const planHead = 'sticky top-0 z-20 h-9 whitespace-nowrap bg-[var(--color-surface-hover)] px-2 sm:px-3';
const planHeadCorner = 'sticky top-0 left-0 z-30 h-9 whitespace-nowrap bg-[var(--color-surface-hover)] px-2 sm:px-3 md:!sticky md:!left-0 md:!top-0 md:!z-30';
const planStickyCell = 'whitespace-nowrap px-2 py-2 sm:px-3 md:!sticky md:!left-0 md:!z-10';
const planNumHead = 'w-[4.75rem] text-right sm:w-24';
const planNumCell = 'w-[4.75rem] whitespace-nowrap px-2 py-2 text-right tabular-nums sm:w-24 sm:px-3';
const planPercentHead = 'w-[5.75rem] pr-3 text-center sm:w-28 sm:pr-4';
const planPercentCell = 'w-[5.75rem] whitespace-nowrap py-2 pl-2 pr-6 text-right tabular-nums sm:w-28 sm:pl-3 sm:pr-4';

const emptyFilters: PlanFilters = {
  region: [],
  supervisor: [],
  presale: '',
  presales: [],
  presaleChosen: false,
  channel: [],
  category: [],
  brand: [],
};

const multiKeys = ['region', 'supervisor', 'channel', 'category', 'brand'] as const;
type MultiKey = (typeof multiKeys)[number];

const choiceKey: Record<MultiKey, keyof PlanChoices> = {
  region: 'regions',
  supervisor: 'supervisors',
  channel: 'channels',
  category: 'categories',
  brand: 'brands',
};

function previewRanking(ranking: PlanRank[], full: boolean): PlanRank[] {
  if (full || ranking.length <= RANK_PREVIEW) {
    return ranking;
  }
  const self = ranking.find((row) => row.self);
  if (!self || self.rank <= RANK_PREVIEW) {
    return ranking.slice(0, RANK_PREVIEW);
  }
  return [...ranking.slice(0, RANK_PREVIEW - 1), self];
}

function asOptions(values: string[]): ComboboxOption[] {
  return values.map((value) => ({ value, label: value }));
}

function brandsFor(categories: string[], choices: PlanChoices | undefined): string[] {
  if (!choices) {
    return [];
  }
  if (categories.length === 0) {
    return choices.brands;
  }
  const selected = new Set(categories);
  const seen = new Set<string>();
  const brands: string[] = [];
  for (const pair of choices.catalog ?? []) {
    if (!selected.has(pair.category) || seen.has(pair.brand)) {
      continue;
    }
    seen.add(pair.brand);
    brands.push(pair.brand);
  }
  brands.sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }));
  return brands;
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

function formatVolume(value: number): string {
  return new Intl.NumberFormat('ka-GE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
}

function formatPercent(value: number | null): string {
  if (value === null) {
    return '—';
  }
  return `${new Intl.NumberFormat('ka-GE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

function percentClass(value: number | null): string {
  if (value === null) {
    return 'text-[var(--color-text-secondary)]';
  }
  if (value >= 100) {
    return 'text-[var(--color-success)]';
  }
  if (value >= 80) {
    return 'text-[var(--color-warning)]';
  }
  return 'text-[var(--color-danger)]';
}

export default function PlanPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<PlanFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [rankingFull, setRankingFull] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['plans', filters],
    queryFn: () => planApi.show(filters),
  });

  const upload = useMutation({
    mutationFn: (file: File) => planApi.upload(file),
    onSuccess: async () => {
      setFilters(emptyFilters);
      setPage(1);
      setRankingFull(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: (reason) => setError(apiMessage(reason) ?? t('common.error', 'შეცდომა')),
  });

  const refresh = useMutation({
    mutationFn: () => planApi.refresh(),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['plans'] });
      await queryClient.invalidateQueries({ queryKey: ['monitoring-reps'] });
    },
    onError: (reason) => setError(apiMessage(reason) ?? t('common.error', 'შეცდომა')),
  });

  const rows = (query.data?.rows ?? []).filter((row) => row.plan > 0 || row.real !== 0 || row.return !== 0);
  const totals = query.data?.totals;
  const ranking = query.data?.ranking ?? [];
  const shownRanking = previewRanking(ranking, rankingFull);
  const choices = query.data?.choices;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const busy = upload.isPending || refresh.isPending;
  const salesView = query.data?.scope === 'presale' || query.data?.scope === 'unmapped';
  const supervisorView = query.data?.scope === 'supervisor';
  const visibleFilters = multiKeys.filter((key) => {
    if (salesView && (key === 'region' || key === 'supervisor')) {
      return false;
    }
    return !(supervisorView && key === 'supervisor');
  });
  const supervisorMiss = supervisorView && (choices?.presales.length ?? 0) === 0 && (choices?.regions.length ?? 0) === 0;

  useEffect(() => {
    if (query.data?.scope !== 'supervisor' || filters.presaleChosen) {
      return;
    }
    setFilters((current) => (
      current.presaleChosen
        ? current
        : { ...current, presales: query.data?.choices.presales ?? [], presaleChosen: true }
    ));
  }, [query.data?.scope, query.data?.choices.presales, filters.presaleChosen]);

  useEffect(() => {
    const presales = query.data?.choices.presales;
    if (!filters.presaleChosen || !presales) {
      return;
    }
    setFilters((current) => {
      const next = current.presales.filter((name) => presales.includes(name));
      return next.length === current.presales.length ? current : { ...current, presales: next };
    });
  }, [query.data?.choices.presales, filters.presaleChosen]);

  useEffect(() => {
    const presales = query.data?.choices.presales;
    if (!presales || filters.presale === '' || presales.includes(filters.presale)) {
      return;
    }
    setFilters((current) => (current.presale === '' ? current : { ...current, presale: '' }));
  }, [query.data?.choices.presales, filters.presale]);

  const optionsFor = (key: MultiKey): string[] => {
    if (key === 'brand') {
      return brandsFor(filters.category, choices);
    }
    return choices?.[choiceKey[key]] ?? [];
  };

  const setMulti = (key: MultiKey, values: string[]) => {
    setFilters((current) => {
      if (key !== 'category') {
        return { ...current, [key]: values };
      }
      const allowed = new Set(brandsFor(values, choices));
      return {
        ...current,
        category: values,
        brand: current.brand.filter((brand) => allowed.has(brand)),
      };
    });
    setPage(1);
    setRankingFull(false);
  };

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={t('plan.title', 'გეგმა')}
        subtitle={t('plan.subtitle', 'თვის გეგმა ტევადობით')}
        action={
          (query.data?.canUpload || (query.data?.canRefresh && query.data.upload)) ? (
            <div className="flex flex-wrap gap-2">
              {query.data.canUpload ? (
              <label className={cn('inline-flex', busy && 'pointer-events-none opacity-60')}>
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) {
                      upload.mutate(file);
                    }
                  }}
                />
                <span className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-[var(--color-primary-fg)]">
                  <Upload className="h-4 w-4" />
                  {busy ? t('plan.working', 'ითვლება…') : t('plan.upload', 'Excel-ის ატვირთვა')}
                </span>
              </label>
              ) : null}
              {query.data.canRefresh && query.data.upload ? (
                <Button variant="outline" disabled={busy} onClick={() => refresh.mutate()}>
                  <RefreshCw className={cn('h-4 w-4', refresh.isPending && 'animate-spin')} />
                  {t('plan.refresh', 'განახლება')}
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {query.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : query.isError ? (
        <Card>
          <p className="text-sm font-medium text-[var(--color-danger)]">{apiMessage(query.error) ?? t('common.error', 'შეცდომა')}</p>
        </Card>
      ) : (
        <>
          {error ? <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p> : null}
          {query.data?.scope === 'unmapped' ? (
            <p className="text-sm font-medium text-[var(--color-warning)]">{t('plan.unmapped')}</p>
          ) : null}
          {!query.data?.upload ? (
            <Card>
              <p className="text-sm text-[var(--color-text-secondary)]">{t('plan.empty')}</p>
            </Card>
          ) : (
            <>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {query.data.upload.name}
                {query.data.upload.computedAt ? ` · ${query.data.upload.computedAt.slice(0, 16).replace('T', ' ')}` : ''}
                {` · ${t('plan.measure', 'ტევადობა')}`}
              </p>
              <Card className="p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {query.data.scope === 'supervisor' ? (
                    <MultiCombobox
                      label={t('plan.presale')}
                      options={asOptions(choices?.presales ?? [])}
                      values={filters.presales}
                      onChange={(values) => {
                        setFilters((current) => ({ ...current, presales: values, presaleChosen: true }));
                        setPage(1);
                        setRankingFull(false);
                      }}
                      placeholder={t('filters.all')}
                      searchPlaceholder={t('filters.search')}
                      emptyText={t('filters.noResults')}
                    />
                  ) : null}
                  {query.data.scope === 'all' ? (
                    <Combobox
                      label={t('plan.presale')}
                      options={asOptions(choices?.presales ?? [])}
                      value={filters.presale || null}
                      onChange={(value) => {
                        setFilters((current) => ({ ...current, presale: value ?? '' }));
                        setPage(1);
                        setRankingFull(false);
                      }}
                      placeholder={t('filters.all')}
                      searchPlaceholder={t('filters.search')}
                      emptyText={t('filters.noResults')}
                      clearable
                    />
                  ) : null}
                  {visibleFilters.map((key) => (
                    <MultiCombobox
                      key={key}
                      label={t(`plan.${key}`)}
                      options={asOptions(optionsFor(key))}
                      values={filters[key]}
                      onChange={(values) => setMulti(key, values)}
                      placeholder={t('filters.all')}
                      searchPlaceholder={t('filters.search')}
                      emptyText={t('filters.noResults')}
                      allLabel={t('filters.all')}
                      clearLabel={t('filters.clear')}
                      summary={(count) => t('filters.selected', { count })}
                    />
                  ))}
                </div>
              </Card>
              {supervisorMiss ? (
                <Card>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t('plan.unknownSupervisor')}</p>
                </Card>
              ) : !query.data.anchor && query.data.scope === 'all' ? (
                <Card>
                  <p className="text-sm text-[var(--color-text-secondary)]">{t('plan.pickPresale')}</p>
                </Card>
              ) : (
              <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Card className="order-first col-span-2 p-4 lg:order-last lg:col-span-1">
                  <p className="text-xs font-medium leading-snug text-[var(--color-text-secondary)]">{t('plan.fulfillment', 'გეგმის შესრულება')}</p>
                  <p className={cn('mt-1 text-2xl font-bold tabular-nums lg:text-xl', percentClass(totals?.percent ?? null))}>
                    {formatPercent(totals?.percent ?? null)}
                  </p>
                </Card>
                {(
                  [
                    ['target', totals?.plan ?? 0],
                    ['real', totals?.real ?? 0],
                    ['returns', totals?.return ?? 0],
                    ['net', totals?.net ?? 0],
                  ] as const
                ).map(([key, value]) => (
                  <Card key={key} className="p-4">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)]">{t(`plan.${key}`)}</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-[var(--color-text)]">{formatVolume(value)}</p>
                  </Card>
                ))}
              </div>

              <div className={cn('grid grid-cols-1 items-start gap-4', ranking.length > 0 && 'lg:grid-cols-[22rem_minmax(0,1fr)]')}>
              {ranking.length > 0 ? (
                <div className="min-w-0 space-y-2">
                  <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('plan.ranking', 'არხის რანკი')}</h2>
                  <Table containerClassName={cn('min-w-0', rankingFull && planScrollBox)} className="w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className={planHeadCorner}>{t('plan.presale')}</TableHead>
                        <TableHead className={cn(planHead, planPercentHead)}>{t('plan.percent')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shownRanking.map((row) => (
                        <TableRow key={row.presale} className={cn(row.self && 'bg-[var(--color-primary)]/10')}>
                          <TableCell
                            className={cn(planStickyCell, 'font-medium')}
                            style={
                              row.self
                                ? { background: 'color-mix(in srgb, var(--color-primary) 14%, var(--color-surface))' }
                                : undefined
                            }
                          >
                            <span className="mr-2 font-semibold tabular-nums">{row.rank}</span>
                            {row.presale}
                          </TableCell>
                          <TableCell className={cn(planPercentCell, 'font-semibold', percentClass(row.percent))}>
                            {formatPercent(row.percent)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {ranking.length > RANK_PREVIEW ? (
                    <Button variant="outline" size="sm" fullWidth onClick={() => setRankingFull((current) => !current)}>
                      {rankingFull ? t('plan.showTop', 'ტოპ 10') : t('plan.showAll', 'სრული სია')}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              <div className="min-w-0 space-y-2">
                <h2 className="text-sm font-semibold text-[var(--color-text)]">{t('plan.lines', 'ხაზები')}</h2>
                <Table containerClassName={cn(planScrollBox, '[scrollbar-gutter:stable] max-sm:pr-3')} className="w-max min-w-full">
                  <TableHeader>
                    <TableRow>
                      {supervisorView ? <TableHead className={planHeadCorner}>{t('plan.presale')}</TableHead> : null}
                      <TableHead className={supervisorView ? planHead : planHeadCorner}>{t('plan.category')}</TableHead>
                      <TableHead className={planHead}>{t('plan.brand')}</TableHead>
                      {(['target', 'net'] as const).map((key) => (
                        <TableHead key={key} className={cn(planHead, planNumHead)}>
                          {t(`plan.${key}`)}
                        </TableHead>
                      ))}
                      <TableHead className={cn(planHead, planPercentHead)}>{t('plan.percent')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={supervisorView ? 6 : 5} className="py-8 text-center text-[var(--color-text-secondary)]">
                          {t('plan.noRows')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      visible.map((row, index) => (
                        <TableRow key={`${row.factKey}-${index}`}>
                          {supervisorView ? (
                            <TableCell className={cn(planStickyCell, 'font-medium')}>{row.presale}</TableCell>
                          ) : null}
                          <TableCell className={supervisorView ? 'whitespace-nowrap px-2 py-2 sm:px-3' : cn(planStickyCell, 'font-medium')}>
                            {row.category}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-2 py-2 sm:px-3">{row.brand}</TableCell>
                          <TableCell className={planNumCell}>{formatVolume(row.plan)}</TableCell>
                          <TableCell className={planNumCell}>{formatVolume(row.net)}</TableCell>
                          <TableCell className={cn(planPercentCell, 'font-semibold', percentClass(row.percent))}>
                            {formatPercent(row.percent)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between gap-3 px-1 text-sm text-[var(--color-text-secondary)]">
                  <span>
                    {rows.length} {t('plan.rows', 'ხაზი')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                      ‹
                    </Button>
                    <span className="tabular-nums">
                      {currentPage} / {pageCount}
                    </span>
                    <Button variant="outline" size="sm" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
                      ›
                    </Button>
                  </div>
                </div>
              </div>
              </div>
              </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
