# My Web App Conventions

## 1. Purpose

This document answers one question: **when I write new code in this repository, which rules must I follow?** It is a rule book. Most rules come from the two apps the template was extracted from, and many are enforced by tooling or tests.

| Document | Answers |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the app is built today. |
| [DEVELOPMENT.md](DEVELOPMENT.md) | How to work in the repository: setup, commands, step-by-step guides. |
| **CONVENTIONS.md** | Which rules new code follows. |
| [SECURITY.md](SECURITY.md) | The security rules. They come first when they disagree with this file. |

| Level | Meaning |
|---|---|
| **MUST** | Required: a project invariant, enforced by tooling or tests, or a consolidated decision. |
| **SHOULD** | Strongly established convention; exceptions are possible but must be justified. |
| **AVOID** | A pattern that must not be introduced without an explicit decision. |

---

## 2. General principles

1. **Everything goes through `/api`.** The browser never calls the API, and never holds a token or a key.
2. **Components never call `fetch`.** Screens call hooks; hooks call `apiRequest`.
3. **Every screen shows its states:** loading, error and empty, with a clear message in the language of the user.
4. **The API decides.** The browser checks the same rules for the messages; the API checks them again.
5. **Human readability comes first.** Write boring code for the next developer. No new dependency, abstraction or state library without a demonstrated need.

### Design and readability

**MUST**
- Use descriptive names, explicit control flow, small functions and comments that say **why**.
- Keep a screen explicit: its columns, fields and texts are written in the screen, not built from a configuration object.

**AVOID**
- A global state library, a form library or a component library "in case it is needed". TanStack Query holds the server data and `useState` holds the rest.
- Clever generics and abstractions that save a few lines and cost a reader an hour.

---

## 3. Structure

**MUST**
- One folder per screen in `src/pages/<name>/`; components shared by screens in `src/components/`; one module per resource in `src/api/`.
- Path alias `@/` for imports from `src/`; relative imports only inside a folder.
- A new section of the menu is added to `src/layout/nav-items.ts`, once. The menu, the bottom bar, the titles and the page title read from it.
- Code of the Functions in `functions/` (the routes) and `server/` (what they share). **Tests and helpers never go in `functions/`**: every file there becomes a route.

**SHOULD**
- Name files after what they hold: `ExamplesPage.tsx`, `ExampleFormDialog.tsx`, `examples.ts`, `use-list-view.ts` (hooks and non-component modules in kebab-case).

---

## 4. Data

**MUST**
- A TanStack Query hook per resource in `src/api/<resource>.ts`, with its query keys. A resource with the usual five routes uses `createResource`.
- Mutations invalidate exactly the queries they change.
- Every call goes through `apiRequest` (`src/api/client.ts`). It sends the CSRF header, renews an expired token once and never adds a token.
- A new API path is added to the allowlist in `functions/api/[[path]].ts` on purpose, with a test. Never widen it.
- The types mirror the API ([API-CONTRACT.md](API-CONTRACT.md)). Dates arrive as ISO strings and are shown through `useFormat()`.

**AVOID**
- Reading a whole large list in the browser to filter it. Page it with the API (`PagedListScreen`) and, when it needs a filter the API lacks, add the filter to the API.
- Money as a JavaScript number. Keep the string of the API, show it with a helper that works on the string, and sum in integer cents.

---

## 5. Screens and forms

**MUST**
- Use `PagedListScreen`, `FormDialog`, `ConfirmDialog` and the toast (`useToast`) for a CRUD screen, as `ExamplesPage` does.
- Check the fields with `src/lib/validation.ts`, with the limits of the API, before sending. Move the focus to the first field with an error (`FormDialog` does it).
- Send only the fields that changed on an edit (`changedFields`).
- Explain a `409` by the operation (`saveErrorMessage`): "already exists" on create and update, "in use" on delete.
- A destructive action asks for a confirmation that says what happens and to whom. The name of the record is in the text and in the label of its button.
- Show every API error with `errorMessage` (by code). The raw message of the server is never shown. A `503` is not a session problem.
- Labels point to their controls, errors are `role="alert"`, and every button that acts on a record says which one in its accessible name.

**SHOULD**
- Use a page (`/new`, `/:id/edit`) instead of a dialog when a form has many fields; a phone has little room.
- Keep the previous page of a list on screen, dimmed, while the next one loads.

---

## 6. Language

**MUST**
- Every text of the interface comes from the dictionary in `src/i18n/messages/` (`useT()`), written once for both languages with `defineMessages`. **Never write a text of the interface in a component.**
- Numbers and dates go through `useFormat()`.
- Code, comments, documentation, commit messages and pull requests are in English.

**SHOULD**
- One dictionary file per screen or group of screens, registered in `src/i18n/messages.ts`.
- Plurals as two keys (`.one`, `.other`).

---

## 7. TypeScript, lint and style

**MUST**
- `strict`, no `any` without a reason in a comment, and no unused code. `npm run lint` and `npm run check:ts` pass with no errors or warnings.
- No `console.log` (`console.error` and `console.warn` only for the events of the Functions). Logs carry an event name and safe fields: never a token, a cookie, a code, a key, a body or a personal value.
- Colors, radii, spacing and type from the tokens in `src/index.css`; never a color written by hand. To re-theme the app, change the tokens.
- No `style` attribute written in markup or in `index.html`, no inline script and no event attribute: the CSP forbids them ([ADR 0004](adr/0004-strict-content-security-policy.md)). React's `style` prop is fine.
- Self-host fonts and assets. No external host in the page.

**SHOULD**
- `type` over `interface` for data; a union of literals over an `enum`.
- Small components; extract a hook when a component holds more than one concern.

**AVOID**
- `dangerouslySetInnerHTML`, `eval` and `new Function`.
- `useEffect` to derive state that can be computed while rendering.

---

## 8. Tests

**MUST**
- A change to a Function has a test in `tests/bff/` with a mocked `fetch`; a change to the contract also changes `tests/contract/`.
- A new screen with a form, a dialog or a flow of the user has a component test (`*.spec.tsx`, with `// @vitest-environment jsdom` at the top). Look for what the user sees (labels, roles, messages), not for the structure.
- Fixtures use invented data and placeholders only.
- Logic (`src/lib`, `src/api`, `src/auth`) has unit tests next to it (`*.spec.ts`).

**SHOULD**
- Name tests `should …`, with the behavior in the sentence.
- Test the failure paths as much as the success: a refused login, a `409`, a `503`, an expired session.

---

## 9. Code that should not be copied

Nothing is listed today. When a project finds code that breaks a rule above and cannot be fixed now, list it here with the reason, so nobody copies it.
