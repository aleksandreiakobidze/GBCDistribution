import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { X, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function OfflineBanner() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [location.pathname]);

  if (isOnline || dismissed) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-warning)]/20 bg-[var(--color-warning-light)] px-4 py-2.5 text-sm">
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-warning)] opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--color-warning)]" />
        </span>
        <WifiOff className="h-4 w-4 text-[var(--color-warning)]" />
        <span className="font-medium text-[var(--color-text)]">
          {t('offline.banner', 'You are offline. Changes will sync when connected.')}
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1 text-[var(--color-warning)] transition-colors hover:bg-[var(--color-warning)]/20"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
