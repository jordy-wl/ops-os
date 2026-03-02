# Engineering Standards — Universal

> **Reading guide:** The core rules (secrets, input validation, error format) are in `rules/security-baseline.md` — pre-loaded at session start.
> Full file: load only when implementing new patterns or investigating a specific engineering standards question.
> Auto-load: referenced by role-specific standards files when a task requires universal standards.
> Avoid full loads at session start — `rules/security-baseline.md` covers the critical baseline.

These rules apply to every role that produces code or configuration. No exceptions.
Stack-agnostic — specifics for each discipline in the role-specific standards files.

---

## Naming Conventions

### Files
| Type | Convention | Good | Bad |
|------|-----------|------|-----|
| Source files | kebab-case | `user-service.ts` | `UserService.ts`, `userService.ts` |
| Test files | `[name].test.[ext]` | `user-service.test.ts` | `userServiceTest.ts` |
| Constants files | kebab-case | `error-codes.ts` | `errorCodes.ts` |
| Migration files | `YYYYMMDD-HHMMSS-description` | `20240101-120000-add-users-table.sql` | `migration1.sql` |
| Config files | kebab-case | `jest.config.ts` | `jestConfig.ts` |

### Functions and Variables
| Type | Convention | Good | Bad |
|------|-----------|------|-----|
| Functions | camelCase, verb-first | `getUserById`, `validateEmail` | `user_by_id`, `Validate` |
| Variables | camelCase | `userCount`, `isLoading` | `user_count`, `IsLoading` |
| Boolean variables | is/has/should prefix | `isActive`, `hasPermission` | `active`, `permission` |
| Constants | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT_MS` | `maxRetry`, `timeout` |
| Classes | PascalCase | `UserService`, `EmailValidator` | `userService`, `email_validator` |
| TypeScript interfaces | PascalCase, no I prefix | `UserProfile`, `ApiResponse` | `IUserProfile`, `api_response` |

---

## Conventional Commits — Always

Format: `type(scope): description`

Every commit must follow this format. Commit messages are the project's changelog.

| Type | When to use | Example |
|------|------------|---------|
| `feat` | New feature | `feat(auth): add JWT refresh token rotation` |
| `fix` | Bug fix | `fix(api): handle null user in profile endpoint` |
| `test` | Adding or updating tests | `test(user-service): add edge cases for email validation` |
| `refactor` | Code change, no behaviour change | `refactor(db): extract query builder into separate module` |
| `docs` | Documentation only | `docs(api): update endpoint contract for v2 auth` |
| `chore` | Build, tooling, dependencies | `chore(deps): upgrade zod to 3.22.0` |
| `perf` | Performance improvement | `perf(query): add index on user_created_at` |
| `ci` | CI/CD pipeline changes | `ci(github): add staging deploy step to workflow` |
| `style` | Formatting only | `style: run prettier across src/` |

**BAD:** `updated stuff`, `fix bug`, `WIP`, `changes`
**GOOD:** `fix(checkout): prevent double-charge on network timeout retry`

---

## Commenting Rules

**Comment why, not what. The code explains what — your comment explains why.**

```typescript
// BAD: explains what the code does (already obvious)
// Loop through users and check their status
users.forEach(user => {
  if (user.status === 'active') { ... }
})

// GOOD: explains why this specific approach was chosen
// We filter in-memory rather than querying per-user to avoid N+1 at this call volume.
// Revisit when user count exceeds 10k — see issue #234
users.forEach(user => {
  if (user.status === 'active') { ... }
})
```

**Rules:**
- All public functions must have JSDoc documentation (description, params, returns, throws)
- Inline comments only where the logic is non-obvious
- No commented-out code — delete it (version control is your undo)
- No TODO/FIXME/HACK in committed code — create a task for it

---

## No Secrets in Code — Ever

This is an absolute rule. One violation is one too many.

```bash
# Scan staged files before committing
git diff --cached | grep -iE "(api_key|secret|password|token|sk-|pk_live|bearer)" | grep -v "example\|placeholder\|test\|mock"
```

Allowed in code:
- `process.env.API_KEY` — reading from environment
- `// @example: sk-abc...` — clearly marked as example

Not allowed in code:
- Any real credential, key, or token value
- Any `.env` file committed to version control (only `.env.example`)

---

## PR Hygiene

- PRs must be small — one feature, one fix, or one refactor. Not all three.
- PR description must include: task ID, what changed, why it changed, how to test
- Self-review before requesting review — read your own diff first
- All PRs link to a task ID: `Closes P1-S1-BE-04`
- No direct pushes to `main` — all changes through PRs, no exceptions

---

## Dependency Management

When adding a new dependency, add a comment in the package file:
```json
{
  "dependencies": {
    "zod": "^3.22.0"  // Schema validation — chosen over joi for TypeScript-first API and zero dependencies
  }
}
```

Before adding any dependency:
- Check for known CVEs
- Verify the dependency is actively maintained (last commit < 6 months)
- Consider whether the functionality can be implemented without the dependency
- Document the reason for choosing this dependency over alternatives

---

## Structured Logging — Always

All log output must be structured JSON. No `console.log` in production code paths.

```json
{
  "level": "info",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "user-service",
  "request_id": "req_abc123",
  "event": "user.profile.updated",
  "user_id": "usr_xyz789",
  "changed_fields": ["email", "name"],
  "duration_ms": 42
}
```

Required fields in every log entry: `level`, `timestamp`, `service`, `event`
Conditionally required: `request_id` (when handling an HTTP request), `user_id` (when acting on behalf of a user)
Never log: raw request/response bodies, passwords, tokens, PII (see security-baseline.md)

---

## Stack Choices — Project-Specific

Standards in this file are stack-agnostic. The researcher recommends the tech stack in:
`research/findings/tech-stack-recommendation.md`

After PM approval, the orchestrator records confirmed stack choices in `prd/03-system-architecture.md`.

Role-specific standards files use `[FRAMEWORK]`, `[RUNTIME]`, `[DATABASE]` as placeholders.
Replace these with the confirmed stack from `prd/03-system-architecture.md` at project start.
