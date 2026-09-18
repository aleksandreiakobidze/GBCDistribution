import { Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils/cn';
import { useUiStore } from '@/stores/uiStore';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';
import { UnmappedPresellerBanner } from './UnmappedPresellerBanner';

export function AppShell() {
  const { sidebarOpen } = useUiStore();

  return (
    <div className="flex h-dvh overflow-hidden bg-[var(--color-bg)]">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div
        className={cn(
          'flex flex-1 flex-col overflow-hidden transition-all duration-300',
          'md:ml-[72px]',
          sidebarOpen && 'md:ml-[280px]',
        )}
      >
        <Header />

        <OfflineBanner />
        <UnmappedPresellerBanner />

        {/* Page content — definite height so picker pages can fill leftover space */}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pb-20 md:p-6 md:pb-6">
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <BottomNav />
      </div>

      {/* Mobile Sidebar Overlay */}
      <MobileSidebarOverlay />
    </div>
  );
}

function MobileSidebarOverlay() {
  const { sidebarOpen, setSidebarOpen } = useUiStore();

  if (!sidebarOpen) return null;

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => setSidebarOpen(false)}
      />
      <div className="relative z-50 h-full w-[280px]">
        <Sidebar />
      </div>
    </div>
  );
}
