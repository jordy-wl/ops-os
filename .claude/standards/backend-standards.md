# Backend Standards — Reference

> **Reading guide:** At session start, skim section headers only — do not read in full.
> Full file: load only when actively implementing a task that requires these standards.
> Auto-load: `/focus-context [task-id]` reads this file when your task's role or gate requires it.
> Skipping at session start saves significant context tokens.

Stack placeholders: `[BACKEND_RUNTIME]`, `[WEB_FRAMEWORK]`, `[ORM]`, `[DATABASE]`
Confirmed stack recorded in `prd/03-system-architecture.md` after researcher recommendation.

---

## RESTful API Conventions

### URL Structure
```
/api/v{N}/{resource}             GET    → list
/api/v{N}/{resource}             POST   → create
/api/v{N}/{resource}/{id}        GET    → read one
/api/v{N}/{resource}/{id}        PATCH  → partial update
/api/v{N}/{resource}/{id}        PUT    → full replace
/api/v{N}/{resource}/{id}        DELETE → delete
/api/v{N}/{resource}/{id}/{sub}  GET    → nested resource
```

**Rules:**
- Kebab-case in URLs: `/api/v1/user-profiles` not `/api/v1/userProfiles`
- Plural nouns for collections: `/users` not `/user`
- Version in path from day one: `/api/v1/` — never break existing version
- No verbs in URLs (except named exceptions): `/search` and `/validate` are acceptable when truly needed

### Named Exceptions to REST
Some operations don't fit standard CRUD. These are acceptable:
```
POST /api/v1/auth/login          → action, not a resource
POST /api/v1/auth/logout
POST /api/v1/auth/refresh-token
POST /api/v1/users/{id}/verify-email
POST /api/v1/emails/send
```
Document all named exceptions in `prd/05-api-contracts.md`.

---

## Standard Response Envelope

All responses must use this exact shape:

**Success:**
```json
{
  "data": { /* response payload */ },
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**Success (paginated list):**
```json
{
  "data": [ /* items */ ],
  "meta": {
    "request_id": "req_abc123",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "pagination": {
      "page": 1,
      "per_page": 20,
      "total": 142,
      "has_next": true
    }
  }
}
```

**Error:**
```json
{
  "error": {
    "code": "MACHINE_READABLE_CODE",
    "message": "Human-readable description safe to show users",
    "details": { /* optional field-level validation errors */ },
    "request_id": "req_abc123"
  }
}
```

Never return a different response shape. Never expose stack traces, query plans, or internal error messages.

---

## Standard Error Codes

| Code | HTTP Status | When to use |
|------|------------|-------------|
| `VALIDATION_ERROR` | 400 | Input failed validation |
| `INVALID_REQUEST` | 400 | Malformed request (wrong content-type, etc.) |
| `AUTHENTICATION_REQUIRED` | 401 | No valid auth token |
| `PERMISSION_DENIED` | 403 | Authenticated but not authorised |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | State conflict (duplicate, version mismatch) |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

---

## Authentication Middleware

Auth is middleware — never ad-hoc in route handlers.

```typescript
// GOOD: auth in middleware, handler is clean
router.get('/users/:id', requireAuth, requireOwnership('user'), getUserById)

