import { Languages } from 'lucide-react';
import { useI18n } from './i18n-context';
import { isLanguage, LANGUAGES } from './language';

// The choice of the language of the interface. It is kept in this browser and applies at once, without a reload.
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className={`relative ${className}`}>
      <Languages size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
      <select
        aria-label={t('language.label')}
        value={language}
        onChange={(event) => {
          if (isLanguage(event.target.value)) setLanguage(event.target.value);
        }}
        className="w-full cursor-pointer appearance-none rounded-lg border border-outline-variant/60 bg-surface-container-lowest py-2 pl-9 pr-3 text-body-md text-on-surface transition-colors focus:border-primary"
      >
        {LANGUAGES.map((option) => (
          <option key={option.id} value={option.id}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
