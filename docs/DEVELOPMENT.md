# Development guide

How to work in this repository: setup, commands, step-by-step guides and the pitfalls found on the way. The rules for new code are in [CONVENTIONS.md](CONVENTIONS.md).

## 1. Setup

Requirements: **Node.js 24** (see `.nvmrc`) and npm. Nothing else: the API the app talks to in development is the fake one of this repository.

```bash
npm install
npm run dev
```

`npm run dev` starts three processes, with colored prefixes, and stops all of them when one fails:

| Prefix | Process | Port | What it is |
|---|---|---|---|
| `api` | `node mock-api/server.mjs` | 4010 | The fake API ([ADR 0005](adr/0005-fake-api.md)) |
| `bff` | `wrangler pages dev public` | 8788 | The Functions, run the way Cloudflare runs them |
| `web` | `vite` | 5173 | The app. It proxies `/api` to the Functions |

Open **http://localhost:5173** (not `127.0.0.1`, and not port 8788). <!-- @template:login-password:line -->
Sign in with `demo@example.com` and `demo-password`. <!-- @template:login-password:line -->
The fake sign-in service signs in the demo user at once, with no Google involved. <!-- @template:login-google:line -->

The Functions read `.dev.vars` **when they start**; restart `npm run dev` after changing it. `npm run init` creates it from `.dev.vars.example` with a random `API_KEY`, which the fake API reads from the same file.

To see the session renew itself, give the fake API a short access token and run the other two processes in other terminals: `MOCK_ACCESS_TTL_SECONDS=20 npm run dev:api` in a POSIX shell, or `$env:MOCK_ACCESS_TTL_SECONDS = 20; npm run dev:api` in PowerShell.

## 2. Commands

| Command | What it does |
|---|---|
| `npm run dev` | The fake API, the Functions and Vite together |
| `npm run dev:api`, `dev:functions`, `dev:web` | One of the three |
| `npm run lint` | ESLint, no errors and no warnings |
| `npm run check:ts` | `tsc -b` over the three TypeScript projects |
| `npm run test:run` | Every test once. `npm run test` starts watch mode |
| `npm run build` | `tsc -b` and `vite build`, into `dist/` |
| `npm run preview` | Builds, then serves `dist/` with the Functions on port 8788 |

Before reporting a change as done: `lint`, `check:ts`, `test:run`, `build`. For a visible change, open it in the browser too, at 375, 768 and 1024 px wide: the page itself must not scroll sideways (only a table may, inside its card).

## 3. Connect your API

1. Read [API-CONTRACT.md](API-CONTRACT.md): it lists what the Functions expect.
2. Set `API_URL` (with the version path) and `API_KEY` in `.dev.vars`, and restart `npm run dev:functions`.
   - For the Google login, also set `AUTH_PUBLIC_URL` and `AUTH_CLIENT_ID`, and register `http://localhost:5173/auth/callback` as a redirect URL of the client at the sign-in service. <!-- @template:login-google:line -->
3. Replace the paths of the proxy allowlist (`functions/api/[[path]].ts`) and the resource modules (`src/api/`) with those of your API. A path that is not in the allowlist answers `404`.
4. If the API has no `GET /auth/me`, change `src/auth/probe.ts` to use a cheap authenticated call.
5. Stop the fake API (`dev:api`) and, when nothing needs it, delete `mock-api/`, `tests/contract/` and the script. Keep them while they are useful as a test double.

The development API may lack a route that exists only in a branch of your API. To test it before the deploy, point `API_URL` to your local API and restart the Functions. Never keep a copy of `.dev.vars` in the project (a backup, for example): it holds secrets, and git ignores only the file with that exact name.

## 4. Add a screen

Use the example screen as the model (`src/pages/examples/`, `src/api/examples.ts`, `src/i18n/messages/examples.ts`).

1. **The API module.** `src/api/<resource>.ts`: the types of the API and `createResource({ key, path, orderBy })`. A resource whose routes differ writes its own calls.
2. **The proxy.** Add the path to `ALLOWED_PATHS` in `functions/api/[[path]].ts`, and a case to `tests/bff/proxy.spec.ts` (and the fake API, if you keep it).
3. **The texts.** `src/i18n/messages/<resource>.ts` with both languages, registered in `src/i18n/messages.ts`.
4. **The rules.** The limits of the API in `src/lib/validation.ts`.
5. **The screen.** `src/pages/<resource>/<Resource>Page.tsx` and its form dialog, with `PagedListScreen`, `FormDialog`, `ConfirmDialog` and the toast.
6. **The route and the menu.** A route in `src/App.tsx` and an item in `src/layout/nav-items.ts`.
7. **The tests.** A component test of the flows (see `ExamplesPage.spec.tsx`): list, empty, error, create with a validation error, edit, delete.

## 5. Add a language

1. Add the code to `Language` and `LANGUAGES` in `src/i18n/language.ts`.
2. The compiler lists every `defineMessages` call that misses it. Write the texts.
3. `src/i18n/i18n.spec.ts` checks that the languages have the same keys and placeholders.

## 6. Tests

| Kind | Where | What it covers |
|---|---|---|
| Logic | `src/**/*.spec.ts` | The HTTP client, the resource builder, the session check, the idle rule, the dictionary |
| Components | `src/**/*.spec.tsx` | The login page, the dialogs, the pagination, the example screen, the provider of the session. Testing Library in jsdom |
| Functions | `tests/bff/` | Each Function and the proxy, with a mocked `fetch` |
| Contract | `tests/contract/` | The real Functions against the fake API, with no mock: the whole session, the rotation and the replay, the example resource |
| Repository | `tests/repo/` | Secrets stay out of git, examples hold placeholders, the CSP keeps each directive to the own origin, the workflow keeps its protections |