// BAD: auth logic in handler
router.get('/users/:id', async (req, res) => {
  if (!req.headers.authorization) { /* ad-hoc auth */ }
  // ...
})
```

Middleware chain pattern:
1. `requireAuth` — validates token, attaches `req.user`
2. `requireRole('admin')` — checks role permission
3. `requireOwnership('resource')` — checks resource belongs to requesting user

---

## Input Validation

Use a schema validation library (Zod recommended for TypeScript-first APIs).
Validate at the route level before any business logic runs.

```typescript
const createUserSchema = z.object({
  email: z.string().email('Must be a valid email'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  role: z.enum(['user', 'admin']).default('user'),
})

router.post('/users', validateBody(createUserSchema), createUser)
```

Return `400 VALIDATION_ERROR` with field-level details on failure:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "email": "Must be a valid email",
      "name": "Name is required"
    },
    "request_id": "req_abc123"
  }
}
```

---

## Service Layer Architecture

Route handlers are thin. Business logic lives in services.

```typescript
// Route handler: validate → call service → format response
async function createUser(req: Request, res: Response) {
  const user = await userService.create(req.body)
  res.status(201).json({ data: user, meta: { request_id: req.id } })
}

// Service: business logic, no HTTP knowledge
class UserService {
  async create(data: CreateUserInput): Promise<User> {
    const existing = await this.userRepo.findByEmail(data.email)
    if (existing) throw new ConflictError('Email already registered')
    return this.userRepo.create(data)
  }
}
```

Services never import from `express`, `fastify`, or equivalent — they have no HTTP knowledge.
Services are independently testable without starting an HTTP server.

---

## Database Rules

**No N+1 queries**
```typescript
// BAD: N+1 — 1 query + N queries for users
const posts = await db.posts.findMany()
const postsWithAuthors = await Promise.all(
  posts.map(post => db.users.findOne(post.authorId)) // N queries
)

// GOOD: join or batch
const posts = await db.posts.findMany({ include: { author: true } }) // 1 query
```

**EXPLAIN before shipping complex queries**
```sql
EXPLAIN ANALYZE SELECT u.*, COUNT(p.id) as post_count
FROM users u
LEFT JOIN posts p ON p.user_id = u.id
WHERE u.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id;
```
Paste the output in gate-results.md as Gate 3 evidence for data-heavy endpoints.

**Parameterised queries always**
```typescript
// BAD: SQL injection risk
db.query(`SELECT * FROM users WHERE email = '${email}'`)

// GOOD: parameterised
db.query('SELECT * FROM users WHERE email = $1', [email])
```

---

## Rate Limiting Defaults

| Endpoint type | Limit | Window |
|--------------|-------|--------|
| Public unauthenticated | 20 req | 1 minute per IP |
| Authenticated reads | 100 req | 1 minute per user |
| Authenticated mutations | 30 req | 1 minute per user |
| Auth endpoints (login, register) | 10 req | 15 minutes per IP |

Document any exceptions in `prd/05-api-contracts.md`.

---

## Idempotency Keys

Mutation endpoints where duplicate requests are dangerous (payments, email sends, resource creation) must support idempotency keys:
- Client sends: `Idempotency-Key: uuid-v4`
- Server: stores key with result, returns cached result on duplicate
- Key TTL: 24 hours minimum
- On duplicate: return `200` with original response, not `201`

---

## Environment Configuration

All configuration via environment variables. Validate on startup:
```typescript
const config = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
}).parse(process.env)
// If parse fails: process exits with clear error — fail fast, don't silently use defaults
```
Document every env var in `.env.example` with description and example (non-real) value.

---

## Phase 3 — New Backend Patterns

### Routing Engine Service (`src/lib/routing/engine.ts`)
```typescript
// Pure function — no side effects, no DB calls
interface RoutingInput {
  stepConfig: { routing_mode: 'human' | 'agent' | 'auto' | 'policy_default' }
  orgPolicy: { confidence_threshold: number; risk_routing_map: Record<string, string> }
  aiConfidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
}

interface RoutingDecision {
  route: 'human' | 'agent' | 'auto'
  reason: string  // audit trail explanation
}

function resolveRouting(input: RoutingInput): RoutingDecision
// Precedence: step override > org policy > system default (human)
```

### RBAC Middleware (`requirePermission`)
```typescript
// Replaces requireRole() — backward compatible
export function requirePermission(permission: Permission, handler: RouteHandler): RouteHandler
// Permission type: 'manage_blocks' | 'edit_blocks' | 'view_blocks' | ...
// withAuth() resolves permissions into AuthContext.permissions: Set<Permission>
// requireRole() still works internally — maps role → permission set
```

### Sub-Org Query Scoping
```typescript
// Utility for all org-scoped queries
async function getOrgHierarchyIds(supabase: Client, orgId: string): Promise<string[]>
// Returns [orgId, ...allDescendantIds] — flat array for IN clause
// Cache per-request (not across requests — org hierarchy can change)
```

### Notification Dispatch Pattern
```typescript
// Fire-and-forget — never block main request
async function dispatchNotification(params: {
  orgId: string; userId: string; type: string;
  title: string; body: string; blockId?: string
}): Promise<void>
// 1. Insert into notifications table
// 2. Check user preferences (in-app vs email vs both)
// 3. If email: queue via existing email action handler
```

### Document Versioning
```typescript
// Each generation creates a new version
// Storage: Supabase Storage bucket 'documents'
// Path: {org_id}/{block_id}/{version_number}.{format}
// Metadata in events table: event_type 'document.generated', payload includes version
```
