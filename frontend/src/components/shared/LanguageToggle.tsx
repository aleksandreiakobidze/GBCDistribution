import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils/cn';

function FlagEN({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <clipPath id="flagCircle"><circle cx="32" cy="32" r="32" /></clipPath>
      </defs>
      <g clipPath="url(#flagCircle)">
        {/* Stripes */}
        <rect width="64" height="64" fill="#B22234" />
        <rect y="5" width="64" height="5" fill="#fff" />
        <rect y="15" width="64" height="5" fill="#fff" />
        <rect y="25" width="64" height="5" fill="#fff" />
        <rect y="35" width="64" height="5" fill="#fff" />
        <rect y="45" width="64" height="5" fill="#fff" />
        <rect y="55" width="64" height="5" fill="#fff" />
        {/* Canton */}
        <rect width="26" height="34" fill="#3C3B6E" />
        {/* Stars (simplified 5x4 + 4x3 pattern) */}
        <g fill="#fff">
          <circle cx="4" cy="4" r="1.2" /><circle cx="9" cy="4" r="1.2" /><circle cx="14" cy="4" r="1.2" /><circle cx="19" cy="4" r="1.2" /><circle cx="24" cy="4" r="1.2" />
          <circle cx="6.5" cy="7.5" r="1.2" /><circle cx="11.5" cy="7.5" r="1.2" /><circle cx="16.5" cy="7.5" r="1.2" /><circle cx="21.5" cy="7.5" r="1.2" />
          <circle cx="4" cy="11" r="1.2" /><circle cx="9" cy="11" r="1.2" /><circle cx="14" cy="11" r="1.2" /><circle cx="19" cy="11" r="1.2" /><circle cx="24" cy="11" r="1.2" />
          <circle cx="6.5" cy="14.5" r="1.2" /><circle cx="11.5" cy="14.5" r="1.2" /><circle cx="16.5" cy="14.5" r="1.2" /><circle cx="21.5" cy="14.5" r="1.2" />
          <circle cx="4" cy="18" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="14" cy="18" r="1.2" /><circle cx="19" cy="18" r="1.2" /><circle cx="24" cy="18" r="1.2" />
          <circle cx="6.5" cy="21.5" r="1.2" /><circle cx="11.5" cy="21.5" r="1.2" /><circle cx="16.5" cy="21.5" r="1.2" /><circle cx="21.5" cy="21.5" r="1.2" />
          <circle cx="4" cy="25" r="1.2" /><circle cx="9" cy="25" r="1.2" /><circle cx="14" cy="25" r="1.2" /><circle cx="19" cy="25" r="1.2" /><circle cx="24" cy="25" r="1.2" />
          <circle cx="6.5" cy="28.5" r="1.2" /><circle cx="11.5" cy="28.5" r="1.2" /><circle cx="16.5" cy="28.5" r="1.2" /><circle cx="21.5" cy="28.5" r="1.2" />
          <circle cx="4" cy="32" r="1.2" /><circle cx="9" cy="32" r="1.2" /><circle cx="14" cy="32" r="1.2" /><circle cx="19" cy="32" r="1.2" /><circle cx="24" cy="32" r="1.2" />
        </g>
      </g>
    </svg>
  );
}

function FlagGE({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="32" fill="#fff" />
      <path d="M28 0h8v64h-8z" fill="#FF0000" />
      <path d="M0 28h64v8H0z" fill="#FF0000" />
      {/* Top-left cross */}
      <path d="M10 10h4v8h-4z" fill="#FF0000" />
      <path d="M8 12h8v4H8z" fill="#FF0000" />
      {/* Top-right cross */}
      <path d="M50 10h4v8h-4z" fill="#FF0000" />
      <path d="M48 12h8v4h-8z" fill="#FF0000" />
      {/* Bottom-left cross */}
      <path d="M10 46h4v8h-4z" fill="#FF0000" />
      <path d="M8 48h8v4H8z" fill="#FF0000" />
      {/* Bottom-right cross */}
      <path d="M50 46h4v8h-4z" fill="#FF0000" />
      <path d="M48 48h8v4h-8z" fill="#FF0000" />
    </svg>
  );
}

const flags = {
  en: FlagEN,
  ka: FlagGE,
} as const;

interface LanguageToggleProps {
  size?: 'sm' | 'md';
}

export function LanguageToggle({ size = 'sm' }: LanguageToggleProps) {
  const { i18n } = useTranslation();
  const { language, setLanguage } = useUiStore();

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'ka' : 'en';
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
  };

  const NextFlag = flags[language === 'en' ? 'ka' : 'en'];
  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const flagDim = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={cn(
        'flex items-center justify-center rounded-full transition-all hover:ring-2 hover:ring-[var(--color-primary)]/20 active:scale-95',
        dim,
      )}
      aria-label={`Switch to ${language === 'en' ? 'Georgian' : 'English'}`}
    >
      <NextFlag className={cn('rounded-full shadow-sm', flagDim)} />
    </button>
  );
}

interface LanguageSegmentedProps {
  className?: string;
}

export function LanguageSegmented({ className }: LanguageSegmentedProps) {
  const { i18n } = useTranslation();
  const { language, setLanguage } = useUiStore();

  const handleChange = (lang: 'en' | 'ka') => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <div className={cn('inline-flex w-full items-center gap-1 rounded-xl bg-[var(--color-surface-inset)] p-1', className)}>
      <button
        type="button"
        onClick={() => handleChange('en')}
        className={cn(
          'flex flex-1 items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
          language === 'en'
            ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
            : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
        )}
      >
        <FlagEN className="h-5 w-5 rounded-full shadow-sm" />
        English
      </button>
      <button
        type="button"
        onClick={() => handleChange('ka')}
        className={cn(
          'flex flex-1 items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200',
          language === 'ka'
            ? 'bg-[var(--color-surface)] text-[var(--color-text)] shadow-[var(--shadow-sm)]'
            : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]',
        )}
      >
        <FlagGE className="h-5 w-5 rounded-full shadow-sm" />
        ქართული
      </button>
    </div>
  );
}
