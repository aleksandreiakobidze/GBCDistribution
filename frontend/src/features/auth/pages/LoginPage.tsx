import { Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LoginForm } from '../components/LoginForm';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-[var(--color-bg)] px-4 py-8">
      {/* Background decorations */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-[var(--color-primary)]/8 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[var(--color-secondary)]/8 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-[var(--color-accent)]/5 blur-3xl" />
      </div>

      {/* Theme toggle - top right */}
      <div className="fixed right-4 top-4 z-20">
        <ThemeToggle size="md" />
      </div>

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo & Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-primary)] shadow-lg shadow-[var(--color-primary)]/25">
            <Package className="h-8 w-8 text-[var(--color-text-on-primary)]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text)]">
            {t('app.name', 'BSC Distribution')}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {t('auth.loginSubtitle', 'Sign in to manage your operations')}
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-[var(--shadow-xl)]">
          <LoginForm />
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-[var(--color-text-tertiary)]">
          {t('app.name', 'BSC Distribution System')} &middot; v1.0.0 &middot; &copy;{' '}
          {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
