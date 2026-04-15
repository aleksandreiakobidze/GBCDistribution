import { useTranslation } from 'react-i18next';
import { Menu, Bell, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore } from '@/stores/uiStore';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { LanguageToggle } from '@/components/shared/LanguageToggle';

export function Header() {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const { pendingCount, isSyncing } = useSyncStore();
  const { setSidebarOpen, sidebarOpen } = useUiStore();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="rounded-xl p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] md:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Online status */}
        <div className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-medium">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isOnline ? 'bg-[var(--color-success)]' : 'bg-[var(--color-danger)]',
            )}
          />
          <span className="hidden sm:inline text-[var(--color-text-secondary)]">
            {isOnline ? t('status.online', 'Online') : t('status.offline', 'Offline')}
          </span>
        </div>

        {/* Sync status */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl bg-[var(--color-warning-light)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-warning)]">
            <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
            <span className="hidden sm:inline">{pendingCount}</span>
          </div>
        )}

        {/* Language toggle (circle flag) */}
        <LanguageToggle size="sm" />

        {/* Theme toggle */}
        <ThemeToggle size="sm" />

        {/* Notifications */}
        <button
          className="relative rounded-xl p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
        </button>
      </div>
    </header>
  );
}
