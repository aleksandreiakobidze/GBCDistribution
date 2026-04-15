import { useTranslation } from 'react-i18next';

interface PlaceholderProps {
  title: string;
}

export function Placeholder({ title }: PlaceholderProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-12 py-10 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {t('placeholder.comingSoon', 'This page is coming soon.')}
        </p>
      </div>
    </div>
  );
}
