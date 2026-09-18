import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/authStore';

export function UnmappedPresellerBanner() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  if (!user) return null;
  if (user.role !== 'sales_rep' && user.role !== 'admin') return null;
  if (user.presellerMapped) return null;

  return (
    <div className="flex items-start gap-2.5 border-b border-[var(--color-warning)]/20 bg-[var(--color-warning-light)] px-4 py-2.5 text-sm">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
      <p className="font-medium text-[var(--color-text)]">
        {t(
          'auth.unmappedPreseller',
          'თქვენი ანგარიში არ არის მიბმული პრისელერზე. FMG კლიენტები და პროდუქცია არ ჩაიტვირთება, სანამ ადმინი Filament-ში (Users → FMG IdGvari) არ დაამაგრებს IdGvari-ს.',
        )}
      </p>
    </div>
  );
}
