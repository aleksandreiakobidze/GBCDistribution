import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight, Download, Images, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  AsyncCombobox,
  Button,
  EmptyState,
  Input,
  MultiCombobox,
  SegmentedControl,
  Spinner,
  StarRating,
  type ComboboxOption,
} from '@/components/ui';
import { erpApi } from '@/lib/api/erp.api';
import { formatVisitClock } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import type { ErpGalleryPhoto } from '@/types';

function salesQuery(value: string | null): string[] {
  if (!value) {
    return [];
  }
  return value.split(',').map((part) => part.trim()).filter((part) => /^\d+$/.test(part));
}

function stamp(iso: string | null): string {
  if (!iso) {
    return '';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('ka-GE', {
    timeZone: 'Asia/Tbilisi',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

async function apiMessage(error: unknown): Promise<string | null> {
  if (!axios.isAxiosError(error)) {
    return null;
  }
  let data = error.response?.data;
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch {
      data = null;
    }
  }
  const message = data && typeof data === 'object' && 'message' in data ? data.message : null;
  return typeof message === 'string' && message.trim() !== '' ? message : null;
}

interface Draft {
  signature: string;
  reviewComment: string;
  rating: number | null;
  rotation: number;
  reviewed: boolean;
}

function draftFrom(photo: ErpGalleryPhoto): Draft {
  return {
    signature: photo.signature ?? '',
    reviewComment: photo.reviewComment ?? '',
    rating: photo.rating,
    rotation: photo.rotation ?? 0,
    reviewed: photo.reviewedAt != null,
  };
}

const phases = [
  { value: 'before', key: 'customers.photoBefore', fallback: 'Before visit' },
  { value: 'end', key: 'customers.photoEnd', fallback: 'At the end' },
  { value: 'survey', key: 'customers.photoSurvey', fallback: 'Survey' },
  { value: 'shelf', key: 'customers.photoShelf', fallback: 'Shelf' },
];

const photoPhases = ['before', 'survey', 'shelf', 'end'] as const;

export default function GalleryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id);
  const reviewer = role === 'admin' || role === 'supervisor' || role === 'manager';
  const queryClient = useQueryClient();
  const initialPhase = params.get('phase');
  const [salesIds, setSalesIds] = useState<string[]>(() => salesQuery(params.get('sales')));
  const [customer, setCustomer] = useState<ComboboxOption | null>(null);
  const [day, setDay] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [ratings, setRatings] = useState<string[]>([]);
  const [phaseValues, setPhaseValues] = useState<string[]>(
    initialPhase && (photoPhases as readonly string[]).includes(initialPhase) ? [initialPhase] : [],
  );
  const [reviewed, setReviewed] = useState('all');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [zoom, setZoom] = useState(1);
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const teamQuery = useQuery({
    queryKey: ['erp-team-reps'],
    queryFn: () => erpApi.teamReps(),
    enabled: reviewer,
  });

  const reps = teamQuery.data ?? [];

  const photosQuery = useQuery({
    queryKey: ['gallery-photos', { salesIds, customer: customer?.value, day, tags, ratings, phaseValues, reviewed, q }],
    queryFn: () =>
      erpApi.galleryPhotos({
        salesUserId: salesIds.length > 0 ? salesIds.map(Number) : undefined,
        customer: customer?.value || undefined,
        day: day || undefined,
        tag: tags.length > 0 ? tags : undefined,
        rating: ratings.length > 0 ? ratings.map(Number) : undefined,
        phase: phaseValues.length > 0 ? phaseValues : undefined,
        reviewed: reviewed === 'all' ? undefined : (reviewed as '0' | '1'),
        q: q.trim() || undefined,
      }),
  });

  const photos = photosQuery.data ?? [];

  const tagOptions = useMemo(() => {
    const seen = new Set<string>(tags);
    for (const photo of photos) {
      for (const tag of photo.tags) {
        seen.add(tag);
      }
    }
    return Array.from(seen).sort().map((tag) => ({ value: tag, label: `#${tag}` }));
  }, [photos, tags]);

  const searchCustomers = useCallback(
    async (search: string): Promise<ComboboxOption[]> => {
      const ids = salesIds.length > 0
        ? salesIds.map(Number)
        : reviewer
          ? reps.map((rep) => rep.id)
          : userId != null
            ? [userId]
            : [];
      const pages = await Promise.all(
        ids.slice(0, 6).map((id) =>
          erpApi
            .customers({ search: search || undefined, limit: 20, day: 'all', salesUserId: id })
            .catch(() => null),
        ),
      );
      const options = new Map<string, ComboboxOption>();
      for (const page of pages) {
        for (const row of page?.items ?? []) {
          options.set(row.customerId, {
            value: row.customerId,
            label: row.name,
            hint: [row.orgCode ?? row.customerId, row.city].filter(Boolean).join(' · '),
          });
        }
      }
      return Array.from(options.values());
    },
    [reps, reviewer, salesIds, userId],
  );

  useEffect(() => {
    const created: string[] = [];
    let cancelled = false;
    setPreviews({});
    const queue = [...photos];
    // Six at a time so the first rows appear while the rest of the page keeps loading.
    const workers = Array.from({ length: Math.min(6, queue.length) }, async () => {
      while (!cancelled) {
        const photo = queue.shift();
        if (!photo) {
          return;
        }
        const blob = await erpApi.galleryPhotoBlob(photo.id).catch(() => null);
        if (!blob || cancelled) {
          continue;
        }
        const url = URL.createObjectURL(blob);
        created.push(url);
        setPreviews((current) => ({ ...current, [photo.id]: url }));
      }
    });
    void Promise.all(workers);
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photosQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Draft }) => erpApi.updateGalleryPhoto(id, body),
    onSuccess: async (saved) => {
      setActionError(null);
      setDraft(draftFrom(saved));
      await queryClient.invalidateQueries({ queryKey: ['gallery-photos'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
    },
    onError: async (error) => {
      setActionError((await apiMessage(error)) ?? t('gallery.saveError', 'The photo could not be saved.'));
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (ids: number[]) => erpApi.downloadGalleryPhotos(ids),
    onSuccess: ({ blob, filename }) => {
      setActionError(null);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    },
    onError: async (error) => {
      setActionError((await apiMessage(error)) ?? t('gallery.loadError', 'Photos could not be loaded.'));
    },
  });

  const openIndex = photos.findIndex((photo) => photo.id === openId);
  const openPhoto = openIndex >= 0 ? photos[openIndex] : null;

  const show = useCallback((photo: ErpGalleryPhoto) => {
    setOpenId(photo.id);
    setDraft(draftFrom(photo));
    setZoom(1);
    setActionError(null);
  }, []);

  const step = useCallback(
    (delta: number) => {
      const next = photos[openIndex + delta];
      if (next) {
        show(next);
      }
    },
    [openIndex, photos, show],
  );

  useEffect(() => {
    if (openId == null) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        step(-1);
      } else if (event.key === 'ArrowRight') {
        step(1);
      } else if (event.key === 'Escape') {
        setOpenId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, step]);

  if (role && role !== 'supervisor' && role !== 'manager' && role !== 'admin' && role !== 'sales_rep') {
    return <Navigate to="/" replace />;
  }

  const toggle = (id: number) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const filterCount =
    salesIds.length + tags.length + ratings.length + phaseValues.length + (customer ? 1 : 0) + (day ? 1 : 0) + (reviewed === 'all' ? 0 : 1) + (q.trim() ? 1 : 0);

  const clearFilters = () => {
    setSalesIds([]);
    setCustomer(null);
    setDay('');
    setTags([]);
    setRatings([]);
    setPhaseValues([]);
    setReviewed('all');
    setQ('');
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-5">
      <PageHeader
        title={t('gallery.title', 'Photo gallery')}
        subtitle={t('gallery.subtitle', 'Visit photos from your sales team')}
        action={
          reviewer ? (
            <Button
              variant="primary"
              size="sm"
              disabled={selected.length === 0 || downloadMutation.isPending}
              onClick={() => downloadMutation.mutate(selected)}
            >
              <Download className="h-4 w-4" />
              {t('gallery.download', 'Download')}
              {selected.length > 0 ? ` (${selected.length})` : ''}
            </Button>
          ) : null
        }
      />

      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b border-[var(--color-border)] bg-[var(--color-bg)]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {reviewer ? (
            <MultiCombobox
              label={t('gallery.sales', 'Sales rep')}
              options={reps.map((rep) => ({ value: String(rep.id), label: rep.name }))}
              values={salesIds}
              onChange={setSalesIds}
              placeholder={t('filters.anySales', 'All sales reps')}
              searchPlaceholder={t('filters.searchSales', 'Search sales rep')}
              emptyText={t('filters.noResults', 'No results')}
              allLabel={t('filters.all', 'All')}
              clearLabel={t('filters.clear', 'Clear')}
              summary={(count) => t('filters.selected', '{{count}} selected', { count })}
            />
          ) : null}
          <AsyncCombobox
            label={t('gallery.customer', 'Customer')}
            queryKey={['gallery-customer-search', salesIds.join(',')]}
            fetchOptions={searchCustomers}
            value={customer?.value ?? null}
            selectedLabel={customer?.label ?? null}
            onChange={setCustomer}
            placeholder={t('gallery.all', 'All')}
            searchPlaceholder={t('filters.searchCustomer', 'Search customer')}
            emptyText={t('filters.noResults', 'No results')}
          />
          <Input label={t('gallery.day', 'Day')} type="date" value={day} onChange={(event) => setDay(event.target.value)} />
          <MultiCombobox
            label={t('gallery.tag', 'Tag')}
            options={tagOptions}
            values={tags}
            onChange={setTags}
            placeholder={t('filters.anyTag', 'All tags')}
            searchPlaceholder={t('gallery.tag', 'Tag')}
            emptyText={t('filters.noResults', 'No results')}
            allLabel={t('filters.all', 'All')}
            clearLabel={t('filters.clear', 'Clear')}
            summary={(count) => t('filters.selected', '{{count}} selected', { count })}
          />
          <MultiCombobox
            label={t('gallery.rating', 'Rating')}
            options={[1, 2, 3, 4, 5].map((score) => ({ value: String(score), label: '★'.repeat(score) }))}
            values={ratings}
            onChange={setRatings}
            placeholder={t('filters.anyRating', 'All ratings')}
            searchPlaceholder={t('gallery.rating', 'Rating')}
            emptyText={t('filters.noResults', 'No results')}
            allLabel={t('filters.all', 'All')}
            clearLabel={t('filters.clear', 'Clear')}
            summary={(count) => t('filters.selected', '{{count}} selected', { count })}
          />
          <MultiCombobox
            label={t('customers.photoRecent', 'Outlet photos')}
            options={phases.map((phase) => ({ value: phase.value, label: t(phase.key, phase.fallback) }))}
            values={phaseValues}
            onChange={setPhaseValues}
            placeholder={t('gallery.all', 'All')}
            searchPlaceholder={t('filters.search', 'Search')}
            emptyText={t('filters.noResults', 'No results')}
            allLabel={t('filters.all', 'All')}
            clearLabel={t('filters.clear', 'Clear')}
            summary={(count) => t('filters.selected', '{{count}} selected', { count })}
          />
          <Input
            label={t('gallery.signature', 'Signature')}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t('gallery.searchSignature', 'Search signature')}
          />
          <div className="flex items-end gap-2">
            <SegmentedControl
              className="flex-1"
              fullWidth
              size="sm"
              value={reviewed}
              onChange={setReviewed}
              options={[
                { value: 'all', label: t('gallery.all', 'All') },
                { value: '0', label: t('gallery.reviewedNo', 'Not reviewed') },
                { value: '1', label: t('gallery.reviewedYes', 'Reviewed') },
              ]}
            />
          </div>
        </div>
        {filterCount > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t('filters.selected', '{{count}} selected', { count: filterCount })} · {photos.length}
            </p>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t('filters.clear', 'Clear')}
            </Button>
          </div>
        ) : null}
      </div>

      {photosQuery.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : photosQuery.isError ? (
        <p className="text-sm font-medium text-[var(--color-warning)]">
          {t('gallery.loadError', 'Photos could not be loaded.')}
        </p>
      ) : photos.length === 0 ? (
        <EmptyState icon={Images} title={t('gallery.empty', 'No photos')} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => {
            const picked = selected.includes(photo.id);
            return (
              <article
                key={photo.id}
                className={cn(
                  'group overflow-hidden rounded-2xl border bg-[var(--color-surface)] transition-all duration-200',
                  picked ? 'border-[var(--color-primary)] shadow-[var(--shadow-md)]' : 'border-[var(--color-border)]',
                )}
              >
                <div className="relative">
                  <button type="button" className="block w-full text-left" onClick={() => show(photo)}>
                    <div className="flex h-36 items-center justify-center overflow-hidden bg-[var(--color-surface-hover)]">
                      {previews[photo.id] ? (
                        <img
                          src={previews[photo.id]}
                          alt={photo.signature || photo.customerName || ''}
                          className="h-full w-full object-cover"
                          style={{ transform: `rotate(${photo.rotation}deg)` }}
                        />
                      ) : (
                        <div className="h-full w-full animate-pulse" />
                      )}
                    </div>
                  </button>
                  {reviewer ? (
                    <button
                      type="button"
                      onClick={() => toggle(photo.id)}
                      aria-label={photo.customerName || String(photo.id)}
                      aria-pressed={picked}
                      className={cn(
                        'absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/80 shadow-sm transition-colors',
                        picked ? 'bg-[var(--color-primary)] text-white' : 'bg-black/35 text-white/80',
                      )}
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  ) : null}
                  {photo.reviewedAt ? (
                    <span className="absolute right-2 top-2 rounded-full bg-[var(--color-success)] px-2 py-0.5 text-[10px] font-semibold text-white">
                      {t('gallery.reviewedYes', 'Reviewed')}
                    </span>
                  ) : null}
                </div>
                <div className="p-2">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">{photo.customerName}</p>
                  <p className="flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                    <span className="min-w-0 truncate">
                      {photo.salesName} · {stamp(photo.takenAt)}
                    </span>
                    {photo.rating ? <StarRating value={photo.rating} /> : null}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {actionError && !openPhoto ? (
        <p className="text-sm font-medium text-[var(--color-warning)]">{actionError}</p>
      ) : null}

      {openPhoto && draft ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80 p-3 sm:p-6" role="dialog" aria-modal="true">
          <div className="mb-3 flex items-center justify-between gap-2 text-white">
            <p className="truncate text-sm font-medium">
              {openPhoto.salesName} · {openPhoto.customerName}
              <span className="ml-2 text-xs text-white/60">
                {openIndex + 1} / {photos.length}
              </span>
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={openIndex <= 0} onClick={() => step(-1)} aria-label={t('gallery.previous', 'Previous')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={openIndex < 0 || openIndex >= photos.length - 1} onClick={() => step(1)} aria-label={t('gallery.next', 'Next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom((value) => Math.max(1, value - 0.5))} aria-label={t('gallery.zoomOut', 'Zoom out')}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoom((value) => Math.min(3, value + 0.5))} aria-label={t('gallery.zoomIn', 'Zoom in')}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              {reviewer ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDraft((current) => current && { ...current, rotation: (current.rotation + 90) % 360 })}
                  aria-label={t('gallery.rotate', 'Rotate')}
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setOpenId(null)} aria-label={t('gallery.close', 'Close')}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
              {previews[openPhoto.id] ? (
                <img
                  src={previews[openPhoto.id]}
                  alt={draft.signature || openPhoto.customerName || ''}
                  className="max-h-full max-w-full object-contain transition-transform"
                  style={{ transform: `rotate(${draft.rotation}deg) scale(${zoom})` }}
                />
              ) : null}
            </div>
            <div className="w-full shrink-0 space-y-3 overflow-y-auto rounded-2xl bg-[var(--color-surface)] p-4 lg:w-80">
              <p className="text-sm text-[var(--color-text-secondary)]">
                {openPhoto.phase === 'before'
                  ? t('customers.photoBefore', 'Before visit')
                  : openPhoto.phase === 'survey'
                    ? t('customers.photoSurvey', 'Survey')
                    : openPhoto.phase === 'shelf'
                      ? t('customers.photoShelf', 'Shelf')
                      : t('customers.photoEnd', 'At the end')}
                {openPhoto.takenAt ? ` · ${formatVisitClock(openPhoto.takenAt)}` : ''}
                {openPhoto.tags.length > 0 ? ` · #${openPhoto.tags.join(' #')}` : ''}
              </p>
              {openPhoto.comment ? <p className="text-sm text-[var(--color-text)]">{openPhoto.comment}</p> : null}
              {reviewer ? (
                <>
              <Input
                label={t('gallery.signature', 'Signature')}
                value={draft.signature}
                onChange={(event) => {
                  const signature = event.target.value;
                  setDraft((current) => (current ? { ...current, signature } : current));
                }}
                maxLength={300}
              />
              <Input
                label={t('gallery.comment', 'Comment')}
                value={draft.reviewComment}
                onChange={(event) => {
                  const reviewComment = event.target.value;
                  setDraft((current) => (current ? { ...current, reviewComment } : current));
                }}
                maxLength={300}
              />
              <div>
                <p className="mb-1 text-sm font-medium text-[var(--color-text)]">{t('gallery.rating', 'Rating')}</p>
                <StarRating
                  value={draft.rating}
                  size="md"
                  onChange={(score) =>
                    setDraft((current) =>
                      current ? { ...current, rating: current.rating === score ? null : score } : current,
                    )
                  }
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={draft.reviewed}
                  onChange={(event) => {
                    const next = event.target.checked;
                    setDraft((current) => (current ? { ...current, reviewed: next } : current));
                  }}
                />
                {t('gallery.reviewed', 'Reviewed')}
              </label>
                </>
              ) : draft.rating != null ? (
                <StarRating value={draft.rating} />
              ) : null}
              {openPhoto.reviewedAt && openPhoto.reviewedByName ? (
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {t('gallery.reviewedBy', 'Marked by {{name}} · {{time}}', {
                    name: openPhoto.reviewedByName,
                    time: stamp(openPhoto.reviewedAt),
                  })}
                </p>
              ) : null}
              {reviewer ? (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/tasks?photoId=${openPhoto.id}&customerId=${encodeURIComponent(openPhoto.customerId)}&salesUserId=${openPhoto.salesUserId}`,
                      )
                    }
                  >
                    {t('gallery.createTask', 'Task')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate({ id: openPhoto.id, body: draft })}
                  >
                    {t('gallery.save', 'Save')}
                  </Button>
                </div>
              ) : null}
              {actionError ? <p className="text-sm font-medium text-[var(--color-warning)]">{actionError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
