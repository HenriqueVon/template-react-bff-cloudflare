# 0002. The backend for the frontend runs as Cloudflare Pages Functions

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The BFF of [ADR 0001](0001-bff-with-httponly-cookies.md) has to be on the same origin as the page, cheap to run, close to the user and deployed together with the static files, so that a release is one atomic step.

## Decision

Host the app on **Cloudflare Pages**: the built SPA is served as static files and the code in `functions/` runs as Pages Functions on the same origin. A release is one `wrangler pages deploy dist`, from GitHub Actions, to a project with a `develop` preview and a `main` production branch. The variables and the API key are settings of the Pages project.

## Alternatives considered

- **A Worker with static assets.** The newer way of hosting on Cloudflare, with one configuration file and the same runtime. Pages Functions were kept because both apps the template came from run on them and the file-based routing (`functions/api/auth/login.ts` is `/api/auth/login`) keeps each Function small. Moving is mostly a change of layout and deploy command; the code in `server/` does not depend on Pages.
- **A Node server** (Express, a container, a small VM). More room for libraries, but something to run, patch and scale, and a second origin or a reverse proxy to keep cookies first-party.
- **AWS** (CloudFront with Lambda@Edge, or an API route in the API). It keeps everything in one cloud, but couples the deploy of the frontend to the API and loses the free static hosting and the previews per branch.
- **Vercel or Netlify functions.** Equivalent for this purpose; Cloudflare was already in use.

## Consequences

- The Functions run on the Workers runtime, not on Node: `fetch`, `Request`, `Response`, Web Crypto and nothing else. No Node-only package can be used in `functions/` or `server/`, which also keeps the code small.
- Each file under `functions/` becomes a route, so tests and helpers live elsewhere (`tests/`, `server/`).
- `CF-Connecting-IP` is set by Cloudflare at its edge and replaces any value the browser sends, so the app can pass the real IP to the API. Outside Cloudflare, that header must not be trusted.
- The Functions have limits on CPU time and on the size of a request. A call that takes longer than 10 seconds to the API is cut by the app and answered with a `503`.
- Pages deploys are previews by branch: a branch that is not the production branch of the project gets its own address, which is how `develop` works.
