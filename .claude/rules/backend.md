---
paths:
  - "src/api/**"
  - "src/services/**"
  - "src/middleware/**"
  - "src/db/**"
  - "src/lib/**"
  - "src/server/**"
---

# Backend Rules

> Path-scoped — loads when working in backend files.
> Full standards: `.claude/standards/backend-standards.md`

---

## API Design
- RESTful conventions: GET (read), POST (create), PUT (replace), PATCH (partial update), DELETE
- URL structure: `/api/v{N}/{resource}` — kebab-case, plural nouns
- Versioning in path from day one — `/api/v1/` — never change v1 behaviour once shipped
- All endpoints grouped by domain in `prd/05-api-contracts.md`

## Standard Error Response — Always Use This Shape
```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable description safe to show users",
    "details": {},
    "request_id": "req_abc123"
  }
}
```
Never return a different error shape. Never expose stack traces to clients.

## Authentication
- Auth is middleware — never check tokens ad-hoc inside route handlers
- Every protected route must go through the auth middleware chain
- Validate: token signature, expiry, issuer, and that the user still exists
- Log auth failures with request_id but without the token value

## Request Validation
- Validate all input parameters before any business logic runs
- Return `400 Bad Request` with a clear message on validation failure
- Use a schema validation library (e.g. Zod) — never hand-roll validation
- Validate query params, path params, and body — all three

## Database Rules
- No N+1 queries — use joins or batch queries
- Run `EXPLAIN` on any query joining 3+ tables before shipping
- All queries use parameterised statements — never string concatenation
- Index columns used in WHERE clauses on tables over 10k rows
- All schema changes go through migration files — never direct DB edits

## Service Layer
- Business logic lives in services, not route handlers
- Route handlers: validate input → call service → format response
- Services: business logic only — no HTTP request/response knowledge
- Never call the DB directly from a route handler — always through a service

## Structured Logging
All log entries must be structured JSON:
```json
{
  "level": "info",
  "timestamp": "2024-01-01T00:00:00Z",
  "request_id": "req_abc123",
  "event": "user.created",
  "user_id": "usr_xyz",
  "duration_ms": 42
}
```
No `console.log` in production paths. No PII in any log field.

## Rate Limiting
- Public unauthenticated endpoints: 20 req/min per IP
- Authenticated endpoints: 100 req/min per user
- Mutation endpoints (POST/PUT/PATCH/DELETE): 30 req/min per user
- Document any exceptions in `prd/05-api-contracts.md`

## Contract Sync
If your implementation diverges from `prd/05-api-contracts.md`:
1. Update the contract doc first
2. Log a SIGNAL in `research/signals/build-learnings.md`
3. Notify frontend in `sprints/shared-state.md`

---

## Phase 3 — New Backend Patterns

### Routing Engine (`src/lib/routing/`)
- Decision engine lives in `src/lib/routing/engine.ts` — pure function, no side effects
- Input: step config + policy block + AI confidence score → Output: routing decision + reasoning
- Precedence: step-level override > org policy default > system fallback (human)
- Routing modes: `human` | `agent` | `auto` | `policy_default`
- Always log routing decisions to events table with reasoning for audit trail

### RBAC Permission Middleware
- `requirePermission('manage_blocks')` replaces `requireRole(['ops-admin'])`
- Permissions resolved once per request in `withAuth()`, cached in `AuthContext`
- 10 granular permissions: manage_blocks, edit_blocks, view_blocks, manage_workflows, execute_workflows, approve_tasks, manage_team, manage_settings, manage_integrations, view_audit_log
- Backward compat: `requireRole()` still works, maps to permission sets internally

### Notification Service (`src/lib/notifications/`)
- Event-driven: delta thresholds + workflow events trigger notifications
- Dispatch pattern: create notification row → check user preferences → deliver (in-app + optional email)
- Never block the main request for notification delivery — fire-and-forget or queue

### Sub-Org Scoping
- All org-scoped queries must filter through hierarchy: `org_id IN (org + all descendant org IDs)`
- Utility: `getOrgHierarchyIds(orgId)` returns flat array of org + descendant IDs
- Max 4 levels: org → suborg → department → team — enforce via DB constraint

### API Key Management
- Store hashed keys only (SHA-256) — never store raw API keys
- Show key only once on creation — cannot be retrieved after
- Rate limit per API key independently from user auth rate limits
- Audit log entry on create/revoke
