import { useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Camera, Check, ClipboardList, MapPin, MessageSquareQuote, PackageSearch } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { formatVisitClock } from '@/lib/utils/format';
import { Button, Card, Input, SegmentedControl, StarRating } from '@/components/ui';
import { ShelfStudio } from '@/features/shelf/ShelfStudio';
import { cn } from '@/lib/utils/cn';
import type { ErpVisitPhoto } from '@/types';

async function readPosition(): Promise<{ latitude: string; longitude: string } | null> {
  if (!navigator.geolocation) {
    return null;
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 },
    );
  });
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

function isTodayInTbilisi(iso: string | null): boolean {
  if (!iso) {
    return false;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const format = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return format.format(date) === format.format(new Date());
}

function phaseLabel(phase: ErpVisitPhoto['phase'], t: (key: string, fallback: string) => string): string {
  if (phase === 'before') {
    return t('customers.photoBefore', 'Before visit');
  }
  if (phase === 'survey') {
    return t('customers.photoSurvey', 'Survey');
  }
  if (phase === 'shelf') {
    return t('customers.photoShelf', 'Shelf');
  }
  return t('customers.photoEnd', 'At the end');
}

function Stage({
  step,
  title,
  hint,
  icon,
  done,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  icon: ReactNode;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold',
            done
              ? 'bg-[var(--color-success)] text-white'
              : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]',
          )}
        >
          {done ? <Check className="h-4 w-4" /> : step}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-semibold text-[var(--color-text)]">
            <span className="text-[var(--color-text-secondary)]">{icon}</span>
            {title}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{hint}</p> : null}
          <div className="mt-3 space-y-3">{children}</div>
        </div>
      </div>
    </Card>
  );
}

