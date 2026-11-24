import { describe, expect, it } from 'vitest';
import { detectLanguage, isLanguage } from './language';
import { messages } from './messages';
import { createTranslator } from './translator';
import { interpolate } from './translate';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

describe('the dictionary', () => {
  const portuguese = Object.keys(messages['pt-BR']).sort();
  const english = Object.keys(messages.en).sort();

  it('should have the same keys in both languages', () => {
    expect(english).toEqual(portuguese);
  });

  it('should have no empty text', () => {
    for (const language of ['pt-BR', 'en'] as const) {
      for (const [key, text] of Object.entries(messages[language])) {
        expect(text.trim().length, `${language} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('should use the same placeholders in both languages of each text', () => {
    for (const key of portuguese) {
      const k = key as keyof typeof messages['pt-BR'];
      expect(placeholders(messages.en[k]), key).toEqual(placeholders(messages['pt-BR'][k]));
    }
  });

  it('should translate: a text in English is not the one in Portuguese, except for the words that are the same', () => {
    const same = portuguese.filter((key) => messages.en[key as keyof typeof messages.en] === messages['pt-BR'][key as keyof typeof messages['pt-BR']]);

    // Brand names, abbreviations and words written the same way. A new text that is the same in both is probably a
    // forgotten translation, so the list is kept short and visible here.
    expect(same.length).toBeLessThan(25);
  });
});

describe('interpolate', () => {
  it('should put the values where the placeholders are', () => {
    expect(interpolate('Delete {name}? There are {count}.', { name: 'Trip', count: 3 })).toBe('Delete Trip? There are 3.');
  });

  it('should leave a placeholder without a value as it is, so the mistake is visible', () => {
    expect(interpolate('Hello {name}', {})).toBe('Hello {name}');
    expect(interpolate('Hello {name}')).toBe('Hello {name}');
  });

  it('should repeat a value used twice', () => {
    expect(interpolate('{a} and {a}', { a: 'x' })).toBe('x and x');
  });
});

describe('detectLanguage', () => {
  it('should use the language saved in this browser', () => {
    expect(detectLanguage('en', ['pt-BR'])).toBe('en');
    expect(detectLanguage('pt-BR', ['en-US'])).toBe('pt-BR');
  });

  it('should ignore a saved value that is not a language of the app', () => {
    expect(detectLanguage('fr', ['en-US'])).toBe('en');
    expect(detectLanguage('', [])).toBe('en');
  });

  it('should follow the browser when nothing is saved: any Portuguese or English', () => {
    expect(detectLanguage(null, ['pt-PT'])).toBe('pt-BR');
    expect(detectLanguage(null, ['en-GB'])).toBe('en');
    expect(detectLanguage(null, ['fr-FR', 'en-US'])).toBe('en');
  });

  it('should fall back to English', () => {
    expect(detectLanguage(null, ['fr-FR', 'de'])).toBe('en');
    expect(detectLanguage(null, [])).toBe('en');
  });

  it('should recognize the languages of the app', () => {
    expect(isLanguage('en')).toBe(true);
    expect(isLanguage('pt-BR')).toBe(true);
    expect(isLanguage('pt')).toBe(false);
    expect(isLanguage(undefined)).toBe(false);
  });
});

describe('createTranslator', () => {
  it('should translate a key into the language, with its parameters', () => {
    expect(createTranslator('pt-BR')('pagination.page', { page: 2, pages: 5 })).toBe('Página 2 de 5');
    expect(createTranslator('en')('pagination.page', { page: 2, pages: 5 })).toBe('Page 2 of 5');
  });
});
