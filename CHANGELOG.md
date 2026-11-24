# Changelog

All notable changes to the template are recorded here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Projects created from the template do not inherit this file (`npm run init` deletes it).

## [Unreleased]

First version, extracted from two web apps of the same author.

### Added

- React 19 app with Vite, Tailwind 4, TanStack Query and React Router: a shell for the desktop and the phone, the session pages, and a reference `examples` screen with a paged list, create, edit and delete.
- A backend for the frontend on Cloudflare Pages Functions: login or Google start and exchange, refresh, logout and logout from every device, and a proxy with an allowlist of paths and methods, a CSRF check, a timeout and the device of the browser forwarded to the API. Tokens live in `__Host-` HttpOnly cookies and never reach the browser.
- Two logins, chosen with `npm run init -- --login password|google`: email and password, or Google with PKCE and `state`.
- A session with rotation of the refresh token, one refresh at a time across tabs, idle logout, logout on every tab and a check of who is signed in.
- A fake API (`mock-api/`) that implements the contract of `docs/API-CONTRACT.md`, used by `npm run dev`, the tests and the CI.
- English and Portuguese, with a dictionary the compiler checks.
- A strict CSP with `'self'` in every directive and no inline code, and tests that fail if it is loosened.
- Tests: the client, the resource builder, the session, the Functions with a mocked `fetch`, the Functions against the fake API with no mock, component tests in jsdom and guardrails for a repository that may be public.
- GitHub Actions: `validate`, `audit`, deploy of `develop` (preview) and `main` (production) with `wrangler`; CodeQL; and a workflow that tests the `init` script in four combinations and runs the checks of each generated project. Dependabot.
- `npm run init`, a dependency-free script that names a new project, picks the login and can remove the example.
- `CLAUDE.md` and `docs/` with architecture, conventions, development guide, API contract, security rules and six decision records.

[Unreleased]: https://github.com/HenriqueVon/template-react-bff-cloudflare/commits/main
