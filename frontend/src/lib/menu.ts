export const menuCatalog = [
  { key: 'dashboard', path: '/', label: 'nav.dashboard', roles: ['admin', 'sales_rep', 'supervisor', 'manager', 'warehouse', 'driver'] },
  { key: 'settings', path: '/settings', label: 'nav.settings', roles: ['admin'] },
  { key: 'plan', path: '/plan', label: 'nav.plan', roles: ['admin', 'supervisor', 'manager', 'sales_rep'] },
  { key: 'monitoring', path: '/monitoring', label: 'nav.monitoring', roles: ['admin', 'supervisor', 'manager'] },
  { key: 'my-reports', path: '/my-reports', label: 'nav.myReports', roles: ['sales_rep'] },
  { key: 'products', path: '/products', label: 'nav.products', roles: ['admin', 'sales_rep'] },
  { key: 'customers', path: '/customers', label: 'nav.customers', roles: ['admin', 'sales_rep'] },
  { key: 'routes', path: '/routes', label: 'nav.routes', roles: ['admin', 'supervisor', 'manager'] },
  { key: 'gallery', path: '/gallery', label: 'nav.gallery', roles: ['admin', 'supervisor', 'manager'] },
  { key: 'tasks', path: '/tasks', label: 'nav.tasks', roles: ['admin', 'supervisor', 'manager'] },
  { key: 'day', path: '/day', label: 'nav.day', roles: ['admin', 'supervisor', 'manager'] },
  { key: 'promos', path: '/promos', label: 'nav.promoCalendar', roles: ['admin', 'supervisor', 'manager'] },
  { key: 'orders', path: '/orders', label: 'nav.orders', roles: ['admin', 'sales_rep', 'warehouse'] },
  { key: 'inventory', path: '/inventory', label: 'nav.inventory', roles: ['admin', 'warehouse'] },
  { key: 'deliveries', path: '/deliveries', label: 'nav.deliveries', roles: ['admin', 'driver'] },
  { key: 'invoices', path: '/invoices', label: 'nav.invoices', roles: ['admin', 'sales_rep'] },
  { key: 'returns', path: '/returns', label: 'nav.returns', roles: ['admin', 'sales_rep'] },
  { key: 'collections', path: '/collections', label: 'nav.collections', roles: ['admin', 'sales_rep'] },
  { key: 'reports', path: '/reports', label: 'nav.reports', roles: ['admin'] },
] as const;

export type MenuKey = (typeof menuCatalog)[number]['key'];

export function defaultMenus(role: string): MenuKey[] {
  return menuCatalog.filter((item) => (item.roles as readonly string[]).includes(role)).map((item) => item.key);
}

export function menuKeyForPath(pathname: string): MenuKey | null {
  if (pathname === '/profile' || pathname.startsWith('/profile/')) {
    return null;
  }
  const ranked = menuCatalog
    .filter((item) => item.path !== '/')
    .slice()
    .sort((left, right) => right.path.length - left.path.length);
  const match = ranked.find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  if (match) {
    return match.key;
  }
  return pathname === '/' ? 'dashboard' : null;
}

export function seesMenu(role: string, menus: string[] | undefined, key: string): boolean {
  if (role === 'admin' && key === 'settings') {
    return true;
  }
  if (menus === undefined) {
    return false;
  }
  return menus.includes(key);
}

export function isTeamLead(role: string | null | undefined): boolean {
  return role === 'supervisor' || role === 'manager';
}
