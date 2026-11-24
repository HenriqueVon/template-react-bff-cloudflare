# Template: react-bff-cloudflare

Base for web apps that sign users in and talk to an API through a backend for the frontend: **React 19 · TypeScript · Vite · Tailwind 4 · TanStack Query · React Router · Cloudflare Pages Functions · Vitest**.

It was extracted from two apps of the same author, an admin panel with an email and password login and a personal finance app with a Google login, which share the same session handling, and it keeps what both have in common. This file is for people who **use or evolve the template**. `npm run init` deletes it, so it never reaches a project.

## Create a project

Two ways to get a copy: on GitHub, **Use this template** on the template repository (it copies the files without history); or copy this folder by hand. Then:

1. Copy this folder to the new repository location (do not copy `node_modules`, `.git`, `dist` or `.wrangler`). Skip this step when you used **Use this template**.
2. In the copy, run:

   ```bash
   npm run init -- --name orders-web --login password
   ```

   | Option | Effect |
   |---|---|
   | `--name <name>` | Required. kebab-case, at most 50 characters. Replaces the package name, the CSRF header value, the keys of the browser storage, the name of the session channel and the lock, and the docs. |
   | `--login <password\|google>` | Required. `password`: email and password. `google`: Google, with PKCE. The code, tests and docs of the other one are removed. |
   | `--title "<Title>"` | The name shown in the menu, the top bar, the login page and the title of the page. Default: derived from the name (`orders-web` → `Orders Web`). |
   | `--remove-example` | Deletes the reference `examples` screen, its API module, its texts, its tests and every registration of it. |

   `init` also creates `.dev.vars` from `.dev.vars.example` with a random `API_KEY` (the key is never printed), removes the files of the template, removes the `init` script and deletes itself. It needs no `npm install` first.
