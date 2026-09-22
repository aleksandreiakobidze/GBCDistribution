import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, Download, FileWarning } from 'lucide-react';
import { erpApi } from '@/lib/api/erp.api';
import { ErpErrorAlert } from '@/components/shared';
import { Spinner } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { formatDateTime } from '@/lib/utils/format';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const A4_RATIO = 1 / Math.SQRT2;
// Coarse steps keep re-rendering off the resize hot path while staying sharp.
const WIDTH_STEP = 96;
const MAX_PIXEL_RATIO = 2;

function CatalogPage({
  doc,
  pageNumber,
  slotWidth,
  shouldRender,
  fallbackRatio,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  slotWidth: number;
  shouldRender: boolean;
  fallbackRatio: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ownRatio, setOwnRatio] = useState<number | null>(null);
  const [painted, setPainted] = useState(false);
  const ratio = ownRatio ?? fallbackRatio;

  useEffect(() => {
    if (!shouldRender || slotWidth <= 0) return;

    let cancelled = false;
    let task: RenderTask | null = null;

    void (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;

      const base = page.getViewport({ scale: 1 });
      setOwnRatio(base.width / base.height);

      const canvas = canvasRef.current;
      if (!canvas) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
      const viewport = page.getViewport({ scale: (slotWidth * pixelRatio) / base.width });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      task = page.render({ canvas, viewport });
      try {
        await task.promise;
      } catch {
        return;
      }
      if (!cancelled) setPainted(true);
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, shouldRender, slotWidth]);

  return (
    <div className="w-full shrink-0 snap-center px-0.5">
      <div
        className="relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-[var(--color-border)]"
        style={{ aspectRatio: ratio }}
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        {!painted && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PriceListCatalog() {
  const { t } = useTranslation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  // Page 1 sets the placeholder shape so unrendered slots do not stretch the row.
  const [fallbackRatio, setFallbackRatio] = useState(A4_RATIO);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [current, setCurrent] = useState(0);
  const [slotWidth, setSlotWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const meta = await erpApi.priceList();
        if (cancelled) return;
        if (!meta.available) {
          setUnavailable(true);
          return;
        }
        setUpdatedAt(meta.updatedAt);

        const buffer = await erpApi.priceListFile();
        if (cancelled) return;

        const objectUrl = URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' }));
        // pdf.js takes ownership of the buffer it parses, so hand it a copy.
        const loaded = await pdfjs.getDocument({ data: new Uint8Array(buffer.slice(0)) }).promise;
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          void loaded.destroy();
          return;
        }

        const firstPage = await loaded.getPage(1).catch(() => null);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          void loaded.destroy();
          return;
        }
        if (firstPage) {
          const base = firstPage.getViewport({ scale: 1 });
          setFallbackRatio(base.width / base.height);
        }

        setFileUrl(objectUrl);
        setDoc(loaded);
      } catch (err) {
        if (!cancelled) setError(err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fileUrl) return;
    return () => URL.revokeObjectURL(fileUrl);
  }, [fileUrl]);

  useEffect(() => {
    if (!doc) return;
    return () => {
      void doc.destroy();
    };
  }, [doc]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const observer = new ResizeObserver(() => {
      const width = scroller.clientWidth;
      if (width > 0) setSlotWidth(Math.ceil(width / WIDTH_STEP) * WIDTH_STEP);
    });
    observer.observe(scroller);

    return () => observer.disconnect();
  }, [doc]);

  const goTo = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller || !doc) return;
    const clamped = Math.max(0, Math.min(index, doc.numPages - 1));
    scroller.scrollTo({ left: clamped * scroller.clientWidth, behavior: 'smooth' });
  }, [doc]);

  function handleScroll() {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    setCurrent(Math.round(scroller.scrollLeft / scroller.clientWidth));
  }

  if (unavailable) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-10 text-center">
        <FileWarning className="h-6 w-6 text-[var(--color-text-tertiary)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t('products.priceListUnavailable', 'ფასების კატალოგი ამჟამად მიუწვდომელია.')}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <ErpErrorAlert
        error={error}
        fallback={t('products.priceListUnavailable', 'ფასების კატალოგი ამჟამად მიუწვდომელია.')}
      />
    );
  }

  if (!doc) {
    return (
      <div className="flex flex-col items-center gap-2 py-10">
        <Spinner size="sm" />
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t('products.priceListLoading', 'კატალოგი იტვირთება...')}
        </p>
      </div>
    );
  }

  const pages = Array.from({ length: doc.numPages }, (_, index) => index);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-text-secondary)]">
          {updatedAt
            ? t('products.priceListUpdated', 'განახლდა: {{date}}', {
                date: formatDateTime(updatedAt),
              })
            : null}
        </p>
        {fileUrl && (
          <a
            href={fileUrl}
            download="price-list.pdf"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-primary)]"
          >
            <Download className="h-3.5 w-3.5" />
            {t('products.priceListDownload', 'PDF ჩამოტვირთვა')}
          </a>
        )}
      </div>

      <div className="relative">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((index) => (
            <CatalogPage
              key={index}
              doc={doc}
              pageNumber={index + 1}
              slotWidth={slotWidth}
              shouldRender={Math.abs(index - current) <= 1}
              fallbackRatio={fallbackRatio}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          aria-label={t('products.priceListPrev', 'წინა გვერდი')}
          className={cn(
            'absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-surface)]/90 shadow-md ring-1 ring-[var(--color-border)] transition-opacity sm:flex',
            current === 0 ? 'pointer-events-none opacity-0' : 'hover:bg-[var(--color-surface-hover)]',
          )}
        >
          <ChevronLeft className="h-5 w-5 text-[var(--color-text)]" />
        </button>
        <button
          type="button"
          onClick={() => goTo(current + 1)}
          disabled={current >= doc.numPages - 1}
          aria-label={t('products.priceListNext', 'შემდეგი გვერდი')}
          className={cn(
            'absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-surface)]/90 shadow-md ring-1 ring-[var(--color-border)] transition-opacity sm:flex',
            current >= doc.numPages - 1
              ? 'pointer-events-none opacity-0'
              : 'hover:bg-[var(--color-surface-hover)]',
          )}
        >
          <ChevronRight className="h-5 w-5 text-[var(--color-text)]" />
        </button>
      </div>

      <p className="text-center text-xs font-medium text-[var(--color-text-secondary)]">
        {t('products.pageOf', '{{current}} / {{total}}', {
          current: current + 1,
          total: doc.numPages,
        })}
      </p>
    </div>
  );
}
