# Architecture

How the app is built today. Why it is built this way is in [adr/](adr/README.md); what the API must provide is in [API-CONTRACT.md](API-CONTRACT.md); the security rules are in [SECURITY.md](SECURITY.md).

## 1. Parts

```
┌─────────────── browser ───────────────┐      ┌──── Cloudflare Pages ────┐      ┌──── API ────┐
│ React SPA (src/)                       │      │ Functions (functions/,   │      │ /v1/api/*   │
│  screen → hook → apiRequest            │─────▶│ server/)                 │─────▶│             │
│  no token or key in JavaScript         │ /api │ adds x-api-key + Bearer  │      │ API key +   │
│  cookies sent by the browser (HttpOnly)│◀─────│ sets and clears cookies  │◀─────│ Bearer token│
└────────────────────────────────────────┘      └──────────────────────────┘      └─────────────┘
```

- **SPA** (`src/`): Vite, React, React Router, TanStack Query and Tailwind. Built into `dist/` and served as static files.
- **Functions** (`functions/` and `server/`): Cloudflare Pages Functions, the backend for the frontend (BFF). They own the tokens and the API key ([ADR 0001](adr/0001-bff-with-httponly-cookies.md)).
- **API**: a separate project. What the Functions expect from it is in [API-CONTRACT.md](API-CONTRACT.md).
- **Fake API** (`mock-api/`): the stand-in for development, tests and CI ([ADR 0005](adr/0005-fake-api.md)).

The page and `/api` share one origin, so there is no CORS.

## 2. A request, end to end

1. **Screen** calls a hook, for example `useExamplePage(page)` (`src/api/examples.ts`).
2. **Hook** owns the cache key and calls `apiRequest`. `createResource` (`src/api/resource.ts`) builds the calls and hooks of a resource that follows the five usual routes.
3. **HTTP client** (`src/api/client.ts`) calls `GET /api/examples?limit=20&offset=0&…`, sending `X-Requested-With: my-web-app` and the cookies. It never adds a token.
4. **Proxy** (`functions/api/[[path]].ts`) refuses a cross-site write, refuses `.`, `..` and empty segments and any path outside the allowlist (`server/routes.ts`) with `404`, refuses a method that the route does not accept with `405` and an `Allow` header, returns `401 AUTH_TOKEN_EXPIRED` when the access cookie is missing, refuses a body larger than 1 MiB with `413`, and forwards method, query, body and `Content-Type`.
5. **API call** (`server/upstream.ts`) adds `x-api-key` and `Authorization: Bearer <access cookie>`, plus the device of the browser. A network failure or a timeout (10 seconds) becomes `503 API_UNAVAILABLE`; a missing variable becomes `500 BFF_MISCONFIGURED`, logged by name only.
6. **Response** goes back unchanged, keeping only `Content-Type` and `Retry-After`, with `Cache-Control: no-store`. A `Set-Cookie` of the API is never passed on.
7. **In the browser** a non-2xx response becomes an `ApiError` (status, `code`, `retryAfter`, validation `issues`), and the screen shows it with `errorMessage`, by code, in the language of the user.

## 3. Session

| Moment | What happens |
|---|---|
| **First load** | `AuthProvider` asks `GET /auth/me` (`probeSession`). `200` means signed in, and gives the user; a `401` that survives the refresh shows the login; a `403` shows "no access"; a `429`, `503` or network failure shows "unavailable" with a retry button, and the user stays signed in. A last activity older than 30 minutes logs out instead of opening the app. |
| **Login (password)** | `LoginPage` → `login()` → `POST /api/auth/login` (`functions/api/auth/login.ts`). On success the Function sets both cookies and returns only `expiresIn`; the provider clears the query cache and checks the session. A refused login throws the `ApiError`, and the page shows it by code (wrong credentials, wait before trying again). | <!-- @template:login-password:line -->
| **Login (Google)** | `LoginPage` → `startLogin()` → the browser goes to `GET /api/auth/google/start`, which creates the PKCE verifier and the state, keeps both in the `__Host-app_pkce` cookie (HttpOnly, `SameSite=Lax`, 10 minutes) and redirects to the sign-in service. The service sends the browser back to `/auth/callback?code&state`. `CallbackPage` removes them from the URL at once, runs **once** (the code works once, and React runs effects twice in development) and calls `POST /api/auth/exchange`, which compares the state with the cookie, exchanges the code with the verifier, sets the session cookies and deletes the PKCE cookie on every outcome. The page the user wanted is kept in `sessionStorage`, in this tab only, and `safeReturnPath` accepts only a path of this app. The callback is a route of the SPA and not a Function that redirects, so the navigation after the login starts from the app's own page and the `SameSite=Strict` cookies are sent. | <!-- @template:login-google:line -->
| **Access token expired** | `401 AUTH_TOKEN_EXPIRED` makes `apiRequest` call `refreshSession()` once and retry. Only one refresh runs at a time: tabs share it through a promise and `navigator.locks`, and a logout takes the same lock ([ADR 0003](adr/0003-one-refresh-at-a-time.md)). |
| **Other 401s** | `AUTH_TOKEN_INVALID`, `AUTH_SESSION_REVOKED` and `AUTH_SESSION_MISSING` do not refresh: the session is over and the login is shown with a message. A refresh that fails for a temporary reason (`429`, `503`, network) is thrown to the screen and never ends the session. |
| **403** | `FORBIDDEN` shows "no access", not the login. |
| **Logout** | `POST /api/auth/logout` revokes the session and clears the cookies; the Function always answers `204`. If the request never reaches the Function (no connection), the cookies are still valid and JavaScript cannot clear them, so the session is **kept** and the screen says so, instead of showing a login page that a reload would bypass. "Sign out of all devices" calls `/api/auth/logout-all` after a confirmation and clears the cookies only on success. |
| **Idle** | After 30 minutes without interaction in any tab, with a warning in the last minute, the app logs out. The last-activity time is shared by every tab in `localStorage`. The screen closes even when the logout cannot be sent (the user is away); the idle time is still over when the app opens again, so the logout is sent then. |
| **Other tabs** | A logout is posted on a `BroadcastChannel`; the other tabs clear their cache and show the login. |

