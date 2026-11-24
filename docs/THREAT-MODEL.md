# Threat model

What the design protects, from whom, how, and what it leaves to others. It is short on purpose: each row points to the code that does the work and to the test that fails if it stops. The rules to follow when writing code are in [SECURITY.md](SECURITY.md); the reasons for the choices are in [adr/](adr/README.md).

## Assets

| Asset | Why it matters |
|---|---|
| The session of a user (access and refresh tokens) | Anyone who holds it acts as the user, for weeks if the refresh token leaks |
| The API key of the app | It identifies the app to the API. A leaked key lets anyone call the API as this app |
| The data the API returns to a signed-in user | The point of the app |
| The integrity of what the user sends | A forged request must not change data on behalf of the user |

## Actors and trust boundaries

```
 user's browser ──(1)──▶ Cloudflare edge: static files + Functions ──(2)──▶ the API
   ▲  scripts of the page are                the BFF: holds the tokens                 holds the data and
   │  not fully trusted                      and the key                               the real rules
   └─ pages of other sites, extensions
```

1. **Browser to Functions.** The browser is untrusted: it can be driven by a script injected into the page, or by another site that tricks the user into a request. The Functions trust nothing it sends except the cookies they set themselves.
2. **Functions to API.** The Functions are trusted and hold the key. The API trusts the key and the token and still validates everything.

Out of scope: a compromised device, browser or extension of the user; a compromised Cloudflare or GitHub account; a breach of the API.

## Threats and mitigations

| # | Threat | Mitigation | Where | Fails if it breaks |
|---|---|---|---|---|
| 1 | A script injected into the page **steals the tokens** | Tokens only in `__Host-` HttpOnly cookies; none in JavaScript, storage or URLs. React escaping only; no `dangerouslySetInnerHTML` | `server/cookies.ts`, `src/` | `tests/bff/*`, `tests/contract/` (no token in any body), `tests/repo/guardrails.spec.ts`, `e2e/security.spec.ts` (what a script of the page can see) |
| 2 | The same script **makes requests as the user** | Not preventable by cookies. Limited by the CSP (no inline script, no external host to send data to) and by the API, which checks every call | `public/_headers` | `tests/repo/csp.spec.ts`, `e2e/security.spec.ts` (no violation in a real browser) |
| 3 | **CSRF**: another site sends a write with the user's cookies | `SameSite=Strict`; a write needs the same `Origin` and a custom header, which a cross-site form cannot set and a cross-site `fetch` cannot send without a preflight the Functions never allow | `server/security.ts` | `tests/bff/proxy.spec.ts`, `login.spec.ts`, `e2e/security.spec.ts` |
| 4 | A **subdomain** or an insecure page overwrites the cookies | `__Host-` prefix: `Secure`, `Path=/`, no `Domain` | `server/cookies.ts` | `tests/bff/session.spec.ts` (exact `Set-Cookie`) |
| 5 | The proxy becomes an **open proxy** (any path, any method, a path that climbs) | An allowlist of routes with their methods; `.`, `..` and empty segments refused; each segment encoded; the base URL is fixed on the server; redirects are not followed | `server/routes.ts`, `functions/api/[[path]].ts`, `server/upstream.ts` | `tests/bff/proxy.spec.ts`, `routes.spec.ts`, `e2e/security.spec.ts` |
| 6 | A **refresh token is stolen** and replayed | The API rotates it and ends the session when a replaced one is used again; the cookie is `Strict` and HttpOnly | the API, `functions/api/auth/refresh.ts` | `tests/contract/` (the replay ends the session) |
| 7 | **Two refreshes at once** end the session of an honest user | One refresh at a time inside a tab and, with Web Locks, across tabs | `src/api/client.ts`, [ADR 0003](adr/0003-one-refresh-at-a-time.md) | `src/api/client.spec.ts`, `e2e/session.spec.ts` (two tabs, a slow refresh, a real browser) |
| 8 | **OAuth code interception** or login CSRF (Google login) | PKCE with S256; the verifier and the `state` are created by the Functions and kept in an HttpOnly `Lax` cookie; the `state` is compared before the exchange; a code works once; redirect URLs are exact | `functions/api/auth/google/start.ts`, `exchange.ts` | `tests/bff/google.spec.ts`, `tests/contract/` |
| 9 | The **API key leaks** | Only in the environment of the Functions; never in a `VITE_` variable, the bundle or a response; guardrails and secret scanning | `server/upstream.ts`, `.dev.vars` | `tests/repo/guardrails.spec.ts` |
| 10 | **Clickjacking** | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | `public/_headers` | `tests/repo/csp.spec.ts`, `e2e/security.spec.ts` |
| 11 | **Authenticated data stays in a cache** (browser, proxy, CDN) | `Cache-Control: no-store` on every Function answer and on proxied responses; only `/assets/*`, which hold no data, are cached | `server/upstream.ts` | `tests/bff/proxy.spec.ts` |
| 12 | **Information leaks** through errors or logs | Generic messages with a code; the raw message of the server is never shown; logs carry an event name and safe fields, never tokens, cookies, codes, passwords or bodies | `src/lib/errors.ts`, `server/session.ts` | `tests/bff/*` (the logs are checked) |
| 13 | A **huge body** or a slow API exhausts the Function | Request bodies over 1 MiB (16 KiB for the login and the Google exchange, which anyone can reach) are refused with `413` before they are parsed or the API is called; calls to the API time out after 10 seconds | `server/body.ts`, `server/upstream.ts`, `functions/api/auth/login.ts`, `exchange.ts` | `tests/bff/proxy.spec.ts`, `login.spec.ts`, `google.spec.ts` |
| 14 | The user **thinks they signed out** while the session lives (offline logout, a closed tab) | A logout that does not reach the Functions keeps the session and says so; the idle logout closes the screen and sends the logout when the app opens again. A logout waits for a refresh in progress (it takes the same lock), so the late answer of that refresh cannot set cookies after the logout cleared them | `src/api/client.ts`, `src/auth/AuthProvider.tsx` | `src/auth/AuthProvider.spec.tsx`, `src/layout/UserMenu.spec.tsx`, `src/api/client.spec.ts`, `e2e/session.spec.ts` (offline; a logout during a slow refresh) |
| 15 | **Brute force** of the login | The API limits attempts and answers `429` with `Retry-After`; the app shows when to try again and does not retry | the API | `src/pages/LoginPage.spec.tsx` |
| 16 | A **compromised dependency or workflow** | Lock file; Dependabot; CodeQL; `npm audit` in CI; least-privilege workflows; secrets only in the `dev` and `prd` environments and never on pull requests; no `pull_request_target` | `.github/` | `tests/repo/guardrails.spec.ts` |

