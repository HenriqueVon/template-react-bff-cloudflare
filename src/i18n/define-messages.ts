import type { Language } from './language';

// One area of the dictionary (the common words, the login, the entries...) written once for both languages. The
// function makes TypeScript infer the keys from both objects, so a key that exists in one language and not in the
// other is a compile error: nothing reaches the screen untranslated.
export function defineMessages<K extends string>(area: Record<Language, Record<K, string>>): Record<Language, Record<K, string>> {
  return area;
}
