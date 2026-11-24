# Security Policy

## Scope

This repository is a **template**. It contains no production data, and its default settings are meant for local development: the demo user and the API key of the fake API are placeholders. A security problem in the template is a problem in the code or in the defaults that every new project inherits, for example a Function that fails open, a cookie without the right attributes, a CSP that is looser than it should be, an unsafe default in the deploy workflow or a vulnerable dependency.

## Supported versions

Only the latest commit on `main` and the latest release are maintained.

## Reporting a vulnerability

Please **do not open a public issue** for a vulnerability. Use GitHub's private reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. Include what you found, how to reproduce it and which files are involved.

You can expect an acknowledgement within a few days. This is a personal project, so there is no guaranteed response time and no bug bounty.

## For projects created from this template

This file belongs to the template and is deleted by `npm run init`. The security rules of your project are in `docs/SECURITY.md`; read them before the first commit. In short:

- Never commit `.dev.vars`; configure secrets as encrypted variables of the Cloudflare Pages project and in the GitHub environments.
- The fake API in `mock-api/` is for development only. It must never face the internet.
- Turn on secret scanning with push protection, Dependabot alerts and private vulnerability reporting for your repository.
- Review the Dependabot pull requests: they carry the security updates of your dependencies.
