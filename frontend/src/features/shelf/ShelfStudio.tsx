import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Camera, ImagePlus, X } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { AsyncCombobox, Button, Input, ProgressRing, type ComboboxOption } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { recognize } from './recognize';
import { submitShelf } from './outbox';
import { auditLines, boxTone, scoreShelf, type PlanSlot, type ShelfMark } from './score';

function apiMessage(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim() !== '') {
      return message;
    }
  }
  return null;
}

function markKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `box-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function blankMark(x: number, y: number): ShelfMark {
  const w = 0.2;
  const h = 0.14;
  return {
    key: markKey(),
    itemId: null,
    itemName: '',
    own: true,
    shelfNo: 1,
    facings: 1,
    readPrice: null,
    catalogPrice: null,
    box: {
      x: Math.min(1 - w, Math.max(0, x - w / 2)),
      y: Math.min(1 - h, Math.max(0, y - h / 2)),
      w,
      h,
    },
  };
}

const toneClass = {
  ok: 'border-emerald-400 bg-emerald-400/15 text-emerald-50',
  bad: 'border-red-500 bg-red-500/15 text-red-50',
  open: 'border-white/80 bg-white/10 text-white',
};

export function ShelfStudio({
  customerId,
  onClose,
  onSaved,
}: {
  customerId: string;
  onClose: () => void;
  onSaved: (queued: boolean) => void;
}) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const prices = useRef<Record<string, number | null>>({});
  const [phase, setPhase] = useState<'live' | 'review'>('live');
  const [cameraError, setCameraError] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [frame, setFrame] = useState({ w: 4, h: 3 });
  const [marks, setMarks] = useState<ShelfMark[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [manual, setManual] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planQuery = useQuery({
    queryKey: ['erp-planogram', customerId],
    queryFn: () => erpApi.planograms({ customerId }),
    retry: false,
  });
  const plan: PlanSlot[] = useMemo(
    () =>
      (planQuery.data ?? []).map((row) => ({
        itemId: row.itemId,
        itemName: row.itemName,
        shelfNo: row.shelfNo,
        facings: row.facings,
        targetPrice: row.targetPrice,
      })),
    [planQuery.data],
  );
  const score = useMemo(() => scoreShelf(marks, plan), [marks, plan]);
  const current = marks.find((mark) => mark.key === selected) ?? null;
  const lines = useMemo(() => auditLines(marks, plan), [marks, plan]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'live') {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled && !streamRef.current) {
        setCameraError(true);
      }
    }, 8000);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setCameraError(false);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        if (!cancelled) {
          setCameraError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stopCamera();
    };
  }, [phase, stopCamera]);

  useEffect(() => {
    return () => {
      if (photoUrl) {
        URL.revokeObjectURL(photoUrl);
      }
    };
  }, [photoUrl]);

  const openReview = async (blob: Blob, width: number, height: number) => {
    stopCamera();
    if (photoUrl) {
      URL.revokeObjectURL(photoUrl);
    }
    setPhotoBlob(blob);
    setPhotoUrl(URL.createObjectURL(blob));
    setFrame({ w: Math.max(1, width), h: Math.max(1, height) });
    const found = await recognize(blob);
    const next = found.map((detection) => ({
      key: markKey(),
      itemId: detection.itemId,
      itemName: plan.find((slot) => slot.itemId === detection.itemId)?.itemName ?? detection.itemId,
      own: true,
      shelfNo: detection.shelfNo || 1,
      facings: 1,
      readPrice: detection.price,
      catalogPrice: null,
      box: detection.box,
    }));
    setMarks(next);
    setManual(next.length === 0);
    setSelected(next[0]?.key ?? null);
    setPhase('review');
  };

  const capture = async () => {
    const video = videoRef.current;
    const width = video?.videoWidth || 0;
    const height = video?.videoHeight || 0;
    if (!video || width < 2 || height < 2) {
      setCameraError(true);
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(video, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
    if (!blob) {
      setCameraError(true);
      return;
    }
    await openReview(blob, width, height);
  };

  const onFile = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file) {
      return;
    }
    const bitmap = await createImageBitmap(file).catch(() => null);
    await openReview(file, bitmap?.width || 4, bitmap?.height || 3);
    bitmap?.close();
  };

  const markWithoutPhoto = () => {
    stopCamera();
    setPhotoBlob(null);
    setPhotoUrl(null);
    setFrame({ w: 4, h: 3 });
    setMarks([]);
    setManual(true);
    setSelected(null);
    setPhase('review');
  };

  const addBox = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) {
      return;
    }
    const mark = blankMark((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
    setMarks((currentMarks) => [...currentMarks, mark]);
    setSelected(mark.key);
  };

  const patch = (key: string, next: Partial<ShelfMark>) => {
    setMarks((currentMarks) => currentMarks.map((mark) => (mark.key === key ? { ...mark, ...next } : mark)));
  };

  const searchItems = useCallback(
    async (search: string): Promise<ComboboxOption[]> => {
      const page = await erpApi
        .items({ customerId, search: search || undefined, limit: 25 })
        .catch(() => erpApi.items({ search: search || undefined, limit: 25 }));
      for (const item of page.items) {
        prices.current[item.itemId] = item.unitPrice == null || item.unitPrice === '' ? null : Number(item.unitPrice);
      }
      return page.items.map((item) => ({
        value: item.itemId,
        label: item.name,
        hint: [item.prodCode ?? item.itemId, item.unitPrice ? `${item.unitPrice} ₾` : null].filter(Boolean).join(' · '),
      }));
    },
    [customerId],
  );

  const save = async () => {
    if (lines.length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await submitShelf({ customerId, photo: photoBlob, lines });
      onSaved(result === 'queued');
    } catch (reason) {
      setError(apiMessage(reason) ?? t('customers.loadError', 'კლიენტები ვერ ჩაიტვირთა.'));
      setSaving(false);
    }
  };

  const rowText = (row: (typeof score.rows)[number]) => {
    if (row.kind === 'move') {
      return t('shelf.move', { from: row.fromShelf, to: row.toShelf, defaultValue: 'Move shelf {{from}} to shelf {{to}}' });
    }
    if (row.kind === 'missing') {
      return t('shelf.missing', 'Missing');
    }
    if (row.kind === 'price') {
      return t('shelf.priceMismatch', 'Price does not match');
    }
    if (row.kind === 'low') {
      return t('shelf.low', 'Low');
    }
    return t('shelf.present', 'Present');
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{t('shelf.open', 'Shelf studio')}</p>
          <p className="truncate text-xs text-white/70">
            {manual ? t('shelf.manual', 'The model is not loaded yet. Place each box yourself.') : t('shelf.title', 'Shelf audit')}
          </p>
        </div>
        <button
          type="button"
          aria-label={t('gallery.close', 'Close')}
          onClick={onClose}
          className="rounded-full bg-white/10 p-2 hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {phase === 'live' ? (
        <div className="relative min-h-0 flex-1">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-6 rounded-3xl border border-white/30" />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-8 pt-16">
            {cameraError ? (
              <p className="text-sm text-white/80">{t('shelf.cameraOff', 'The camera did not open.')}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void capture()}
              aria-label={t('shelf.capture', 'Capture')}
              className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/10"
            >
              <span className="h-14 w-14 rounded-full bg-white" />
            </button>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" className="border-white/30 bg-transparent text-white" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
                {t('shelf.fromFile', 'From a file')}
              </Button>
              <Button variant="outline" size="sm" className="border-white/30 bg-transparent text-white" onClick={markWithoutPhoto}>
                {t('shelf.withoutPhoto', 'Mark without a photo')}
              </Button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void onFile(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative flex min-h-[42vh] flex-1 items-center justify-center bg-black lg:min-h-0">
            <div
              className="relative max-h-full max-w-full cursor-crosshair"
              style={{ aspectRatio: `${frame.w} / ${frame.h}`, height: '100%' }}
              onClick={addBox}
            >
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-fill" />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_center,#334155,#0f172a)]" />
              )}
              {marks.map((mark) => {
                const tone = boxTone(mark, plan);
                const active = mark.key === selected;
                return (
                  <button
                    key={mark.key}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelected(mark.key);
                    }}
                    className={cn(
                      'absolute rounded-md border-2 text-left',
                      toneClass[tone],
                      active && 'ring-2 ring-white',
                    )}
                    style={{
                      left: `${mark.box.x * 100}%`,
                      top: `${mark.box.y * 100}%`,
                      width: `${mark.box.w * 100}%`,
                      height: `${mark.box.h * 100}%`,
                    }}
                  >
                    <span className="block truncate px-1 text-[10px] font-semibold leading-4">
                      {mark.own ? mark.itemName || t('shelf.empty', 'Mark a product') : t('shelf.competitor', 'Competitor')}
                    </span>
                  </button>
                );
              })}
            </div>
            {marks.length === 0 ? (
              <p className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-sm text-white/80">
                {t('shelf.tap', 'Tap the photo and mark a product')}
              </p>
            ) : null}
          </div>

          <aside className="flex max-h-[58vh] w-full flex-col gap-4 overflow-y-auto bg-[var(--color-surface)] px-4 py-4 text-[var(--color-text)] lg:max-h-none lg:w-[380px]">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ['assessment', score.assessment, 'primary'],
                  ['planogram', score.planogram, 'success'],
                  ['share', score.share, 'secondary'],
                ] as const
              ).map(([key, value, tone]) => (
                <div key={key} className="flex flex-col items-center gap-1">
                  <ProgressRing current={value} total={100} size={76} thickness={7} tone={tone} />
                  <span className="text-center text-[11px] font-medium text-[var(--color-text-secondary)]">
                    {t(`shelf.${key}`, key)}
                  </span>
                </div>
              ))}
            </div>

            {plan.length === 0 ? (
              <p className="text-xs text-[var(--color-text-secondary)]">{t('shelf.emptyPlan', 'No planogram yet')}</p>
            ) : null}

            <ul className="space-y-1.5">
              {score.rows.map((row) => (
                <li key={row.key} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{row.name}</span>
                  <span className={cn('shrink-0 text-xs font-semibold', row.tone === 'bad' ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]')}>
                    {rowText(row)}
                  </span>
                </li>
              ))}
            </ul>

            {current ? (
              <div className="space-y-3 rounded-2xl border border-[var(--color-border)] p-3">
                <AsyncCombobox
                  label={t('shelf.search', 'Search product')}
                  queryKey={['shelf-studio-item', customerId, current.key]}
                  fetchOptions={searchItems}
                  value={current.itemId}
                  selectedLabel={current.itemName || null}
                  onChange={(option) => {
                    if (!option) {
                      patch(current.key, { itemId: null, itemName: '', catalogPrice: null, own: true });
                      return;
                    }
                    patch(current.key, {
                      itemId: option.value,
                      itemName: option.label,
                      catalogPrice: prices.current[option.value] ?? null,
                      own: true,
                    });
                  }}
                  placeholder={t('shelf.empty', 'Mark a product')}
                  searchPlaceholder={t('filters.searchProduct', 'Search product')}
                  emptyText={t('filters.noResults', 'No results')}
                  disabled={!current.own}
                />
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((shelfNo) => (
                    <button
                      key={shelfNo}
                      type="button"
                      onClick={() => patch(current.key, { shelfNo })}
                      className={cn(
                        'h-8 min-w-8 rounded-full px-2 text-xs font-semibold',
                        current.shelfNo === shelfNo
                          ? 'bg-[var(--color-primary)] text-[var(--color-primary-fg)]'
                          : 'bg-[var(--color-surface-hover)] text-[var(--color-text)]',
                      )}
                    >
                      {shelfNo}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label={t('shelf.facings', 'Facings')}
                    type="number"
                    min={1}
                    max={40}
                    value={String(current.facings)}
                    onChange={(event) => patch(current.key, { facings: Math.max(1, Number(event.target.value) || 1) })}
                  />
                  <Input
                    label={t('shelf.tagPrice', 'Tag price')}
                    type="number"
                    min={0}
                    step="0.01"
                    value={current.readPrice == null ? '' : String(current.readPrice)}
                    onChange={(event) => {
                      const text = event.target.value.trim();
                      patch(current.key, { readPrice: text === '' ? null : Number(text) });
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={current.own ? 'outline' : 'primary'}
                    size="sm"
                    onClick={() =>
                      patch(current.key, {
                        own: !current.own,
                        itemId: null,
                        itemName: current.own ? t('shelf.competitor', 'Competitor') : '',
                        catalogPrice: null,
                      })
                    }
                  >
                    {t('shelf.competitor', 'Competitor')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMarks((currentMarks) => currentMarks.filter((mark) => mark.key !== current.key));
                      setSelected(null);
                    }}
                  >
                    {t('common.delete', 'Delete')}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-secondary)]">{t('shelf.tap', 'Tap the photo and mark a product')}</p>
            )}

            {error ? <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p> : null}
            <div className="mt-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPhase('live')}>
                <Camera className="h-4 w-4" />
                {t('shelf.retake', 'Retake')}
              </Button>
              <Button variant="primary" size="sm" className="flex-1" disabled={saving || lines.length === 0} onClick={() => void save()}>
                {t('shelf.save', 'Save audit')}
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
