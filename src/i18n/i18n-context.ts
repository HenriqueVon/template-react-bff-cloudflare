import { createContext, useContext, type ReactNode } from 'react';
import type { Language } from './language';
import type { MessageKey } from './messages';
import type { Params } from './translate';

export type Translate = (key: MessageKey, params?: Params) => string;

export type I18nValue = {
  language : Language;
  setLanguage : (language: Language) => void;
  t        : Translate;
  // A message that holds elements, such as a name in bold: `tx('x.delete', { name: <strong>Luz</strong> })`.
  tx       : (key: MessageKey, nodes: Record<string, ReactNode>) => ReactNode;
};

export const I18nContext = createContext<I18nValue | null>(null);

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return value;
}

// The common case: only the function that translates.
export function useT(): Translate {
  return useI18n().t;
}
