# Security Policy

Granith is a zero-knowledge secrets manager. The cryptographic guarantee — the server never sees plaintext — is the point of the product. Anything that breaks it is a security issue worth reporting.

## Reporting a vulnerability

**Preferred:** Use GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) via the **Security** tab of this repository.

**Fallback:** Email `adam@alibiro.com`.

Please do not open public issues for security reports.

## What to include

- A description of the issue and the impact you believe it has.
- Steps to reproduce, or a minimal proof-of-concept.
- Affected components (backend, frontend, sdk-go, marketing site).
- Whether you have already disclosed this elsewhere.

## Response expectations

Granith is currently maintained by a single person in alpha. Expect:

- Acknowledgement within 7 days.
- No formal SLA for fixes while in alpha.
- Public credit in the release notes once the fix ships, unless you ask otherwise.

## Supported versions

Only `main` is supported. No patch backports are issued while the project is in alpha.

## Out of scope

- Denial-of-service via unauthenticated endpoints (these are intentionally rate-limited; resource exhaustion is a known tradeoff).
- Missing security headers on the marketing site (`granith.dev`) that do not affect the vault application (`app.granith.dev`).
- Social-engineering of the maintainer.
- Vulnerabilities in third-party dependencies without a working proof-of-concept against granith.
