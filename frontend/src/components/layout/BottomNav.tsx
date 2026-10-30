import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  ShoppingCart,
  Building2,
  PlusCircle,
  Truck,
  Warehouse,
  BarChart3,
  User as UserIcon,
  Images,
  Sun,
  ClipboardList,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { seesMenu } from '@/lib/menu';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

interface BottomNavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  primary?: boolean;
  menu?: string;
}

function getNavItems(role: User['role']): BottomNavItem[] {
  switch (role) {
    case 'sales_rep':
      return [
        { path: '/', label: 'nav.dashboard', icon: LayoutDashboard, menu: 'dashboard' },
        { path: '/plan', label: 'nav.plan', icon: Target, menu: 'plan' },
        { path: '/customers', label: 'nav.customers', icon: Building2, menu: 'customers' },
        { path: '/customers', label: 'nav.newOrder', icon: PlusCircle, primary: true, menu: 'customers' },
        { path: '/orders', label: 'nav.orders', icon: ShoppingCart, menu: 'orders' },
        { path: '/profile', label: 'nav.profile', icon: UserIcon },
      ];
    case 'supervisor':
    case 'manager':
      return [
        { path: '/', label: 'nav.dashboard', icon: LayoutDashboard, menu: 'dashboard' },
        { path: '/plan', label: 'nav.plan', icon: Target, menu: 'plan' },
        { path: '/day', label: 'nav.day', icon: Sun, menu: 'day' },
        { path: '/tasks', label: 'nav.tasks', icon: ClipboardList, menu: 'tasks' },
        { path: '/gallery', label: 'nav.gallery', icon: Images, menu: 'gallery' },
        { path: '/profile', label: 'nav.profile', icon: UserIcon },
      ];
    case 'driver':
      return [
        { path: '/', label: 'nav.dashboard', icon: LayoutDashboard, menu: 'dashboard' },
        { path: '/deliveries', label: 'nav.deliveries', icon: Truck, menu: 'deliveries' },
        { path: '/profile', label: 'nav.profile', icon: UserIcon },
      ];
    case 'warehouse':
      return [
        { path: '/', label: 'nav.dashboard', icon: LayoutDashboard, menu: 'dashboard' },
        { path: '/inventory', label: 'nav.inventory', icon: Warehouse, menu: 'inventory' },
        { path: '/orders', label: 'nav.orders', icon: ShoppingCart, menu: 'orders' },
        { path: '/profile', label: 'nav.profile', icon: UserIcon },
      ];
    case 'admin':
      return [
        { path: '/', label: 'nav.dashboard', icon: LayoutDashboard, menu: 'dashboard' },
        { path: '/plan', label: 'nav.plan', icon: Target, menu: 'plan' },
        { path: '/orders', label: 'nav.orders', icon: ShoppingCart, menu: 'orders' },
        { path: '/reports', label: 'nav.reports', icon: BarChart3, menu: 'reports' },
        { path: '/profile', label: 'nav.profile', icon: UserIcon },
      ];
    default:
      return [];
  }
}

export function BottomNav() {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  if (!user) return null;

  const items = getNavItems(user.role).filter((item) => (
    !item.menu || seesMenu(user.role, user.menus, item.menu)
  ));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch justify-evenly overflow-x-auto border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_-2px_10px_rgba(0,0,0,0.05)] [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <NavLink
          key={item.label}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            cn(
              'flex min-w-max flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-medium transition-colors',
              item.primary
                ? 'text-white'
                : isActive
                  ? 'text-[var(--color-primary)]'
                  : 'text-[var(--color-text-secondary)]',
            )
          }
        >
          {({ isActive }) => (
            <>
              {item.primary ? (
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/30 -translate-y-2">
                  <item.icon className="h-5 w-5 text-white" />
                </div>
              ) : (
                <item.icon
                  className={cn(
                    'h-5 w-5 transition-colors',
                    isActive
                      ? 'text-[var(--color-primary)]'
                      : 'text-[var(--color-text-secondary)]',
                  )}
                />
              )}
              <span className={cn('whitespace-nowrap', item.primary && '-translate-y-1')}>
                {t(item.label)}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