## 4. Routes

```
/login                  LoginPage
/                       HomePage
*                       NotFoundPage (inside the shell)
```

<!-- @template:login-google:start -->
`/auth/callback` is `CallbackPage`, the return from Google; it sits outside the shell, like the login.

<!-- @template:login-google:end -->
<!-- @template:example:start -->
`/examples` is `ExamplesPage`, the reference screen.

<!-- @template:example:end -->

Everything except the login routes sits inside `RequireAuth` and `AppShell`. The sections of the menu are listed once, in `src/layout/nav-items.ts`, which feeds the side menu, the bottom bar of the phone, the title of the top bar and the title of the page. On a phone the sections marked `mobile` fill the bottom bar and the others open from "More".

## 5. Screens

A screen is a folder in `src/pages/<name>/` made of a few shared blocks and its own explicit code, with no configuration object that builds the page:

- `PagedListScreen`: the header with the create button, the choice of table or cards (`ViewToggle`, kept in this browser), the pages, and the loading, error and empty states. The API pages the list and the screen shows one page at a time; the previous page stays visible, dimmed, while the next one loads.
- `FormDialog` (create and edit, in a modal) with `TextField` and `TextAreaField`, which tie the label, the control and the message together for screen readers. A failed validation moves the focus to the first field with an error.
- `ConfirmDialog` for deletes, and the toast (`useToast`) for the message after a success.
- `useRecordDialogs`: which dialog is open and for which record.

How a screen writes: the fields are checked in the browser with the limits of the API (`src/lib/validation.ts`); an edit sends only the fields that changed (`changedFields`); a `409` is explained by the operation (`saveErrorMessage`).

## 6. Data layer

- One module per resource in `src/api/`, with its types, query keys and hooks. Types mirror the API.
- Query client (`src/App.tsx`): data fresh for 30 seconds, no refetch on window focus, one retry except on a 4xx, mutations never retried.
- Every change invalidates what the resource cached, so the screen shows what was saved.
- Money, dates and numbers of your domain go through helpers in `src/lib/` and `src/i18n/use-format.ts`, never formatted by hand in a screen.

## 7. Languages

The interface is in English or Portuguese (pt-BR), chosen by the user. `src/i18n/` holds the layer: `messages/` has the dictionary in areas, each written for both languages with `defineMessages` (a key missing in one language does not compile), `I18nProvider` keeps the language (the one saved in this browser, else the one of the browser, else English) and the `lang` of the page, and `useT()` and `useI18n()` give `t(key, params)` and `tx(key, nodes)` (for a text with an element inside, such as a name in bold). Helpers outside React receive `t` (`errorMessage`, `validateText`), and `createTranslator(language)` gives one to the tests. `src/i18n/i18n.spec.ts` checks that both languages have the same keys and placeholders.

## 8. Folders

