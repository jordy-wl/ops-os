# Security Baseline Rules

> Unconditional — applies to every role in every session, no exceptions.

---

## Absolute Rules

These are non-negotiable. No task can pass Gate 5 without satisfying all of them.

**NEVER do:**
- Commit secrets, API keys, passwords, or tokens to any file — ever
- Include PII (names, emails, phone numbers, addresses, IDs) in log statements
- Include PII in prompts sent to any external AI service
- Hardcode credentials — use environment variables or a secrets manager
- Log raw request or response bodies that may contain sensitive user data
- Commit `.env` files — only `.env.example` with placeholder values
- Expose internal error details (stack traces, query plans) to end users

---

## Input Validation
- Validate all user input at the system boundary before any processing
- Sanitize for context: HTML-escape for web output, parameterised queries for database
- Reject unexpected types early with a clear, non-revealing error message
- Never trust client-supplied IDs for ownership checks — verify server-side

---

## Authentication and Authorisation
- Every protected route must check authentication in middleware — never ad-hoc
- Authorisation checks (can this user access this resource?) separate from authentication
- Tokens must be validated for: signature, expiry, issuer, audience
- Never roll your own crypto — use established libraries

---

## Environment Variables
- All secrets via environment variables only
- Validate all required env vars on application startup — fail fast if any are missing
- Document every required env var in `.env.example` with a description but no real values
- Rotate credentials immediately if any are accidentally committed

---

## Secret Detection — Run Before Every Commit
```bash
# Scan for common secret patterns
git diff --cached | grep -iE "(api_key|secret|password|token|sk-|pk_live)" | grep -v "example\|placeholder\|test"
```
If any real secrets are found: **stop, remove from code, rotate the credential, add to .gitignore**.

---

## Dependency Security
- When adding a new dependency: check for known CVEs before adding
- Document the reason for adding each new dependency in the package file
- Never add a dependency with a known critical vulnerability

---

## Error Responses
Return this format for all errors — never expose internal details:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description safe to show to users",
    "request_id": "req_abc123"
  }
}
```
- `code`: machine-readable, safe to log
- `message`: human-readable, safe to display
- `request_id`: for support tracing — log the full error server-side, return only the ID

---

## Pre-Commit Security Checklist
Before any commit:
- [ ] No secrets in staged files (`git diff --cached | grep -i "secret\|key\|password\|token"`)
- [ ] No PII in log statements (search for `console.log`, `logger.info` with user data)
- [ ] `.env` not staged (`git status | grep "\.env$"`)
- [ ] No hardcoded production URLs in test or dev code
- [ ] No TODO comments referencing security issues (fix them, don't commit them)
