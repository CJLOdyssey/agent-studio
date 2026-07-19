# Security Policy

## Supported Versions

The following versions of AgentStudio receive security updates.

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |
| < 1.0   | ❌        |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it privately.

**Do NOT open a public issue.** Instead:

1. Email: **<your-security-email>** — replace with the actual security contact before going live
1. Email: **security@example.com** (PGP key below)
2. Expected response time: within 48 hours
3. We will acknowledge your report within 24 hours and provide an estimated timeline for a fix
4. We request you not disclose the vulnerability publicly until we have addressed it

### PGP Key

```
-----BEGIN PGP PUBLIC KEY BLOCK-----
(Replace with your security team's actual PGP public key before production deployment)
(replace with actual PGP key)
-----END PGP PUBLIC KEY BLOCK-----
```

## Scope

- API authentication and authorization
- Data encryption at rest and in transit
- API key leakage or unauthorized access
- SQL injection, XSS, CSRF
- Remote code execution
- Information disclosure

## Out of Scope

- Denial of Service attacks
- Social engineering
- Physical access attacks
- Vulnerabilities in third-party dependencies (report those to the upstream maintainer)

## Safe Harbor

We follow safe harbor practices. If you comply with this policy, we will:
- Not pursue legal action against you
- Work with you to understand and resolve the issue
- Acknowledge your contribution (if desired) after the fix is released

## Disclosure Timeline

1. Report received → Acknowledged (24h)
2. Triage & Validation (1-5 days)
3. Fix developed & tested (timeline depends on severity)
4. Fix released + public disclosure coordinated with reporter
