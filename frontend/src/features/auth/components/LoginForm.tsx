import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '@/components/ui';
import { loginSchema, type LoginFormData } from '@/lib/utils/validators';
import { useLogin } from '../hooks/useAuth';

export function LoginForm() {
  const { t } = useTranslation();
  const login = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (data: LoginFormData) => {
    login.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {login.isError && (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-danger)]/20 bg-[var(--color-danger-light)] px-4 py-3 text-sm text-[var(--color-danger-fg)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {(login.error as { response?: { data?: { message?: string } } })
              ?.response?.data?.message || t('auth.invalidCredentials', 'Invalid email or password')}
          </span>
        </div>
      )}

      <Input
        label={t('auth.email', 'Email')}
        type="email"
        placeholder="you@company.com"
        autoComplete="email"
        leftIcon={<Mail className="h-4 w-4" />}
        error={errors.email?.message}
        {...register('email')}
      />

      <Input
        label={t('auth.password', 'Password')}
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        leftIcon={<Lock className="h-4 w-4" />}
        error={errors.password?.message}
        {...register('password')}
      />

      <Button
        type="submit"
        fullWidth
        size="lg"
        loading={login.isPending}
        className="mt-2"
      >
        {t('auth.signIn', 'Sign In')}
      </Button>
    </form>
  );
}
