# Changelog

All notable changes to the template are recorded here, following [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Projects created from the template do not inherit this file (`npm run init` deletes it).

## [Unreleased]

First version, extracted from two web apps of the same author.

### Added

- React 19 app with Vite, Tailwind 4, TanStack Query and React Router: a shell for the desktop and the phone, the session pages, and a reference `examples` screen with a paged list, create, edit and delete.
- A backend for the frontend on Cloudflare Pages Functions: login or Google start and exchange, refresh, logout and logout from every device, and a proxy with an allowlist of paths and methods, a CSRF check, a timeout and the device of the browser forwarded to the API. Tokens live in `__Host-` HttpOnly cookies and are never exposed to JavaScript.
- Two logins, chosen with `npm run init -- --login password|google`: email and password, or Google with PKCE and `state`.
- A session with rotation of the refresh token, one refresh at a time across tabs, idle logout, logout on every tab and a check of who is signed in.
- A fake API (`mock-api/`) that implements the contract of `docs/API-CONTRACT.md`, used by `npm run dev`, the tests and the CI.
- English and Portuguese, with a dictionary the compiler checks.
- A strict CSP with `'self'` in every directive and no inline code, and tests that fail if it is loosened.
- Tests: the client, the resource builder, the session, the Functions with a mocked `fetch`, the Functions against the fake API with no mock, component tests in jsdom and guardrails for a repository that may be public.
- GitHub Actions: `validate`, `audit`, deploy of `develop` (preview) and `main` (production) with `wrangler`; CodeQL; and a workflow that tests the `init` script in four combinations and runs the checks of each generated project, the end-to-end tests included. Dependabot.
- `npm run init`, a dependency-free script that names a new project, picks the login and can remove the example.
- `AGENTS.md` (imported by `CLAUDE.md`) and `docs/` with architecture, conventions, development guide, API contract, security rules and six decision records.
- End-to-end tests in a real browser (`npm run test:e2e`, Playwright with the Chrome of the machine, so nothing is downloaded) against the build served by the Functions with the real headers and the fake API: the login, the session renewing itself, two tabs refreshing at once, a logout without a connection, the CSP, the cookies, the layout on three widths and the example screen. They run as their own CI job, which gates the deploy.
- `docs/THREAT-MODEL.md`: the assets, the trust boundaries, sixteen threats with their mitigation and the test that proves it, the residual risks and what the API has to do.
- `AGENTS.md`, the instructions for any AI coding agent; `CLAUDE.md` imports it, so there is one source.
- `MOCK_REFRESH_DELAY_MS` for the fake API, to make two refreshes at once overlap.
- The session and security specs also run in Firefox, as their own CI job that does not gate the deploy (`E2E_FIREFOX=1`; Firefox is downloaded). WebKit is not covered, and the threat model says why.
- The API contract says that a logout ends the whole session of the token it receives, even a replaced one.

### Changed

- The proxy allowlist ties the methods to each route (`server/routes.ts`): a read-only route is never forwarded a `DELETE`, and the `405` says what the route accepts. The proxy refuses a request body over 1 MiB with `413 PAYLOAD_TOO_LARGE` before calling the API. The login and the Google exchange, which anyone can reach, accept at most 16 KiB and answer the same `413`; before, they read the whole body.
- The README and the API contract no longer say that "the contract cannot drift": the fake API and the Functions cannot drift apart without a test failing, but nothing checks the API of a project.
- The documents say "no token exposed to JavaScript" instead of "no token in the browser", which was not precise: the tokens are in the browser, in cookies that scripts cannot read. They also say that HttpOnly does not stop a script from making requests as the user.

### Fixed

- A logout that does not reach the Functions (no connection) no longer shows the login page while the cookies are still valid, which a reload would bypass: the session is kept and the app says so. The idle logout closes the screen anyway and sends the logout when the app opens again.
- The threat model of a generated project no longer carries the threat of the login it does not have (the Google flow or brute force of the password), nor the files and tests of the other login. The numbers do not change, so a generated table skips one. The `Test the init script` workflow checks it.
- A logout that crossed a refresh in progress could leave new cookies in the browser, set by the late answer of the refresh after the logout cleared them. The logout and the logout from every device now take the same lock as the refresh.
- The README said React Router 7 after the dependency moved to 8.

[Unreleased]: https://github.com/HenriqueVon/template-react-bff-cloudflare/commits/main
