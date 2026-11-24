import type { Translate } from '@/i18n/i18n-context';

// The rules the API checks on the text fields, checked here too so the messages are in the language of the user and the
// user sees them before sending. The API checks them again: this is a convenience, never the protection.
export type TextRule = {
  // The field the messages talk about; its name, with its article, is in the dictionary (`validation.field.*`).
  field     : 'name' | 'description';
  min       : number;
  max       : number;
  // An empty value is valid.
  optional? : boolean;
};

// The limits are the ones of the create schema of the API.
export const RULES = {
  // @template:example:start
  exampleName        : { field: 'name', min: 3, max: 100 },
  exampleDescription : { field: 'description', min: 0, max: 255, optional: true },
  // @template:example:end
} as const satisfies Record<string, TextRule>;

// Returns the message of the first problem, or null when the value is valid. The value is checked without the spaces
// around it, which is also what is sent.
export function validateText(value: string, rule: TextRule, t: Translate): string | null {
  const text = value.trim();

  if (text === '') return rule.optional ? null : t('validation.required', { field: t(`validation.field.${rule.field}`) });

  const subject = t(`validation.Field.${rule.field}`);
  if (text.length < rule.min) return t('validation.min', { Field: subject, min: rule.min });
  if (text.length > rule.max) return t('validation.max', { Field: subject, max: rule.max });

  return null;
}
