# Backend Tasks — Phase 1, Sprint 1

> Tasks for Backend Engineer only. Source of truth: `tasks.md` (master list).
> Run `/load-agent backend` then `/next-task` to claim your first task.

---

## Sprint Header

**Phase:** 1 | **Sprint:** 1 | **Role:** BACKEND-ENGINEER
**Sprint Goal:** Implement the core database schema and API layer — Blocks, Events, Actions, and auth middleware. These APIs are the foundation that frontend, AI, and QA all depend on.
**Your critical path:** BE-05 (auth) → BE-01 (schema) → BE-02 + BE-03 (APIs) → BE-04 (Actions)

---

## P1-S1-BE-05: Auth Middleware — Clerk JWT + Org Scoping

**Description:** Implement the `withAuth` middleware used by all API routes. Validates Clerk JWT, extracts `userId` and `orgId`, resolves the internal Supabase `org_id` UUID. Auto-provisions org row on first login.

**Acceptance Criteria:**
- [ ] `withAuth` middleware wrapper available for all API route handlers
- [ ] Missing or invalid JWT → `401 {"error": {"message": "Unauthorized", "code": "auth/unauthenticated"}}`
- [ ] Valid JWT but unknown org → `403`
- [ ] `userId` (Clerk) and `orgId` (internal UUID) available on request context
- [ ] First-time login: if Clerk org not in `orgs` table, create it automatically
- [ ] No PII (email, name) in log output — only IDs
- [ ] Unit tests: valid JWT, missing JWT, unknown org

**Applicable Gates:** 1, 2, 5
**Dependencies:** P1-S1-OPS-01
**Complexity:** MEDIUM
**Estimate:** 1 day
**Assigned Role:** BACKEND-ENGINEER

---

## P1-S1-BE-01: Core Database Schema

**Description:** Create foundational Supabase migrations for all 6 core tables: `orgs`, `blocks`, `block_edges`, `events` (immutable), `workflow_jobs`, `embeddings`. Enforce immutability on `events` via RLS. Enable org_id-scoped RLS on all tables.

**Key constraints:**
- `events` table: no `updated_at` column; RLS denies all UPDATE and DELETE for all roles
- `embeddings.embedding vector(1536)` with ivfflat index
- All tables: `org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE`

**Acceptance Criteria:**
- [ ] All 6 tables created via migration file in `supabase/migrations/`
- [ ] `pgvector` extension enabled before embeddings table
- [ ] RLS enabled on all tables with org_id policies
- [ ] Events table RLS denies UPDATE and DELETE for all roles including service role
- [ ] Indexes: `blocks(org_id, type)`, `events(block_id, occurred_at)`, `events(org_id, occurred_at)`, `block_edges(from_block_id)`, `workflow_jobs(org_id, status, scheduled_at)`, ivfflat on embeddings
- [ ] Migration runs cleanly from `supabase db reset`

**Applicable Gates:** 1, 2, 5
**Dependencies:** P1-S1-OPS-01
**Complexity:** MEDIUM
**Estimate:** 2 days
**Assigned Role:** BACKEND-ENGINEER

---

## P1-S1-BE-02: Blocks API

**Description:** Implement the Blocks API in `/app/api/blocks/`. All mutations create corresponding events. Consistent response shape: `{data: ..., error: null}` or `{data: null, error: {message, code}}`.

**Endpoints:** GET /api/blocks, POST /api/blocks, GET /api/blocks/:id (with last 20 events), PATCH /api/blocks/:id (creates event), GET /api/blocks/:id/neighbours, POST /api/blocks/:id/edges

**Acceptance Criteria:**
- [ ] All 6 endpoints with correct HTTP status codes
- [ ] `GET /api/blocks/:id` returns block + last 20 events in one response
- [ ] `PATCH /api/blocks/:id` writes `block.updated` event with diff in payload
- [ ] `GET /api/blocks/:id/neighbours` returns directly connected blocks in <200ms
- [ ] Clerk JWT validation + org_id scoping on all routes; 401/403 on failures
- [ ] Zod validation on request bodies; 400 with field-level errors
- [ ] Unit tests: create, get with events, update (event verified), neighbours

**Applicable Gates:** 1, 2, 3, 5
**Dependencies:** P1-S1-BE-01, P1-S1-BE-05
**Complexity:** MEDIUM
**Estimate:** 2 days
**Assigned Role:** BACKEND-ENGINEER

---

## P1-S1-BE-03: Events API

**Description:** Implement the Events API in `/app/api/events/`. Append-only — no PUT, PATCH, DELETE for events anywhere. `occurred_at` always set server-side. `actor_id` always from Clerk JWT.

**Endpoints:** POST /api/events, GET /api/events?block_id=:id (paginated), GET /api/events?org_id=:id&limit=100

**Acceptance Criteria:**
- [ ] `POST /api/events` creates event with server-side `occurred_at`; returns 201
- [ ] `GET /api/events?block_id=:id` returns events sorted `occurred_at` DESC with cursor pagination
- [ ] No UPDATE or DELETE endpoints for events anywhere in the codebase
- [ ] Integration test: create event → attempt direct PATCH via Supabase client → RLS denies
- [ ] `actor_id` set from Clerk JWT, never from request body
- [ ] Unit tests: create, list, pagination

**Applicable Gates:** 1, 2, 3, 5
**Dependencies:** P1-S1-BE-01, P1-S1-BE-05
**Complexity:** MEDIUM
**Estimate:** 2 days
**Assigned Role:** BACKEND-ENGINEER

---

## P1-S1-BE-04: Actions API Skeleton

**Description:** Implement the Actions API — command pattern gateway for all controlled mutations. Sprint 1 delivers: action registry + `block.create` + `onboarding.start` action types.

**Architecture:** `POST /api/actions/:type` → validate auth → look up handler in registry → validate payload (Zod) → execute handler (mutate blocks + create events + optionally enqueue workflow_job) → return `{ actionId, eventId, workflowJobId?, status }`

**Sprint 1 action types:**
1. `block.create` — creates block + `block.created` event atomically
2. `onboarding.start` — creates client block + `onboarding` workflow_job + `onboarding.started` event

**Acceptance Criteria:**
- [ ] `POST /api/actions/block.create` creates block + event atomically
- [ ] `POST /api/actions/onboarding.start` creates block + workflow_job + event
- [ ] Action registry pattern documented: add handler file + register in registry
- [ ] All actions require auth; org_id scoped
- [ ] Zod validation per action type
- [ ] Response includes `eventId` and `workflowJobId` where applicable
- [ ] Unit tests: happy path for both actions, invalid payload 400, wrong org 403
- [ ] Integration test: `onboarding.start` → verify workflow_job with `status = "pending"`

**Applicable Gates:** 1, 2, 3, 5, 6
**Dependencies:** P1-S1-BE-01, P1-S1-BE-02, P1-S1-BE-03
**Complexity:** HIGH
**Estimate:** 3 days
**Assigned Role:** BACKEND-ENGINEER