## Residual risks

- **A script in the page can still act as the user** (threat 2). The CSP makes it harder to inject one and to send data out; the API must authorize every action and, for sensitive ones, ask again (a password, a code).
- **No rate limit in the Functions.** Throttling belongs to the API; add a Cloudflare rate-limiting rule on `/api/auth/*` if it has none.
- **Browsers without Web Locks** can race two tabs on a refresh (threat 7), or a logout against a refresh (threat 14). The API's reuse detection then ends the session of that user, and an API whose logout ends the whole session ([API-CONTRACT.md](API-CONTRACT.md)) leaves at worst a cookie that no longer works. Rare, and recoverable by logging in.
- **The tests run in Chrome, and in Firefox for the session and security specs** (a separate CI job). **WebKit is not covered**: Safari does not keep a `Secure` cookie on `http://localhost`, so the specs would fail for a reason that is not in the code. Web Locks and `BroadcastChannel` exist in Safari, but nothing here proves them there.
- **GitHub Actions are pinned to a version tag, not to a commit hash.** A moved tag could change what runs. Pin them to a hash if the repository holds a valuable secret.
- **The fake API is not secure** and must never face the internet ([ADR 0005](adr/0005-fake-api.md)).
- **The refresh cookie lasts 30 days** because the Functions cannot read the lifetime of the token; the API enforces the real one.

## What the API has to do

The app is a second line of defense, never the only one. The API must: check the key and the token on every call; authorize each action for that user; validate every input; rotate refresh tokens and detect reuse; limit login attempts; keep an audit log; and answer the codes of [API-CONTRACT.md](API-CONTRACT.md).

## Keeping this document true

When a change adds a route, a cookie, a header, a dependency with network access or a new way to sign in, add or change a row, and the test that proves it. A row without a test is a promise, and should say so.
