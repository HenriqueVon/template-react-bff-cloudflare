# 0003. Only one refresh of the session runs at a time, across tabs

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The access token is short-lived. When it expires, the app trades the refresh token for a new pair. An API that **rotates** refresh tokens gives a new refresh token each time and ends the whole session when a replaced one is used again, because that means it leaked. Two calls that get `401` at the same moment, or two tabs of the same browser, would each try to refresh with the same cookie: the second one would present a replaced token and end the session of a user who did nothing wrong.

## Decision

Refreshing is serialized: inside a tab, every call that finds the token expired waits for the same promise (`refreshSession` in `src/api/client.ts`); across tabs, the refresh runs inside a Web Lock (`navigator.locks`), so the second tab waits for the first and then sends the cookie that the first one set. Only a `401 AUTH_TOKEN_EXPIRED` refreshes, once per call, and a refresh that fails for a temporary reason (`429`, `5xx`, network) is thrown to the screen without ending the session.

## Alternatives considered

- **Refresh before the token expires, on a timer.** It narrows the window but does not close it, and it keeps a session alive in a tab nobody uses, against the idle logout.
- **Let the BFF refresh on the fly.** The Function that finds the access cookie missing could refresh before forwarding. It removes the logic from the browser, but concurrent requests still race, and Functions share no memory to lock on. A lock in the browser is where the race can be closed.
- **An API that tolerates a replaced token for a few seconds.** A reasonable choice on the API side (a grace window), which makes this less critical, but the app cannot assume it.

## Consequences

- Rotation with reuse detection works for users with several tabs open, and a stolen refresh token is still detected.
- `navigator.locks` is widely available; without it the code falls back to the promise inside the tab, and two tabs can race. That is accepted for the few browsers without it.
- The refresh cookie is `SameSite=Strict`, so a refresh made from a cross-site navigation does not send it. The app starts from its own page after a login for that reason (the callback is a route of the SPA, not a redirect from a Function).
- `tests/contract/` proves the rotation and the replay against the fake API; `src/api/client.spec.ts` proves the single refresh for many calls.
