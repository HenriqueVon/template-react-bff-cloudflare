import type { Language } from './language';
import { common } from './messages/common';
import { errors } from './messages/errors';
// @template:example:start
import { examples } from './messages/examples';
// @template:example:end
import { shell } from './messages/shell';
import { validation } from './messages/validation';

// The dictionary, put together from its areas (src/i18n/messages/). Each area is written for both languages at once, so
// the two always have the same keys. Add an area per screen or group of screens.
const areas = [
  common,
  errors,
  // @template:example:start
  examples,
  // @template:example:end
  shell,
  validation,
];

type Dictionary = typeof common['en']
  & typeof errors['en']
  // @template:example:start
  & typeof examples['en']
  // @template:example:end
  & typeof shell['en']
  & typeof validation['en'];

function merge(language: Language): Dictionary {
  return Object.assign({}, ...areas.map((area) => area[language])) as Dictionary;
}

export const messages: Record<Language, Dictionary> = {
  'en'    : merge('en'),
  'pt-BR' : merge('pt-BR'),
};

export type MessageKey = keyof Dictionary;
