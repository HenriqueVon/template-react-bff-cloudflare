# 0001. A backend for the frontend keeps the tokens in HttpOnly cookies

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

A single-page app that signs users in needs somewhere to keep the access token and the refresh token. Anything JavaScript can read can be stolen by one cross-site scripting bug, in the app or in any dependency of it, and a refresh token lasts for weeks. The API also has a key that identifies the app, and a key shipped in the bundle is public.

## Decision

JavaScript in the page never holds, reads or sees a token or the API key: the browser keeps the tokens only in cookies that scripts cannot read. A thin **backend for the frontend (BFF)**, a set of Functions on the same origin as the page, signs the user in with the API, keeps the tokens in `__Host-` cookies that are `HttpOnly`, `Secure` and `SameSite=Strict`, and forwards each call to the API adding the key and the access token as a Bearer token. Answers carry no token. State-changing requests need the same `Origin` and a custom header, and only paths of an allowlist are forwarded.

## Alternatives considered

- **Tokens in `localStorage` or `sessionStorage`.** Simple, and the standard in many tutorials, but readable by any script that runs in the page. One XSS bug exposes a session that lasts for weeks.
- **Tokens in memory, refresh token in a cookie.** Better, but the access token is still readable in the page, and the API key would still need a home.
- **Calling the API directly from the browser.** No server of our own, but it exposes the key, needs CORS on the API and still leaves the token problem.
- **A server-rendered framework** (Next.js, Remix). It solves the same problem and more, at the price of a different programming model and a server runtime to host. The SPA plus a few Functions is the smaller piece.

## Consequences

- An XSS bug can still make requests as the user while the page is open, but it cannot take the session away, and the key never leaks.
- The app needs the Functions to run, also in development: `npm run dev` starts them next to Vite, and the browser talks to one origin, so there is no CORS.
- Every new API path is added to the allowlist on purpose. That costs a line and a test, and it keeps the app from becoming an open proxy.
- The cookies expire with the tokens: the access cookie has the lifetime of the access token, so a missing cookie means "refresh". The refresh cookie lasts as long as the refresh token of the API, which the Functions cannot read; the API enforces the real lifetime.
- The CSRF defense relies on `SameSite=Strict`, the check of `Origin` and a header a cross-site form cannot set. It does not replace the checks of the API.
