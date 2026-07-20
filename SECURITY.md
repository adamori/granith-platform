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

Granith is v1.0 (generally available) but is still maintained by a single person. Expect:

- Acknowledgement within 7 days.
- No formal SLA for fixes — this is a single-maintainer project, best-effort.
- Public credit in the release notes once the fix ships, unless you ask otherwise.

## Supported versions

Only `main` (the deployed v1.0 line) is supported. Fixes land on `main`; no patch backports are issued.

## Out of scope

- Denial-of-service via unauthenticated endpoints (these are intentionally rate-limited; resource exhaustion is a known tradeoff).
- Missing security headers on the marketing site (`granith.dev`) that do not affect the vault application (`app.granith.dev`).
- Social-engineering of the maintainer.
- Vulnerabilities in third-party dependencies without a working proof-of-concept against granith.
