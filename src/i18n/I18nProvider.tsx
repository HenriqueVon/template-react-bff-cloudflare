import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { readLanguage, saveLanguage } from '@/lib/storage';
import { I18nContext, type I18nValue } from './i18n-context';
import { detectLanguage, type Language } from './language';
import { messages } from './messages';
import { interpolate, interpolateNodes } from './translate';

// The language of the interface, chosen once and kept in this browser. Every text comes from `messages`; the
// provider also keeps the `lang` of the page in step, so screen readers and the browser use the right voice and hyphenation.
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => detectLanguage(readLanguage(), navigator.languages ?? [navigator.language]));

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<I18nValue>(() => ({
    language,
    setLanguage: (next) => {
      setLanguageState(next);
      saveLanguage(next);
    },
    t  : (key, params) => interpolate(messages[language][key], params),
    tx : (key, nodes) => interpolateNodes(messages[language][key], nodes),
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
