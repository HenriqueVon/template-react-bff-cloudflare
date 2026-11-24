import type { Language } from './language';
import type { Translate } from './i18n-context';
import { messages } from './messages';
import { interpolate } from './translate';

// A translate function for a language, outside React: the tests, and the helpers that are called with a language.
export function createTranslator(language: Language): Translate {
  return (key, params) => interpolate(messages[language][key], params);
}