export function VisitActions({ customerId }: { customerId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const beforeInput = useRef<HTMLInputElement>(null);
  const endInput = useRef<HTMLInputElement>(null);
  const surveyInput = useRef<HTMLInputElement>(null);
  const shelfInput = useRef<HTMLInputElement>(null);
  const [gpsMissing, setGpsMissing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tags, setTags] = useState('');
  const [comment, setComment] = useState('');
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [answers, setAnswers] = useState({
    shelfStocked: true,
    priceVisible: true,
    promoPresent: false,
    competitorSeen: false,
  });
  const [surveySaved, setSurveySaved] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [shelfQueued, setShelfQueued] = useState(false);

  const visitsQuery = useQuery({
    queryKey: ['erp-visits', { customerId }],
    queryFn: () => erpApi.visits({ customerId }),
    retry: false,
  });

  const photosQuery = useQuery({
    queryKey: ['erp-visit-photos', customerId],
    queryFn: () => erpApi.visitPhotos(customerId),
    retry: false,
  });

  const tasksQuery = useQuery({
    queryKey: ['erp-tasks', 'visit', customerId],
    queryFn: () => erpApi.tasks(),
    retry: false,
  });

  const coachingQuery = useQuery({
    queryKey: ['erp-coaching', customerId],
    queryFn: () => erpApi.visitCoaching(customerId),
    retry: false,
  });

  const shelfQuery = useQuery({
    queryKey: ['erp-shelf', customerId],
    queryFn: () => erpApi.shelfAudits(customerId),
    retry: false,
  });

  useEffect(() => {
    const created: string[] = [];
    let cancelled = false;
    const queue = [...(photosQuery.data ?? [])];
    setPreviews({});
    (async () => {
      while (!cancelled) {
        const photo = queue.shift();
        if (!photo) {
          return;
        }
        const blob = await erpApi.visitPhotoBlob(photo.id).catch(() => null);
        if (!blob || cancelled) {
          continue;
        }
        const url = URL.createObjectURL(blob);
        created.push(url);
        setPreviews((current) => ({ ...current, [photo.id]: url }));
      }
    })();
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photosQuery.data]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['erp-visits'] });
    await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
  };

  const startMutation = useMutation({
    mutationFn: async () => {
      const position = await readPosition();
      setGpsMissing(position == null);
      return erpApi.startVisit({ customerId, ...position });
    },
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => {
      setActionError(apiMessage(error) ?? t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.'));
    },
  });

  const finishMutation = useMutation({
    mutationFn: async (outcome: 'arrived' | 'missed') => {
      const open = (visitsQuery.data ?? []).find((row) => row.status === 'open' && row.customerId === customerId);
      if (!open) {
        throw new Error('missing');
      }
      const position = await readPosition();
      setGpsMissing(position == null);
      return erpApi.finishVisit(open.id, { outcome, ...position });
    },
    onSuccess: async () => {
      setActionError(null);
      await refresh();
    },
    onError: (error) => {
      setActionError(apiMessage(error) ?? t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.'));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ phase, file }: { phase: ErpVisitPhoto['phase']; file: File }) => {
      const position = await readPosition();
      setGpsMissing(position == null);
      return erpApi.uploadVisitPhoto({
        customerId,
        phase,
        photo: file,
        comment,
        tags,
        ...position,
      });
    },
    onSuccess: async () => {
      setActionError(null);
      setComment('');
      await queryClient.invalidateQueries({ queryKey: ['erp-visit-photos', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
    },
    onError: (error) => {
      setActionError(apiMessage(error) ?? t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.'));
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: number) => erpApi.updateTask(id, 'complete'),
    onSuccess: async () => {
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ['erp-tasks'] });
      await queryClient.invalidateQueries({ queryKey: ['erp-dashboard'] });
    },
    onError: (error) => {
      setActionError(apiMessage(error) ?? t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.'));
    },
  });

  const surveyMutation = useMutation({
    mutationFn: (visitId: number) => erpApi.saveVisitSurvey({ visitId, ...answers }),
    onSuccess: () => {
      setActionError(null);
      setSurveySaved(true);
    },
    onError: (error) => {
      setActionError(apiMessage(error) ?? t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.'));
    },
  });

  const rows = visitsQuery.data ?? [];
  const photos = photosQuery.data ?? [];
  const openHere = rows.find((row) => row.status === 'open' && row.customerId === customerId);
  const latestFinished = rows.find((row) => row.status === 'arrived' || row.status === 'missed');
  const canEnd = Boolean(openHere || (latestFinished && isTodayInTbilisi(latestFinished.startedAt)));
  const busy = startMutation.isPending || finishMutation.isPending || uploadMutation.isPending;
  const openTasks = (tasksQuery.data ?? []).filter(
    (task) => task.status === 'open' && (task.customerId === customerId || !task.customerId),
  );
  const coaching = coachingQuery.data ?? [];
  const latestShelf = shelfQuery.data?.[0];
  const surveyVisit = openHere ?? (latestFinished && isTodayInTbilisi(latestFinished.startedAt) ? latestFinished : null);
  const started = formatVisitClock(openHere?.startedAt ?? null);
  const todayPhotos = photos.filter((photo) => isTodayInTbilisi(photo.takenAt));

  const onFile = (phase: ErpVisitPhoto['phase'], list: FileList | null) => {
    const file = list?.[0];
    if (!file) {
      return;
    }
    uploadMutation.mutate({ phase, file });
  };

  const cameraButton = (
    phase: ErpVisitPhoto['phase'],
    label: string,
    ref: React.RefObject<HTMLInputElement | null>,
    disabled: boolean,
  ) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => ref.current?.click()}
      className={cn(
        'flex h-20 flex-col items-center justify-center gap-1 rounded-2xl border text-xs font-semibold transition-all duration-150',
        todayPhotos.some((photo) => photo.phase === phase)
          ? 'border-[var(--color-success)]/50 bg-[var(--color-success)]/8 text-[var(--color-success)]'
          : 'border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)] hover:bg-[var(--color-surface-hover)]',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <Camera className="h-5 w-5" />
      {label}
    </button>
  );

  return (
    <div className="space-y-3 border-b border-[var(--color-border)] bg-[var(--color-surface-inset)] px-4 py-4 sm:px-5">
      <Stage
        step={1}
        title={t('customers.stageVisit', 'Visit')}
        hint={
          openHere
            ? `${t('customers.visitInProgress', 'In progress')}${started ? ` · ${t('customers.visitStartedAt', 'Started {{time}}', { time: started })}` : ''}`
            : latestFinished
              ? `${latestFinished.status === 'arrived' ? t('customers.arrived', 'Arrived') : t('customers.missed', 'Could not enter')}${latestFinished.endedAt ? ` · ${formatVisitClock(latestFinished.endedAt)}` : ''}`
              : t('customers.startVisit', 'Start visit')
        }
        icon={<MapPin className="h-4 w-4" />}
        done={Boolean(latestFinished && !openHere && isTodayInTbilisi(latestFinished.startedAt))}
      >
        {openHere ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="primary" size="lg" disabled={busy} onClick={() => finishMutation.mutate('arrived')}>
              <MapPin className="h-4 w-4" />
              {t('customers.arrived', 'Arrived')}
            </Button>
            <Button variant="outline" size="lg" disabled={busy} onClick={() => finishMutation.mutate('missed')}>
              {t('customers.missed', 'Could not enter')}
            </Button>
          </div>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy || visitsQuery.isLoading}
            onClick={() => startMutation.mutate()}
          >
            {t('customers.startVisit', 'Start visit')}
          </Button>
        )}
        {coaching.length > 0 ? (
          <div className="space-y-1 rounded-xl bg-[var(--color-surface-hover)] p-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              <MessageSquareQuote className="h-3.5 w-3.5" />
              {t('survey.coaching', 'Coaching')}
            </p>
            {coaching.slice(0, 3).map((row) => (
              <p key={row.id} className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-text)]">
                <StarRating value={row.rating} />
                <span>
                  {row.supervisorName ? row.supervisorName : ''}
                  {row.supervisorName && row.note ? ' · ' : ''}
                  {row.note ?? ''}
                </span>
              </p>
            ))}
          </div>
        ) : null}
      </Stage>

      <Stage
        step={2}
        title={t('customers.stagePhotos', 'Photos')}
        hint={t('customers.photoRecent', 'Outlet photos')}
        icon={<Camera className="h-4 w-4" />}
        done={todayPhotos.length > 0}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder={t('customers.photoTag', '#tag')}
          />
          <Input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t('customers.photoComment', 'Comment')}
            maxLength={300}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {cameraButton('before', t('customers.photoBefore', 'Before visit'), beforeInput, busy)}
          {cameraButton('survey', t('customers.photoSurvey', 'Survey'), surveyInput, busy || !canEnd)}
          {cameraButton('shelf', t('customers.photoShelf', 'Shelf'), shelfInput, busy || !canEnd)}
          {cameraButton('end', t('customers.photoEnd', 'At the end'), endInput, busy || !canEnd)}
        </div>
        {photos.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((photo) => (
              <figure key={photo.id} className="w-24 shrink-0">
                <div className="relative">
                  {previews[photo.id] ? (
                    <img
                      src={previews[photo.id]}
                      alt={photo.comment || photo.customerName || ''}
                      className="h-24 w-24 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-24 w-24 animate-pulse rounded-xl bg-[var(--color-surface-hover)]" />
                  )}
                  <span className="absolute left-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {phaseLabel(photo.phase, t)}
                  </span>
                </div>
                <figcaption className="mt-1 truncate text-[11px] text-[var(--color-text-secondary)]">
                  {photo.takenAt ? formatVisitClock(photo.takenAt) : ''}
                  {photo.tags.length > 0 ? ` · #${photo.tags.join(' #')}` : ''}
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
        {(
          [
            ['before', beforeInput],
            ['end', endInput],
            ['survey', surveyInput],
            ['shelf', shelfInput],
          ] as const
        ).map(([phase, ref]) => (
          <input
            key={phase}
            ref={ref}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              onFile(phase, event.target.files);
              event.target.value = '';
            }}
          />
        ))}
      </Stage>

      <Stage
        step={3}
        title={t('survey.title', 'Survey')}
        hint={surveyVisit ? undefined : t('customers.startVisit', 'Start visit')}
        icon={<ClipboardList className="h-4 w-4" />}
        done={surveySaved}
      >
        {(
          [
            ['shelfStocked', 'survey.shelfStocked', 'Shelf is stocked'],
            ['priceVisible', 'survey.priceVisible', 'Price is visible'],
            ['promoPresent', 'survey.promoPresent', 'Promo is in place'],
            ['competitorSeen', 'survey.competitorSeen', 'Competitor noticed'],
          ] as const
        ).map(([key, label, fallback]) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-sm text-[var(--color-text)]">{t(label, fallback)}</span>
            <SegmentedControl
              size="sm"
              value={answers[key] ? 'yes' : 'no'}
              onChange={(value) => {
                setSurveySaved(false);
                setAnswers((current) => ({ ...current, [key]: value === 'yes' }));
              }}
              options={[
                { value: 'yes', label: t('survey.yes', 'Yes') },
                { value: 'no', label: t('survey.no', 'No') },
              ]}
            />
          </div>
        ))}
        <Button
          variant="primary"
          size="sm"
          fullWidth
          disabled={surveyMutation.isPending || !surveyVisit}
          onClick={() => surveyVisit && surveyMutation.mutate(surveyVisit.id)}
        >
          {t('survey.save', 'Save survey')}
        </Button>
      </Stage>

      <Stage
        step={4}
        title={t('shelf.title', 'Shelf audit')}
        icon={<PackageSearch className="h-4 w-4" />}
        done={Boolean(latestShelf && isTodayInTbilisi(latestShelf.createdAt))}
      >
        <Button variant="primary" size="sm" fullWidth onClick={() => setStudioOpen(true)}>
          {t('shelf.open', 'Shelf studio')}
        </Button>
        {shelfQueued ? (
          <p className="text-xs font-medium text-[var(--color-warning)]">{t('shelf.queued', 'Saved offline')}</p>
        ) : null}
        {latestShelf ? (
          <p className="text-xs text-[var(--color-text-secondary)]">
            {t('shelf.latest', 'Latest audit')}
            {latestShelf.lines
              .map((line) => ` · ${line.itemName || line.itemId} ${t(`shelf.${line.status}`, line.status)}`)
              .join('')}
          </p>
        ) : null}
      </Stage>

      <Stage
        step={5}
        title={t('tasks.title', 'Tasks')}
        hint={openTasks.length === 0 ? t('tasks.empty', 'No tasks') : undefined}
        icon={<ClipboardList className="h-4 w-4" />}
        done={openTasks.length === 0}
      >
        {openTasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-text)]">{task.title}</p>
              {task.note ? <p className="truncate text-xs text-[var(--color-text-secondary)]">{task.note}</p> : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate(task.id)}
            >
              {t('tasks.complete', 'Done')}
            </Button>
          </div>
        ))}
      </Stage>

      {gpsMissing ? (
        <p className="text-sm font-medium text-[var(--color-warning)]">
          {t('customers.locationFailed', 'Location could not be found')}
        </p>
      ) : null}
      {actionError ? <p className="text-sm font-medium text-[var(--color-warning)]">{actionError}</p> : null}
      {studioOpen ? (
        <ShelfStudio
          customerId={customerId}
          onClose={() => setStudioOpen(false)}
          onSaved={async (queued) => {
            setShelfQueued(queued);
            setStudioOpen(false);
            await queryClient.invalidateQueries({ queryKey: ['erp-shelf', customerId] });
            await queryClient.invalidateQueries({ queryKey: ['erp-visit-photos', customerId] });
          }}
        />
      ) : null}
    </div>
  );
}
