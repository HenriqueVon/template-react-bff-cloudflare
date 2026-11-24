# 0004. A strict Content-Security-Policy, with no inline script or style

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

Cookies that scripts cannot read ([ADR 0001](0001-bff-with-httponly-cookies.md)) do not stop a script from making requests as the user. The browser can be told to run only the code the app ships, which limits what an injected script can do and where it can send data.

## Decision

`public/_headers` sends a policy where every directive is the own origin: `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `img-src 'self'`, `font-src 'self'`, `connect-src 'self'`, with `object-src 'none'`, `base-uri 'self'`, `form-action 'self'` and `frame-ancestors 'none'`. No `unsafe-inline`, no `unsafe-eval`, no `data:`, no other host. The fonts are self-hosted (`@fontsource`), the icons are SVG components, and the page has no inline script, style or event handler. `tests/repo/csp.spec.ts` and `tests/repo/guardrails.spec.ts` fail if a directive is loosened.

## Alternatives considered

- **A permissive policy that allows what the code needs** (`'unsafe-inline'` for styles, a CDN for fonts). Easier to start, but it grows until it protects nothing, and each exception is a place to inject.
- **Nonces or hashes for inline code.** Needs the server to render the page, which a static SPA does not have. Not needed when there is no inline code.
- **No policy.** The default of most templates. It leaves the browser free to run anything an injection brings.

## Consequences

- Tailwind builds a CSS file, which `style-src 'self'` allows. React sets a style (the size of a spinner, the columns of the bottom bar) through the style API of the DOM, which the policy also allows; an `style="…"` attribute written in the markup or in `index.html` would not be.
- A new font, a script from a CDN, an analytics snippet or an embedded video needs a deliberate change of the policy and of its test, with a reason. The first answer is to self-host it.
- A library that injects inline styles or uses `eval` does not work. Check it before adopting it.
- The policy covers pages served by Pages. The Functions answer JSON, which a browser does not execute.
