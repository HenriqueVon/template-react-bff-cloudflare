# 0005. A fake API for development, tests and CI

- **Status:** Accepted
- **Date:** 2026-11-23

## Context

The apps the template came from develop against a real API on a remote environment, with real logins. A template cannot: whoever opens it has no such API, and a public repository must not hold addresses or credentials. Tests of the Functions with a mocked `fetch` prove that the code does what the author thought the API does, which is not the same as proving that they agree.

## Decision

`mock-api/` is an HTTP server in plain Node, with no dependencies, that implements the contract of [API-CONTRACT.md](../API-CONTRACT.md) in memory: the login, the refresh with rotation and reuse detection, the logout, `GET /auth/me` and the example resource, with the same error bodies as the API template. `npm run dev` starts it with the Functions and Vite, and `tests/contract/` runs the real Functions against it, with no mock, in the normal test run and in CI.

## Alternatives considered

- **Require a real API.** Nothing to maintain here, but nobody can run the template, and CI cannot test the flows end to end.
- **A mock server library** (MSW, json-server, a Prism mock of an OpenAPI file). Less code to write, one more dependency to keep up, and none of them models rotation with reuse detection or PKCE without more code than the fake itself.
- **Mocked `fetch` in the tests only.** Kept, for the details of each Function (`tests/bff/`), but it cannot tell when the contract and the code drifted.
- **Extend the API template with a login.** It would make the two templates a pair. It is a large piece of work with its own design choices (users, hashing, sessions), so it was left for later.

## Consequences

- The template runs one minute after `npm install`, without any account.
- The contract is written in three places (the document, the fake and the Functions). `tests/contract/` fails when the fake and the Functions disagree; the document is kept in step by reading.
- The fake is not secure and is not a model of your API. It has one demo user and keeps everything in memory. It must never face the internet, and it is deleted or left behind when the real API is connected.
- Passing the contract test does not prove your real API behaves like the fake. Run the manual end-to-end check against it before a release ([DEVELOPMENT.md](../DEVELOPMENT.md)).