```
functions/api/        auth/login.ts, auth/google/start.ts, auth/exchange.ts, auth/refresh.ts, auth/logout.ts,
                      auth/logout-all.ts, [[path]].ts (the proxy)
server/               code the Functions share; not routed by Pages
  upstream.ts         Env, callApi, passThrough, jsonResponse
  cookies.ts          Cookie names, attributes, set, clear, read (session and PKCE)
  security.ts         The CSRF check
  session.ts          Responses for a successful or refused login or refresh
  pkce.ts, login.ts   PKCE, state and the redirect_uri of the Google login
mock-api/             The fake API (app.mjs, server.mjs) and its types
src/                  main.tsx, App.tsx (providers and routes), index.css (tokens, fonts), app-info.ts (the name)
  api/                client.ts, pagination.ts, resource.ts (createResource), one module per resource
  auth/               AuthProvider, auth-context, RequireAuth, probe, callback and return-path parsing, idle and
                      IdleWatcher, session-channel
  layout/             AppShell, SideNav, BottomNav, TopBar, UserMenu, nav-items
  components/         Button, Card, PageHeader, Modal, ConfirmDialog, FormDialog, fields, states, DataList,
                      PagedListScreen, Pagination, ViewToggle, ToastProvider, record-dialogs
  lib/                errors, storage, validation, changed-fields
  i18n/               the language layer and the dictionary
  pages/              LoginPage, CallbackPage, HomePage, NoAccessPage, UnavailablePage, NotFoundPage, one folder per screen
tests/bff/            the Functions, with a mocked fetch
tests/contract/       the Functions against the fake API, with no mock
tests/repo/           guardrails for a repository that may be public
e2e/                 Playwright: the app in a real browser, with the real headers and the fake API
public/               _headers (CSP, security headers, caching), robots.txt, favicon
.github/              CI, Dependabot, pull request template
```

Tests and helper code stay out of `functions/`, because Pages turns every file there into a route.

## 9. Security layers

| Layer | Where | What it does |
|---|---|---|
| Cookies | `server/cookies.ts` | `__Host-` prefix, HttpOnly, Secure, `Path=/`; session `SameSite=Strict` |
| CSRF | `server/security.ts` | Writes need the same `Origin` and `X-Requested-With` |
| Allowlist | `server/routes.ts`, `functions/api/[[path]].ts` | Only the listed paths, each with its own methods; no path traversal; a request body of at most 1 MiB |
| Secrets | Pages environment | `API_KEY` exists only in the Functions |
| Headers | `public/_headers` | CSP `'self'` for every directive (no `unsafe-inline`, no `data:`; checked by `tests/repo/csp.spec.ts`), HSTS, no framing, `nosniff`, no referrer, no indexing |
| Guardrails | `tests/repo/` | `.dev.vars` ignored, examples hold placeholders, no secret patterns in tracked files, no secret in a `VITE_` variable |
| Idle logout | `src/auth/` | Logout after 30 minutes without interaction, in every tab |
| Responses | `passThrough`, `jsonResponse` | `Cache-Control: no-store`; only `Content-Type` and `Retry-After` are passed on; never `Set-Cookie` |
| Browser | `src/` | No token or key in JavaScript, storage or URLs; React escaping only; the return path and the callback parameters are validated before use |

The API still checks everything itself: the key, the token and the input. The checks of the app are a second line, never the only one ([SECURITY.md](SECURITY.md)).

## 10. Build, type check and tests

- `npm run build` runs `tsc -b` and then `vite build`. It writes `dist/`: `index.html`, hashed assets and the files of `public/`.
- TypeScript projects, referenced by `tsconfig.json`: `tsconfig.app.json` (`src/`, for the browser), `tsconfig.functions.json` (`functions/`, `server/`, `tests/bff`, `tests/contract`, with the Workers types) `tsconfig.node.json` (the config files and `tests/repo`) and `tsconfig.e2e.json` (`e2e/` and `playwright.config.ts`, with the DOM types for the code that runs in the page).
- Vitest runs `tests/**/*.spec.ts`, `src/**/*.spec.ts` and `src/**/*.spec.tsx`. The logic and the Functions run in Node. A **component test** (`*.spec.tsx`) renders the component with Testing Library in jsdom: it starts with the comment `// @vitest-environment jsdom`, so the other tests keep running in Node. `tests/setup-dom.ts` cleans the document after each test, saves English as the language and gives jsdom the `showModal` and `close` of the native `<dialog>` that `Modal` uses. The tests look for what the user sees (labels, roles, messages), not for the structure.
- **End-to-end tests** (`e2e/`, `npm run test:e2e`) drive a real browser (Playwright, with the Chrome of the machine) against the build served by the Functions with the real headers and the fake API behind them, which is where the CSP, the cookies, the refresh between tabs and the layout are decided. They are not part of `npm run test:run`: they need a browser and two free ports, and the CI runs them as their own job before the deploy.
- Locally, `wrangler pages dev` runs the Functions on port 8788, and Vite on 5173 proxies `/api` to it. On Cloudflare Pages, the same `dist/` and `functions/` are deployed together, by the GitHub Actions workflow after lint, type check, tests and build pass.

## 11. Environment variables

| Name | Where | Kind | Meaning |
|---|---|---|---|
| `API_URL` | Functions | variable | Base URL of the API, with its version path |
| `API_KEY` | Functions | **secret** | `x-api-key` of the API |
| `AUTH_PUBLIC_URL` | Functions | variable | Base URL of the sign-in service, without the version path; where the browser starts the login | <!-- @template:login-google:line -->
| `AUTH_CLIENT_ID` | Functions | variable | Public client id of this app at the sign-in service | <!-- @template:login-google:line -->

Locally they come from `.dev.vars`; in Cloudflare, from the project's variables and encrypted secrets. No `VITE_` variable holds a secret.
