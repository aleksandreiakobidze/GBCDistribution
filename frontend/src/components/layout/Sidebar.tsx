import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Package,
  Building2,
  ShoppingCart,
  Warehouse,
  Truck,
  FileText,
  RotateCcw,
  Banknote,
  BarChart3,
  Map,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Avatar } from '@/components/ui/Avatar';
import type { User } from '@/types';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: User['role'][];
}

const navItems: NavItem[] = [
  { path: '/', label: 'nav.dashboard', icon: LayoutDashboard, roles: ['admin', 'sales_rep', 'supervisor', 'warehouse', 'driver'] },
  { path: '/products', label: 'nav.products', icon: Package, roles: ['admin', 'sales_rep'] },
  { path: '/customers', label: 'nav.customers', icon: Building2, roles: ['admin', 'sales_rep'] },
  { path: '/routes', label: 'nav.routes', icon: Map, roles: ['admin', 'supervisor'] },
  { path: '/orders', label: 'nav.orders', icon: ShoppingCart, roles: ['admin', 'sales_rep', 'warehouse'] },
  { path: '/inventory', label: 'nav.inventory', icon: Warehouse, roles: ['admin', 'warehouse'] },
  { path: '/deliveries', label: 'nav.deliveries', icon: Truck, roles: ['admin', 'driver'] },
  { path: '/invoices', label: 'nav.invoices', icon: FileText, roles: ['admin', 'sales_rep'] },
  { path: '/returns', label: 'nav.returns', icon: RotateCcw, roles: ['admin', 'sales_rep'] },
  { path: '/collections', label: 'nav.collections', icon: Banknote, roles: ['admin', 'sales_rep'] },
  { path: '/reports', label: 'nav.reports', icon: BarChart3, roles: ['admin'] },
];

export function Sidebar() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUiStore();

  const visibleItems = navItems.filter(
    (item) => user && item.roles.includes(user.role),
  );

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-[280px]' : 'w-[72px]',
      )}
    >
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white font-bold text-lg">
          B
        </div>
        {sidebarOpen && (
          <div className="overflow-hidden">
            <h1 className="text-base font-bold text-[var(--color-text)] whitespace-nowrap">
              BSC Distribution
            </h1>
            <p className="text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
              {t('app.tagline', 'Management System')}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]',
                !sidebarOpen && 'justify-center px-0',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'h-5 w-5 shrink-0 transition-colors',
                    isActive
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text)]',
                  )}
                />
                {sidebarOpen && (
                  <span className="truncate">{t(item.label)}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User & Controls */}
      <div className="shrink-0 border-t border-[var(--color-border)] p-3 space-y-2">
        {/* Collapse Toggle */}
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors"
        >
          {sidebarOpen ? (
            <>
              <ChevronsLeft className="h-4 w-4" />
              <span>{t('sidebar.collapse', 'Collapse')}</span>
            </>
          ) : (
            <ChevronsRight className="h-4 w-4" />
          )}
        </button>

        {/* User Info */}
        {user && (
          <div
            className={cn(
              'flex items-center gap-3 rounded-xl p-2',
              !sidebarOpen && 'justify-center',
            )}
          >
            <Avatar
              name={user.name}
              src={user.avatar ?? undefined}
              size="sm"
            />
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">
                  {user.name}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] capitalize">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
            )}
            {sidebarOpen && (
              <button
                onClick={handleLogout}
                className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors"
                title={t('nav.logout', 'Logout')}
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
