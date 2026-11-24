# API contract

What the Functions (the BFF) expect from the API behind `API_URL`. The fake API in `mock-api/` implements all of it in memory, and `tests/contract/` runs the real Functions against it, so the fake and the Functions cannot drift apart without a test failing. Nothing checks your own API: it has to answer the same way, or the Functions change (this file, `mock-api/app.mjs` and `functions/` change together).

The browser never sees this contract: it only talks to `/api` on its own origin ([ARCHITECTURE.md](ARCHITECTURE.md)).

## Conventions

- `API_URL` is the base URL **with its version path** (for example `https://api.example.com/v1/api`). Every route below is relative to it.
- Every request carries `x-api-key: <API_KEY>`. A request without the right key is answered `401` with code `UNAUTHORIZED`.
- Requests and answers are JSON (`Content-Type: application/json`).
- An error has the body `{ "message": string, "code": string }`. A `400` caused by the body or the query also has `issues: [{ "path": string, "message": string, "code": string }]`.
- The proxy forwards a request body of at most **1 MiB** (`MAX_BODY_BYTES` in `server/body.ts`) and answers `413 PAYLOAD_TOO_LARGE` to a larger one without calling the API. Raise it for a route that takes uploads, or stream them.
  - The login, which anyone can reach, accepts at most **16 KiB** (`MAX_AUTH_BODY_BYTES`) and answers the same `413`. <!-- @template:login-password:line -->
  - The Google exchange, which anyone can reach, accepts at most **16 KiB** (`MAX_AUTH_BODY_BYTES`) and answers the same `413`. <!-- @template:login-google:line -->
- The Functions add `Authorization: Bearer <access token>` to every call made for a signed-in user, plus the device of the browser: `X-End-User-IP` (from `CF-Connecting-IP`) and `X-End-User-Agent`. Store them on the session or in an audit log if you want; never trust `X-Forwarded-For`.
- A tokens answer is `{ "accessToken": string, "tokenType": "Bearer", "expiresIn": number, "refreshToken": string }`. `expiresIn` is the lifetime of the access token in seconds; the Functions use it as the lifetime of the access cookie, so the cookie expires with the token.

## Session routes

| Route | Body | Success | Errors the app understands |
|---|---|---|---|
| `POST /auth/login` | `{ email, password }` | `200` tokens | `401 AUTH_INVALID_CREDENTIALS`, `403 FORBIDDEN` (no access to this app), `429` with `Retry-After` | <!-- @template:login-password:line -->
| `POST /auth/exchange-code` | `{ code, codeVerifier, redirectUri }` | `200` tokens | `401 AUTH_CODE_INVALID`, `403 FORBIDDEN`, `429` with `Retry-After` | <!-- @template:login-google:line -->
| `POST /auth/refresh` | `{ refreshToken }` | `200` tokens, with a **new** refresh token | `401 AUTH_TOKEN_INVALID`, `401 AUTH_SESSION_REVOKED`, `403 FORBIDDEN`, `429`, `503` |
| `POST /auth/logout` | `{ refreshToken }` | `204`, also when the session is already over | none: the app always leaves |
| `POST /auth/logout-all` | `{ refreshToken }` | `204`: every session of the user ends | `401 AUTH_TOKEN_INVALID` |
| `GET /auth/me` | none (Bearer) | `200 { id, name, email }` | `401 AUTH_TOKEN_EXPIRED`, `401 AUTH_TOKEN_INVALID`, `403 FORBIDDEN` |

What each one has to guarantee:

- **Refresh rotates the token.** The answer carries a new refresh token and the old one stops working. Using a replaced token again means it leaked: the API answers `401 AUTH_SESSION_REVOKED` and ends the whole session. This is why the browser makes sure that only one refresh runs at a time, across tabs ([ADR 0003](adr/0003-one-refresh-at-a-time.md)).
- **Logout ends the whole session of the token it receives, even a token that was already replaced.** The browser waits for a refresh in progress before it logs out, but two requests can still cross on the way to the API (a refresh from a tab that has no Web Locks, a retry). If logout revoked only the token it was given, a refresh that was answered a moment earlier would leave a valid token in the browser after the user signed out. Revoking the session closes that, whatever the order.
- **`GET /auth/me`** is how the app learns who is signed in and whether the session works. An expired access token must be told apart from an invalid one: `AUTH_TOKEN_EXPIRED` makes the app refresh and retry; any other `401` ends the session. An API without such a route can use another cheap authenticated call: only `src/auth/probe.ts` changes, and the user menu shows no name until it has one.
- **A `403`** means the session is valid but this user has no access to this app. The app shows "no access" and does not log the user out.
- **`429` and `5xx`** are temporary. The app keeps the session and shows a message (with the wait, from `Retry-After`).
<!-- @template:login-google:start -->

