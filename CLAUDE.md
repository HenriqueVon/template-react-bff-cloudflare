# My Web App — Claude Instructions

How to operate in this repository: a React app with a backend for the frontend (BFF) on Cloudflare Pages Functions. The rules live in `docs/`; this file does not repeat them.

## 1. Read Before Changing Code

- [docs/SECURITY.md](docs/SECURITY.md): **this repository may be public.** Read it before any change.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app is built today.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): how to work here, with commands, step-by-step guides and pitfalls.
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md): the rules new code must follow (MUST / SHOULD / AVOID).
- [docs/API-CONTRACT.md](docs/API-CONTRACT.md): what the Functions expect from the API.
- [docs/adr/](docs/adr/README.md): the decisions behind the foundations. Read them before changing the session, the cookies, the CSP or the deployment.

Read the sections relevant to the task before editing.

## 2. Source of Truth

- **Committed code is the source of truth.** Infer architecture, patterns and conventions from `HEAD`.
- Uncommitted local changes are not official architecture. Do not copy them, document them or treat them as patterns. Consider them only when the user explicitly asks.
- If the local branch is behind or diverged from its remote, report it before making changes. Do not pull, merge, rebase or switch to the remote state unless the user explicitly asks.
- For the API contract, the code of the API wins over its docs and over this app. If they disagree (paths, shapes, status codes, error codes, query parameters), report it; do not work around it silently.
- When the docs and the code disagree, the code wins. Report the mismatch.

## 3. Product Rule

The app shows only real data from the API. A screen the API cannot feed yet says so ("coming soon"); never fill it with sample data. Do not compute what the API does not define. Needs that depend on a change in the API (filters, aggregations, an endpoint) are listed for the owner of the API; do not work around them with large reads in the browser. Do not assume product intent: if the answer is not in `docs/`, ask.

## 4. Security — public repository

Read [docs/SECURITY.md](docs/SECURITY.md); these are the rules to apply on every task:

- **Never write a secret anywhere**: code, tests, fixtures, docs, comments, commit message text, pull request text. Use placeholders (`example.com`, `replace-with-…`). No real host, account id, project name, client id or email of the dev or prod environments.
- **No real personal or business data**, not even in tests, docs or examples. Invent values.
- Never read, print or commit `.dev.vars` or `.env*` contents. Check that a value is set without showing it.
- No token, API key or `client_secret` ever reaches the browser's JavaScript, `localStorage`, a `VITE_` variable or a URL. Tokens live in the HttpOnly cookies set by the Functions.
  - The one exception is the single-use login `code` on `/auth/callback`, removed at once. <!-- @template:login-google:line -->
- Every call goes through `/api` and `apiRequest` (`src/api/client.ts`). Never call the API from the browser.
  - The only browser visit to another service is the redirect that starts the Google login. <!-- @template:login-google:line -->
