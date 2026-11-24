import { useMemo } from 'react';
import { useI18n } from './i18n-context';

// Dates written the way of the language of the user ("Nov 13, 2026" in English, "13 de nov. de 2026" in Portuguese).
// The screens use this instead of formatting by hand, so the language is never forgotten. Add the numbers and the
// money of your domain here.
export function useFormat() {
  const { language } = useI18n();

  return useMemo(() => {
    const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: 'medium' });

    return {
      language,
      // An ISO date-time of the API, shown in the time zone of the browser.
      date: (value: string | null | undefined) => {
        if (!value) return '';

        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date);
      },
    };
  }, [language]);
}