3. Follow the "Next steps" it prints: `npm install`, then `npm run dev`.
4. Edit the one-line description in `README.md`, then `git init` and make the first commit.
5. Create the `develop` branch: `AGENTS.md` and the workflow assume `develop` and `main`, and **Use this template** copies only the default branch.
6. Before the first deploy, create the Cloudflare Pages project and the `dev` and `prd` environments in GitHub ([docs/DEVELOPMENT.md §7](docs/DEVELOPMENT.md#7-deployment)).

## What is included

| Area | Content |
|---|---|
| Session | HttpOnly `__Host-` cookies for the access and the refresh token, refresh with rotation, one refresh at a time across tabs, `GET /auth/me` to know who is signed in, idle logout after 30 minutes, logout on every tab, "sign out of all devices" |
| Login | `password` (email and password) or `google` (OAuth with PKCE and `state`), chosen when the project is created |
| BFF | Pages Functions: login or Google start and exchange, refresh, logout, logout-all, and a proxy with an allowlist of paths and methods, a CSRF check, a timeout and the device of the browser forwarded to the API |
| Browser protections | A CSP with `'self'` in every directive and no inline code, HSTS, no framing, `nosniff`, no referrer, no indexing |
| App | A shell (side menu on the desktop, bottom bar on the phone, top bar, user menu with the language), `RequireAuth`, the pages for no access, service unavailable and not found |
| Screens | `PagedListScreen`, `FormDialog`, `ConfirmDialog`, toast, states, pagination, table or cards: a complete CRUD in `src/pages/examples` |
| Data | `apiRequest` with the renewal of the session, `createResource` for the five usual routes, TanStack Query hooks |
| Languages | English and Portuguese, with a dictionary the compiler checks |
| Fake API | `mock-api/`: a zero-dependency server with the login, the Google flow, rotation of the refresh token, `GET /auth/me` and the example resource, used by `npm run dev`, the tests and the CI |
| Tests | Vitest: the client, the resource builder, the session, the Functions with a mocked `fetch`, **the Functions against the fake API with no mock**, component tests in jsdom, guardrails for a repository that may be public, and **end-to-end tests in a real browser** (Playwright) against the build served with the real headers |
| CI/CD | `validate` (lint, type check, tests, build), `audit`, `e2e` (Playwright), deploy of `develop` (preview) and `main` (production) with `wrangler`, and Dependabot |
| Docs and AI | `AGENTS.md` (imported by `CLAUDE.md`) and `docs/`: architecture, conventions, development guide, API contract, security rules, a threat model and six decision records |

## Only in the template repository

These files describe or test the template, so `npm run init` deletes them and a project never inherits them:

| File | Purpose | One-time setup on GitHub |
|---|---|---|
| `TEMPLATE.md`, `CHANGELOG.md`, `SECURITY.md` | The guide, the release history and the security policy of the template | Settings → Security → enable **Private vulnerability reporting** (the policy points to it) |
| `.github/workflows/codeql.yml` | CodeQL code scanning, free on public repositories only (private ones need GitHub Advanced Security) | none (it runs on push and weekly) |
| `docs/images/`, `e2e/screenshots.spec.ts` | The pictures of the README, taken from the real app: `SCREENSHOTS=1 npx playwright test e2e/screenshots.spec.ts` (stop `npm run dev` first). Run it again when the look of the app changes | none |
| `.github/workflows/template-init.yml` | Tests the template **as a generator**: it runs `npm run init` on a copy, in four combinations (each login, with and without the example), checks that no name, marker or template-only file is left, and runs `npm ci`, lint, type check, the tests, the build and the end-to-end tests on the generated project | none |

The block of `README.md` between `<!-- @template:only:start -->` and `<!-- @template:only:end -->` (the showcase) goes away too.

To release: add the changes under `[Unreleased]` in `CHANGELOG.md`, move them to a new version, then create the GitHub release with the tag `vX.Y.Z`.

## Decisions behind the template

These were chosen when the template was created. Change them in the template, not in each project.

1. **Both logins, chosen at `init`.** The two apps differ in the login and in little else. Each login is a few files and a few marked blocks; the project keeps one. The cost is that the template carries both and the CI proves both.
2. **A fake API.** The template has to run for someone who has none of the APIs it was built against ([ADR 0005](docs/adr/0005-fake-api.md)). It follows the shape of the `example` module of the API template.
3. **`GET /auth/me` to know the session.** One of the apps had it, the other probed with a list call because its API had no such route. The contract asks for it; [docs/API-CONTRACT.md](docs/API-CONTRACT.md) says how to do without.
4. **A neutral theme.** The apps had the look of their brands. The tokens in `src/index.css` keep the names of Material 3 (`primary`, `surface`, `on-surface`) with a plain palette, so a project re-themes the app by changing values.
5. **English first.** The default language is English, and Portuguese is included to show the dictionary working. Remove a language by deleting its object in each `defineMessages` call; the compiler lists them.
6. **No MFA, charts, QR codes or domain screens.** They belong to one of the apps, not to the foundation.
7. **TypeScript 5.9, ready for 6.** `tsconfig.app.json` has no `baseUrl` (deprecated in TypeScript 6 and removed in 7) and the paths are relative to the file. The type check gives the same result on 5.9.3 and 6.0.3, so a project can upgrade without touching the configuration. It stays on `~5.9.3`, as in the source apps; 6.0 works, and `typescript-eslint` supports up to `<6.1.0`.

## What was left out on purpose

- Everything domain-specific: the administration screens (clients, roles, users, audit, MFA) and the finance screens (ledgers, funds, entries, categories, dashboards).
- A state library, a form library and a component library. TanStack Query and the shared components are enough, and [docs/CONVENTIONS.md](docs/CONVENTIONS.md) says to keep it so.
- Sentry, analytics and feature flags: they bring third-party hosts, which the CSP forbids by default.

## Differences from the source repositories (fixed while extracting)

| Source issue | In the template |
|---|---|
| `baseUrl` in `tsconfig.app.json`, deprecated in TypeScript 6 and removed in 7 | `paths` relative to the file; the type check gives the same result on TypeScript 5.9.3 and 6.0.3 |
| Component tests only in one of the apps | Component tests in jsdom, and guardrails for secrets and the CSP, in the template |
| The documents of each app named its APIs, its environments and its decisions by number (`M-003`, `W-001`) | Decision records numbered from 0001 and written for the template |
| A `package-lock.json` made on Windows that failed `npm ci` in the Linux CI | The lock is regenerated on Linux (pitfall 8 of [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#8-common-pitfalls)) |
| No test ran the Functions against anything but a mocked `fetch` | `tests/contract/` runs them against the fake API |

## Known items inherited from the source repositories

- **Cloudflare Pages Functions** are one of two ways to host this on Cloudflare; the newer one is a Worker with static assets ([ADR 0002](docs/adr/0002-cloudflare-pages-functions.md)). Both apps use Pages, and the code in `server/` does not depend on it.
- **The refresh cookie lasts 30 days** (`REFRESH_COOKIE_MAX_AGE` in `server/cookies.ts`) because the API does not tell the Functions how long its refresh token lives. Match it to your API.

## Evolve the template

- On GitHub the repository is marked as a **template repository** (Settings → General). The deploy jobs of `deploy.yml` skip it through `!github.event.repository.is_template`, so only `validate` and `audit` run there.
- Keep it **runnable**, and keep what it **generates** runnable: the `Test the init script` workflow does this on every push and pull request. To reproduce it locally, copy the folder somewhere else, run `npm run init -- --name x-web --login password` (and the other combinations), then `npm ci`, `npm run lint`, `npm run check:ts`, `npm run test:run` and `npm run build`; do it on Linux, like the CI (see the note about the lockfile below).
- When you add a file that only makes sense in the template, add it to `TEMPLATE_ONLY` in `scripts/init.mjs` **and** to the list of the workflow above, or a project will inherit it and the workflow will fail.
- When you add a file that belongs to one login or to the example, add it to `PASSWORD_FILES`, `GOOGLE_FILES` or `EXAMPLE_FILES` in `scripts/init.mjs`.
- Marker comments let `init` customize files. `// @template:login-password:start` … `// @template:login-password:end` wrap the lines of the password login, `login-google` those of the Google login, and `example` the registrations of the example screen (`<!-- … -->` in markdown, `{/* … */}` in JSX). In a table row or a list item, where a block marker would break the markdown, end the line with `<!-- @template:login-google:line -->`: `init` drops the whole line when that option is not chosen and removes only the marker when it is. A marker never goes in the middle of a sentence.
- Placeholders are real values: `my-web-app` and `My Web App`. Do not use them for anything else, because `init` replaces every occurrence.
- A `*.spec.ts` that exists for a login or for the example needs its markers or its place in the lists above, or the generated project fails its own lint and tests.
- Improvements found in a project (a better component, a convention) are ported to the template by hand, with the checks above. Projects do not sync automatically from the template.
- `package-lock.json` is committed so that `npm ci` works in the first CI run. Regenerate it **on Linux** when you change a dependency (pitfall 8 of [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#8-common-pitfalls)). Dependabot runs on Linux, so its pull requests are safe.
