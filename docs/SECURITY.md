# Security

The security rules of the project. [CLAUDE.md](../CLAUDE.md) tells the assistant how to apply them; [ARCHITECTURE.md](ARCHITECTURE.md) shows where the app enforces them; [adr/](adr/README.md) explains why.

**This repository may be public.** Anyone can read every file, every commit, every issue and every pull request, forever, and automated scanners read them within minutes. Treat everything you write here as published.

## Design principle: no security by obscurity

The code, the architecture and the endpoints are public by design. Security must hold when an attacker knows everything except the secrets:

- every check runs on the server (the Pages Functions and the API), never only in the browser;
- no hidden URL, header or parameter protects anything;
- the browser is untrusted: the UI hides things for convenience, the servers decide.

## Rules for everything committed or published

These apply to code, tests, fixtures, docs, comments, commit messages, branch names, pull requests, issues, screenshots and logs.

1. **No secrets, ever.** Not in code, examples, tests, comments or history: API keys (`x-api-key` of the API), client secrets, access or refresh tokens, cookies, Cloudflare API tokens, OAuth credentials, passwords, private keys, `.dev.vars` and `.env*` contents.
2. **Placeholders only.** Examples and fixtures use obviously fake values: `example.com`, `replace-with-the-api-key`. Never a real host, account id, project name, client id or email of the development or production environments.
3. **No real personal or business data** in fixtures, screenshots, docs, issues and pull requests. Invent values.
4. **No captured files.** Do not commit HAR files, logs, `dist/`, `.wrangler/`, coverage output, or screenshots that show cookies, tokens, URLs with codes or personal data.
5. **Only the files you intend.** Check `git status` and the diff before every commit. `.dev.vars` and `.env*` are ignored on purpose; never force-add them.

## Rules for the app

6. **No token or key in the browser.** Tokens live only in HttpOnly cookies set by the Functions. The `x-api-key` of the API is a secret of the Functions. Nothing sensitive in JavaScript, `localStorage`, `sessionStorage`, a `VITE_` variable or a URL.
   - The only value in a URL is the single-use login `code` on `/auth/callback`, and the page removes it as soon as it reads it. <!-- @template:login-google:line -->
7. **Cookies:** `__Host-` prefix, `HttpOnly`, `Secure`, `Path=/`, no `Domain`. Session cookies are `SameSite=Strict`.
   - The short-lived login (PKCE) cookie is `SameSite=Lax`, because the return from Google is a cross-site navigation, and it is deleted after use. <!-- @template:login-google:line -->
8. **CSRF:** every `/api` request other than `GET` or `HEAD` needs the same `Origin` and `X-Requested-With`, with the name of the project as the value.
9. **Proxy allowlist:** the Functions forward only the known API paths. Never widen it to "everything". Refuse `.`, `..` and empty segments.
10. **CSP and headers** in `public/_headers`: `default-src 'self'`, no inline script and no inline style (`style-src 'self'`, no `unsafe-inline`), no `data:` image, fonts and assets self-hosted, no framing, `nosniff`, no referrer, no indexing. Do not weaken them to make a change work; report it instead. React sets the styles it needs through the style API of the DOM, which the policy allows.
11. **Login:**
   - The credentials go to the Function and from there to the API; they are never stored or logged, and a refused login sets no cookie. <!-- @template:login-password:line -->
   - The PKCE `code_verifier` and `state` are created by the Functions and kept in the HttpOnly cookie. The `state` is compared before the code is exchanged. Redirect URLs are exact. <!-- @template:login-google:line -->
12. **Errors and logs:** responses carry a generic message and a code. Logs carry an event name and safe fields only: never tokens, cookies, codes, verifiers, keys, passwords, request or response bodies.
13. **Session behavior:** a `503` from the API is not a session problem and never logs the user out; a refused login or code never triggers a refresh; logout and idle logout reach every tab.
14. **Input:** treat every API value as untrusted text when rendering (React escaping only; no `dangerouslySetInnerHTML`). Validate in the browser the same rules the API checks, for the messages; the API checks them again.

## Rules for dependencies and CI

15. **No new dependency without a demonstrated need.** Prefer well-known, maintained packages. Commit `package-lock.json`. Review Dependabot pull requests; read the changelog of a major update.
16. **Workflows use the least privilege.** `permissions: contents: read` by default. Secrets exist only in the `dev` and `prd` GitHub environments and are used only by the deploy jobs, which run on pushes to `develop` and `main`, never on pull requests.
17. **Never use `pull_request_target`** or run code from a fork with secrets. Never print a secret in a workflow log. Use actions from official publishers.
18. **Cloudflare token:** scoped to *Cloudflare Pages: Edit* on one account, one per environment if you want to revoke them independently.

`tests/repo/` checks the rules that a machine can check (secrets, placeholders, the CSP, the workflow). Do not edit a rule there to make a change pass.

## What this design does not give you

- **A real login for the fake API.** `mock-api/` has one demo user and keeps tokens in memory. It is for development, never for a server anyone can reach.
- **Protection against a compromised API or Cloudflare account.** The Functions trust the API and hold its key.
- **A rate limit.** Throttling of the login belongs to the API (the fake one shows how the app reacts to a `429`). Add a Cloudflare rate-limiting rule on `/api/auth/*` if the API has none.
- **Content security for user-provided HTML.** The app never renders HTML from the API. If a screen must, sanitize it with a maintained library and keep the CSP.

## Settings the owner must turn on in GitHub

The assistant cannot change repository settings. Turn these on and keep them on:

- **Secret scanning** and **push protection** (Settings → Code security). Push protection blocks a push that contains a known secret.
- **Dependabot alerts** and **security updates**; the repository already has weekly version updates.
- **Private vulnerability reporting.**
- **Branch protection** for `main` and `develop`: require the `validate` check and a pull request; no force push.
- **Actions → General:** read-only default token permissions; require approval for pull requests from outside collaborators.
- **Environments** `dev` and `prd`: the Cloudflare secrets live here; add required reviewers to `prd`.
- Two-factor authentication on the GitHub and Cloudflare accounts.

## If a secret is exposed

Assume it is already copied, even if you delete it a minute later. In this order:

1. **Revoke or rotate it first.** The API key: change it in the API and update the secret of the Functions. A Cloudflare token: roll it. An OAuth secret: reset it at the provider and in the sign-in service.
2. Check the logs of the services for use of the old value.
3. Only then remove it from the files and, if needed, from the history. Rewriting history does not undo the exposure, and it is done by the owner, never by the assistant.
4. Note what happened and what changed in an [ADR](adr/README.md) if a rule needs to change.
