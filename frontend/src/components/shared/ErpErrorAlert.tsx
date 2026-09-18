import { AlertCircle } from 'lucide-react';
import { erpErrorFromUnknown } from '@/lib/api/erp-error';

export function ErpErrorAlert({
  error,
  fallback,
}: {
  error: unknown;
  fallback: string;
}) {
  const info = erpErrorFromUnknown(error, fallback);

  return (
    <div className="flex items-start gap-3 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger-fg)]">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {info.code && (
          <p className="font-mono text-xs opacity-80">{info.code}</p>
        )}
        <p>{info.message}</p>
      </div>
    </div>
  );
}
