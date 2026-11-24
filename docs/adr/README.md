# Architecture Decision Records

An ADR records **one decision, why it was taken, and what it costs**, so that the next developer can tell a deliberate choice from an accident, and can change it knowing what it was protecting. They are short on purpose.

These records describe the foundations of the template. They were written when the template was created, from two web apps that already used these choices. A project keeps them as its starting point, and **replaces** one with a new ADR when it decides differently (mark the old one `Superseded by NNNN`). Never edit an accepted decision to say something else: add a new record.

| # | Decision | Status |
|---|---|---|
| [0001](0001-bff-with-httponly-cookies.md) | A backend for the frontend keeps the tokens in HttpOnly cookies | Accepted |
| [0002](0002-cloudflare-pages-functions.md) | The backend for the frontend runs as Cloudflare Pages Functions | Accepted |
| [0003](0003-one-refresh-at-a-time.md) | Only one refresh of the session runs at a time, across tabs | Accepted |
| [0004](0004-strict-content-security-policy.md) | A strict Content-Security-Policy, with no inline script or style | Accepted |
| [0005](0005-fake-api.md) | A fake API for development, tests and CI | Accepted |
| [0006](0006-dictionary-checked-at-compile-time.md) | A dictionary checked at compile time instead of an i18n library | Accepted |

## Format

Copy this skeleton to `NNNN-short-title.md` (next number, kebab-case title) and add a row to the table above.

```markdown
# NNNN. Title of the decision

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD

## Context
The situation and the forces at play: what makes this a decision.

## Decision
What we do, in one or two sentences.

## Alternatives considered
Each option and why it was not chosen.

## Consequences
What gets easier, what gets harder, and what we accept.
```