The tests use invented data only.

### End-to-end check against your API

The automated tests use the fake API. Before a release, or after a change that touches the contract, check the app against the real **development** API, by hand: sign in, open every section, create, edit and delete a record, sign out, and let the access token expire (or shorten its lifetime in the API) to see the refresh. The browser console must show no errors other than the `401` of the session check before the login, and no Content-Security-Policy violation. Logging in and every write go to the development database: say so before running it, and delete the records you create.

## 7. Deployment

A push to `develop` deploys the preview `develop.<project>.pages.dev`; a push to `main` deploys production. Both run `validate` first. Pull requests run `validate` and `audit` only.

One-time setup:

1. **Cloudflare.** Create a Pages project by **Direct Upload** (the deploy is made by `wrangler` from GitHub Actions). Set the variables of the Functions in the project, for **Production** and for **Preview**: `API_URL` and `API_KEY` (as an *encrypted* secret). The preview and production environments can point to different APIs.
   - For the Google login, also `AUTH_PUBLIC_URL` and `AUTH_CLIENT_ID`. <!-- @template:login-google:line -->
2. **Cloudflare API token** with the permission *Cloudflare Pages: Edit* on this one account. One per environment if you want to revoke them independently.
3. **GitHub environments** `dev` and `prd`, each with the variables `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_PAGES_PROJECT` and the secret `CLOUDFLARE_API_TOKEN`. Add required reviewers to `prd`.
4. **Branches** `develop` and `main`, protected: require a pull request and the `validate` check. Feature branches go into `develop` by pull request, then `develop` into `main`, always with a merge commit.
<!-- @template:login-google:start -->
5. **The sign-in service** must list `https://<project>.pages.dev/auth/callback`, the preview address and your own domain, if any, as redirect URLs of the client, exactly.
<!-- @template:login-google:end -->

The settings that only the owner can turn on in GitHub are in [SECURITY.md](SECURITY.md).

## 8. Common pitfalls

1. **A file in `functions/` is a route.** Never put a test, a helper or a type file there: Pages will publish it. Shared code lives in `server/`.
2. **`wrangler pages dev` reads `.dev.vars` only when it starts.** Restart it after a change. It also reads a `.dev.vars` in the folder it is run from, so to run the Functions against a fake API for a smoke test, copy `functions`, `server` and `public` to a folder outside the project and pass placeholder values with `--binding NAME=placeholder`.
3. **Windows: stopping the npm process can leave `wrangler` and `workerd.exe` running on port 8788.** Killing `workerd` is not enough, because its parent `node` process starts it again: end the `node` process of `wrangler` first (find it by `wrangler` and its port in the command line), then its `workerd` children. Do not stop every `workerd`, which would also stop servers you run for other projects. Check that the ports are free.
4. **Ports.** Before starting a server, check what already listens on 4010, 5173 and 8788. Vite uses `strictPort`, so it fails instead of picking another port.
5. **Open the app on `localhost:5173`.** The cookies depend on the host: `127.0.0.1` is another site.
   - The redirect URL registered for the Google login must match the address exactly, so use the same host there. <!-- @template:login-google:line -->
6. **`CF-Connecting-IP` exists only behind Cloudflare.** Locally the fake API sees no IP. Never read `X-Forwarded-For`: the browser can write it.
7. **The CSP is part of the build.** A script from a CDN, a font from Google Fonts or a `style="…"` in markup is blocked in production (and in `npm run preview`) even though it works in `npm run dev`. Check a visible change in the preview too. See [ADR 0004](adr/0004-strict-content-security-policy.md).
8. **Lock file.** Make `package-lock.json` on Linux, where the CI runs. A lock file made on Windows can fail `npm ci` in the Linux CI with `Missing: … from lock file`: the optional WebAssembly packages of Tailwind and rolldown need `@emnapi/*` at the top level, and npm on Windows nests them or drops them. Every `npm install` or `npm uninstall` on Windows can undo a fix, so repeat the recipe after each change of a dependency. Regenerate the lock from a copy that holds only `package.json` and `package-lock.json`: `docker run --rm -v <copy>:/work -w /work node:24-slim npm install --package-lock-only`, then `npm ci --dry-run` in the same container (in Git Bash, set `MSYS_NO_PATHCONV=1`). Do not rebuild the lock from scratch on Windows. Pulling the image is a download: do it deliberately. Dependabot runs on Linux, so its pull requests are safe.
9. **A `503` is not a session problem.** The API being down must never log the user out: only `401` with a code that ends the session does.
10. **TypeScript is on `~5.9.3`.** The configuration is ready for 6 (no `baseUrl`, relative `paths`) and the type check passes on 6.0.3. `typescript-eslint` supports up to `<6.1.0`, so do not go past 6.0 until it does.
11. **Safari does not keep `Secure` cookies on `http://localhost`.** Chrome, Edge and Firefox treat `localhost` as a secure context and do; in Safari the login seems to work and the session never starts. Use another browser for local work, or serve the app over HTTPS.
12. **The code of the Google login works once, and React runs effects twice in development.** `CallbackPage` guards the exchange with a ref. Do not remove it. <!-- @template:login-google:line -->