### The Google login

The browser does not call the API for this. The Function `GET /api/auth/google/start` redirects it to the **sign-in service** (`AUTH_PUBLIC_URL`, which can be the API itself):

```
GET <AUTH_PUBLIC_URL>/v1/api/auth/google
    ?client_id=<AUTH_CLIENT_ID>
    &redirect_uri=<origin of the app>/auth/callback
    &state=<random>
    &code_challenge=<base64url(SHA-256(verifier))>
    &code_challenge_method=S256
```

The service sends the user to Google and, when the user comes back, redirects the browser to `redirect_uri?code=<code>&state=<state>` (or `?error=<reason>&state=<state>`). Then the Function `POST /api/auth/exchange` calls `POST /auth/exchange-code` with the `code`, the `codeVerifier` it kept in the PKCE cookie and the same `redirectUri`. The service must:

- compare `redirect_uri` with the redirect URLs registered for the client **exactly** (scheme, host, port, path, no query), and refuse any other;
- return `state` unchanged;
- bind the code to the `code_challenge` and the `redirect_uri`, accept it once, and check `SHA-256(codeVerifier)` against the challenge on the exchange.

The fake API does all of this for the demo user, without Google, so the whole flow runs locally.
<!-- @template:login-google:end -->
<!-- @template:example:start -->

## The example resource

`/examples` is the reference resource ([src/api/examples.ts](../src/api/examples.ts)). It follows the shape of the `example` module of the API template, so the two fit. A resource of your own follows the same five routes, and `createResource` builds its calls and hooks.

| Route | Body or query | Success | Errors |
|---|---|---|---|
| `GET /examples` | `limit` (1 to 100), `offset`, `orderBy` (`id`, `name`, `createdAt`), `orderDirection` (`asc`, `desc`) | `200 { items: Example[], total }` | `400` with `issues` |
| `POST /examples` | `{ name: string (3 to 100), description?: string \| null (at most 255) }` | `201 Example` | `400` with `issues`, `409 CONFLICT` when the name exists |
| `GET /examples/:id` | none | `200 Example` | `404 NOT_FOUND` |
| `PATCH /examples/:id` | the same fields, all optional, at least one | `200 Example` | `400`, `404`, `409` |
| `DELETE /examples/:id` | none | `204` | `404` |

`Example` is `{ id, name, description, createdAt, updatedAt }`, with the dates as ISO strings.
<!-- @template:example:end -->

## Error codes the app has a message for

- The session: `AUTH_TOKEN_EXPIRED`, `AUTH_TOKEN_INVALID`, `AUTH_SESSION_REVOKED`, `AUTH_SESSION_MISSING`.
- The password login: `AUTH_INVALID_CREDENTIALS`. <!-- @template:login-password:line -->
- The Google login: `AUTH_CODE_INVALID`, `LOGIN_STATE_INVALID`. <!-- @template:login-google:line -->
- The rest: `FORBIDDEN`, `CSRF_REJECTED`, `API_UNAVAILABLE`, `BFF_MISCONFIGURED`, `METHOD_NOT_ALLOWED`, `PAYLOAD_TOO_LARGE`, `NETWORK_ERROR`, `NOT_FOUND`, `CONFLICT`.

`CSRF_REJECTED`, `API_UNAVAILABLE`, `BFF_MISCONFIGURED`, `METHOD_NOT_ALLOWED`, `PAYLOAD_TOO_LARGE` and `NETWORK_ERROR` are produced by the Functions or the browser; the others are the answers of your API. Any other code falls back to the message of its status (`src/lib/errors.ts`, `src/i18n/messages/errors.ts`). The app never shows the raw message of the server.

## Changing the contract

1. Change this document.
2. Change `mock-api/app.mjs` and `mock-api/app.d.mts`.
3. Change the Functions (`functions/`, `server/`) and, if the browser needs it, `src/api/`.
4. Run `npm run test:run`: `tests/contract/` fails when the Functions and the fake API disagree.
5. Add a new route to `server/routes.ts` **on purpose**, with the methods the API defines for it and a test in `tests/bff/routes.spec.ts`: the proxy never forwards "everything", and never a method the route does not accept.
