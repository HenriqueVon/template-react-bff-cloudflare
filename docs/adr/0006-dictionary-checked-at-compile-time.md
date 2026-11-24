# 0006. A dictionary checked at compile time instead of an i18n library

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The interface is available in two languages, and one of the apps the template came from grew a dictionary of hundreds of texts. The common failure of translated apps is a text that exists in one language and is missing, or has different placeholders, in the other, and that nobody sees until a user does.

## Decision

The dictionary is plain TypeScript: each area of the app has a file (`src/i18n/messages/*.ts`) that writes **both languages at once** with `defineMessages`, which infers the keys from both objects, so a key that exists in one language and not in the other is a compile error. `t(key, params)` replaces `{placeholders}`; `tx` does the same for a text that holds elements. A test checks that both languages have the same placeholders and that no text is empty. The provider chooses the language (the one saved in this browser, else the one of the browser, else English) and keeps the `lang` of the page.

## Alternatives considered

- **`react-i18next`, `react-intl` or `lingui`.** Mature, with plurals, ICU messages and extraction tools. They add a dependency, a loading step for catalogs and keys that are strings, which the compiler cannot check. They are the right choice when translators work in other tools, or when there are many languages.
- **JSON files per language.** Easy for translators, but the compiler cannot tell that a key is missing, and a typo in a key is found at run time.
- **No i18n, English only.** The simplest. Adding a second language to an app with texts spread over every component is a large, error-prone change.

## Consequences

- Adding a language is a new column in every `defineMessages` call, and the compiler lists the places that miss it.
- Plurals are written as two keys (`.one`, `.other`) chosen by the screen. For a language with more forms, switch to `Intl.PluralRules` in one helper.
- Numbers and dates go through `useFormat()`, which uses `Intl` with the language of the user; never format them by hand.
- Messages that come from the API are never shown: the app maps each error code to a text of its own (`src/i18n/messages/errors.ts`), so the language of the user is the language of the error.