- A new API path for the app must be added to the allowlist in `functions/api/[[path]].ts` on purpose, with a test. Never widen it to "everything".
- Keep the CSRF check, the cookie attributes and the CSP (`public/_headers`). Do not weaken any of them to make a task or a test pass; report it instead.
- Do not log tokens, cookies, codes, keys, passwords, request bodies or personal values. Logs carry an event name and safe fields only.
- Do not add a dependency, a GitHub Action or a workflow permission without a demonstrated need. Never use `pull_request_target`.
- **Before reporting a change as done**, scan the diff and the new files for secrets and personal data (keys, tokens, JWTs, private keys, emails, real hosts) and say you did. The guardrail test (`tests/repo/guardrails.spec.ts`) must pass; do not edit it to make a change pass.
- If a secret may have been exposed, say so at once and follow [docs/SECURITY.md](docs/SECURITY.md#if-a-secret-is-exposed): the owner revokes it first. Never rewrite history.
- You cannot change GitHub or Cloudflare settings. When a rule needs one ([docs/SECURITY.md](docs/SECURITY.md#settings-the-owner-must-turn-on-in-github)), tell the user.

## 5. Conventions

Follow [docs/CONVENTIONS.md](docs/CONVENTIONS.md). The ones to remember:

- **Structure:** one folder per screen in `src/pages/`; components shared by screens in `src/components/`; one module per resource in `src/api/`. Nothing but routes in `functions/`.
- **Data:** a TanStack Query hook per resource, with its query keys. Mutations invalidate exactly the queries they change. Components never call `fetch`.
- **States:** every screen that loads data shows the loading, empty and error states, with a clear message in the language of the user.
- **Errors:** messages come from `errorMessage` (`src/lib/errors.ts`), by API error code. A `503` is not a session problem.
- **Validation:** check in the browser the same rules the API checks, so the messages are in the language of the user. The API checks them again.
- **Destructive actions:** use a confirmation dialog that says what happens and to what.
- **Language:** every text of the interface comes from the dictionary in `src/i18n/messages/` (`useT()`), written once for both languages. Never write a text of the interface in a component. Numbers and dates go through `useFormat()`. Code, comments and docs are in English.
- **Style:** colors and sizes come from the tokens in `src/index.css`. No `style` attribute in markup, no inline script, no external host: the CSP forbids them.
- **Simplicity:** write boring code for the next developer. No new dependency, abstraction or state library without a demonstrated need.

## 6. Verification

Before reporting a change as done, run and report:

1. `npm run lint`: no errors or warnings.
2. `npm run check:ts`.
3. `npm run test:run`. `npm run test` starts watch mode. A new screen with a form, a dialog or a flow of the user gets a component test (`*.spec.tsx`, with `// @vitest-environment jsdom` at the top).
4. `npm run build`.
5. For a visible change: open it in the browser and check it, on mobile and desktop widths.
6. `git status` and `git diff`: only intended files; no debug code (`console.log`, temporary fields); the secret scan of section 4.

Use only the scripts in `package.json`. "It compiles" is not done.

## 7. Local Environment

- Run it as [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) says: `npm run dev` starts the fake API, the Functions and Vite. Run long-lived servers in the background.
- Before starting a server, check what already listens on ports 4010, 5173 and 8788: the user may have them running. Use those instead of starting copies.
- On Windows, stopping the npm process can leave `wrangler` and `workerd.exe` running on port 8788. End the ones you started when you finish, and not the ones the user runs; the recipe is in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#8-common-pitfalls).
- `wrangler pages dev` reads `.dev.vars` only at startup, and it holds real values when the project points to a real API. Never print it, and never keep a copy of it in the project.
- **Lock file.** Make `package-lock.json` on Linux; a lock file made on Windows can fail `npm ci` in the CI ([docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#8-common-pitfalls), pitfall 8). Pulling the Docker image it needs is a download: ask first.
- Logging in and every create, update or delete write to the database of the API the app points to. Before any test that logs in or changes data against a real environment, ask first and say which environment it is, without credentials.

## 8. Documentation

Update only when the change alters it:

- how the app is built (request path, session, routes, data layer, folders) → `docs/ARCHITECTURE.md`;
- how to run or deploy it → `docs/DEVELOPMENT.md`;
- what the API must provide → `docs/API-CONTRACT.md`, the fake API and the contract test;
- a rule for new code → `docs/CONVENTIONS.md` (or this file);
- a security rule → `docs/SECURITY.md`;
- a decision made → a new record in `docs/adr/`. A decision still open is a decision, not a task: present the options to the user.

At the end of a task, list anything discovered on the way that the next session would trip on (a tooling or deployment gotcha, a rule that turned out to be needed), and where it belongs: a gotcha goes to `docs/DEVELOPMENT.md` section 8. If there is nothing, say so.

## 9. Git and Publishing

- **Before writing any code, check the current branch (`git branch --show-current`). It must be `develop`.** If it is not, stop, report the branch and ask the user to switch. Do not switch, pull or create branches on your own.
- Do not commit, push or create branches. The user does it.
- Do not rewrite history: no force push, rebase or amend. Do not run destructive commands (`reset --hard`, `clean`, `checkout -- <file>`) without explicit authorization.
- Feature branches go into `develop` by pull request, then `develop` into `main`, always with a merge commit.
- Show drafts (pull request text, issues, comments) before publishing them. They may be public: apply section 4 to them too.
- Do not create issues, labels, milestones or project board changes unless the user asks.
- Do not deploy, and do not change the Cloudflare Pages project, its secrets or the repository settings.

## 10. Completion Checklist

- [ ] Scope respected; no unrelated changes
- [ ] No secret, real host, real id or personal data anywhere in the diff (scan done)
- [ ] The security rules of section 4 respected; guardrail test green
- [ ] Conventions respected; the API contract checked in its code
- [ ] lint · type check · tests · build ok (results shown)
- [ ] Diff reviewed; no unintended files
- [ ] Docs updated only where needed; learnings listed with their destination, or "nothing to record"
- [ ] No commit, no push
