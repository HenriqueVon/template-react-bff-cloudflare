// The languages of the app. The text of the interface changes; the data of the user does not.
export type Language = 'en' | 'pt-BR';

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'pt-BR', label: 'Português' },
];

export const DEFAULT_LANGUAGE: Language = 'en';

export function isLanguage(value: unknown): value is Language {
  return value === 'pt-BR' || value === 'en';
}

// The language of the first visit: the one saved in this browser, else the one of the browser (any Portuguese is pt-BR,
// any English is en), else the default.
export function detectLanguage(saved: string | null, browserLanguages: readonly string[]): Language {
  if (isLanguage(saved)) return saved;

  for (const candidate of browserLanguages) {
    const base = candidate.toLowerCase().split('-')[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'en') return 'en';
  }

  return DEFAULT_LANGUAGE;
}
