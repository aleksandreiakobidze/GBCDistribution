import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import { Card, Badge, Button } from '@/components/ui';
import { PageHeader, ThemeSegmented, LanguageSegmented } from '@/components/shared';
import { useLogout } from '@/features/auth/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { User, Mail, Phone, Shield, Palette, Globe, Warehouse } from 'lucide-react';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { defaultWarehouseId, setDefaultWarehouseId } = useUiStore();
  const logout = useLogout();

  if (!user) return null;

  const roleLabels: Record<string, string> = {
    admin: 'Administrator',
    sales_rep: 'Sales Representative',
    supervisor: 'Supervisor',
    warehouse: 'Warehouse Staff',
    driver: 'Delivery Driver',
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.profile')} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-[var(--color-text-on-primary)] text-2xl font-bold shadow-[var(--shadow-md)]">
              {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-text)]">{user.name}</h2>
              <Badge variant="primary">{roleLabels[user.role] || user.role}</Badge>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
              <Mail className="w-5 h-5" />
              <span>{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
                <Phone className="w-5 h-5" />
                <span>{user.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
              <Shield className="w-5 h-5" />
              <span>{roleLabels[user.role]}</span>
            </div>
            <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
              <User className="w-5 h-5" />
              <span>
                {t('auth.presellerMapping', 'FMG IdGvari')}:{' '}
                {user.presellerMapped || user.id_gvari != null
                  ? String(user.id_gvari)
                  : t('auth.presellerUnmapped', 'არ არის მიბმული')}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
              <User className="w-5 h-5" />
              <span>Status: {user.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-6">{t('nav.settings')}</h3>

          <div className="space-y-6">
            {/* Theme */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                <Palette className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span>Appearance</span>
              </div>
              <ThemeSegmented />
            </div>

            {/* Language */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                <Globe className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span>Language</span>
              </div>
              <LanguageSegmented />
            </div>

            {/* Default Warehouse */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                <Warehouse className="w-4 h-4 text-[var(--color-text-secondary)]" />
                <span>{t('orders.warehouse', 'Default Warehouse')}</span>
              </div>
              <div className="inline-flex w-full items-center gap-1 rounded-xl bg-[var(--color-surface-inset)] p-1">
                <button
                  onClick={() => setDefaultWarehouseId('1')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    defaultWarehouseId === '1'
                      ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                      : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {t('orders.mainWarehouse', 'Main')}
                </button>
                <button
                  onClick={() => setDefaultWarehouseId('2')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                    defaultWarehouseId === '2'
                      ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
                      : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                  }`}
                >
                  {t('orders.secondaryWarehouse', 'Secondary')}
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--color-border)]">
              <Button
                variant="danger"
                fullWidth
                onClick={() => logout.mutate()}
                loading={logout.isPending}
              >
                {t('nav.logout')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
