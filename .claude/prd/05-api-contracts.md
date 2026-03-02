# PRD Layer 05: API Contracts

> Last updated: 2026-03-02 | Author: Backend Engineer | Status: DRAFT
> LIVING DOCUMENT — update this file when implementation diverges from spec. Log a signal in build-learnings.md.
> Cross-references: `prd/03-system-architecture.md` (auth scheme), `prd/04-data-models.md` (response shapes).

---

## API Design Principles

1. **Events-first:** Every mutation endpoint records an event atomically. No state change without an event.
2. **Actions are the only mutation path:** No direct writes to entity tables from API consumers. All mutations via `/api/actions/[type]`.
3. **Append-only events:** The events API accepts GET only. No PUT, PATCH, or DELETE on events — ever.
4. **Auth on every route:** Every endpoint validates a Clerk JWT via `withAuth` middleware before any handler logic runs. No exceptions.
5. **Structured errors:** All errors return the standard error envelope below. No stack traces to clients.

---

## Base URL

| Environment | Base URL |
|------------|----------|
| Development | `http://localhost:3000/api` |
| Preview (Vercel) | `https://[branch-hash]-ops-os.vercel.app/api` |
| Production | `https://[production-domain]/api` |

> Versioning: No `/v1/` prefix in prototype. Add versioning before first external API consumer in Phase 2.

---

## Authentication

**Scheme:** Clerk JWT Bearer token

All requests must include:
```
Authorization: Bearer <clerk_session_token>
```

The `withAuth` middleware at `src/middleware/withAuth.ts` validates the token, extracts `userId` and `orgId`, and injects both into the request context. All database queries filter by `org_id` from the token — never from the client request body.

---

## Standard Error Envelope

All error responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description safe to show to users",
    "request_id": "req_abc123"
  }
}
```

| Code | HTTP Status | When |
|------|------------|------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `FORBIDDEN` | 403 | Valid JWT but insufficient permissions for this resource |
| `NOT_FOUND` | 404 | Resource not found or not in this org |
| `VALIDATION_ERROR` | 400 | Invalid request body or params |
| `CONFLICT` | 409 | Duplicate resource or state conflict |
| `INTERNAL_ERROR` | 500 | Unexpected server error — log full error server-side, return only request_id |

---

## Endpoint Catalogue

### Blocks — `GET /api/blocks`

List blocks for the authenticated org.

**Query params:** `type`, `status`, `jurisdiction`, `limit` (default 50, max 200), `offset` (default 0)

**Response 200:**
```json
{
  "blocks": [
    {
      "id": "uuid",
      "type": "client",
      "name": "Thornfield Capital",
      "status": "active",
      "jurisdiction": "GB",
      "data": {},
      "created_at": "2026-03-02T10:00:00Z",
      "updated_at": "2026-03-02T10:00:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

---

### Blocks — `GET /api/blocks/:id`

Get a single block with graph connections and recent events.

**Response 200:**
```json
{
  "block": { "id": "uuid", "type": "client", "name": "Thornfield Capital", "status": "active", "jurisdiction": "GB", "data": {}, "created_at": "...", "updated_at": "..." },
  "edges": [
    { "from_block_id": "uuid", "to_block_id": "uuid", "to_block_name": "Thornfield Deal 1", "to_block_type": "deal", "relationship": "part_of" }
  ],
  "recent_events": [
    { "id": "uuid", "event_type": "workflow.step.completed", "actor_type": "user", "payload": { "step": "kyc_request_sent" }, "occurred_at": "..." }
  ]
}
```

---

### Events — `GET /api/events`

Query the event log. Read-only. No mutations.

**Query params:** `block_id`, `event_type`, `actor_type`, `from` (ISO 8601), `to` (ISO 8601), `limit` (default 50, max 500), `offset` (default 0)

**Response 200:**
```json
{
  "events": [
    {
      "id": "uuid",
      "block_id": "uuid",
      "event_type": "workflow.step.completed",
      "actor_id": "user_clerk_abc",
      "actor_type": "user",
      "payload": { "step": "kyc_request_sent", "workflow": "client_onboarding_london" },
      "occurred_at": "2026-03-02T11:00:00Z"
    }
  ],
  "total": 127,
  "limit": 50,
  "offset": 0
}
```

> No POST/PUT/PATCH/DELETE on events. Events are immutable. Use the Actions API to create events as a side effect of actions.

---

### Actions — `POST /api/actions/:type`

The only way to mutate system state. Records an event atomically. All actions go through AI confidence routing (Phase 1: always routes to human approval since threshold = 1.0).

**Available action types (Phase 1):**
- `block.create` — create a new block
- `block.update` — update block data fields
- `block.status_change` — change block status (active → archived, etc.)
- `block.edge.create` — establish a graph connection between two blocks
- `workflow.trigger` — start a workflow for a block
- `workflow.step.approve` — approve the next pending workflow step
- `workflow.step.reject` — reject and halt a workflow step

**Request body:**
```json
{
  "block_id": "uuid",
  "payload": {}
}
```

**Response 200 — action executed immediately:**
```json
{
  "status": "executed",
  "action_type": "block.status_change",
  "event": { "id": "uuid", "event_type": "block.status_changed", "occurred_at": "..." }
}
```

**Response 202 — action pending human approval:**
```json
{
  "status": "pending_approval",
  "action_type": "workflow.trigger",
  "routing_decision": {
    "confidence": 0.94,
    "risk_score": 3,
    "routed_to": "human",
    "reason": "Confidence threshold = 1.0 in Phase 1 — all actions require human review"
  },
  "approval_id": "uuid"
}
```

---

### Workflows — `GET /api/workflows`

List available workflow templates for this org.

**Response 200:**
```json
{
  "workflows": [
    {
      "type": "client_onboarding_london",
      "name": "Client Onboarding — London (FCA)",
      "jurisdiction": "GB",
      "steps": ["kyc_request", "aml_check", "legal_review", "account_setup", "welcome_email"],
      "estimated_days": 5
    }
  ]
}
```

---

### Workflows — `GET /api/workflows/jobs/:id`

Get status of a specific workflow job.

**Response 200:**
```json
{
  "job": {
    "id": "uuid",
    "workflow_type": "client_onboarding_london",
    "step_name": "aml_check",
    "status": "running",
    "block_id": "uuid",
    "started_at": "2026-03-02T10:30:00Z",
    "payload": {}
  }
}
```

---

### AI Chat — `POST /api/ai/chat`

Send a message to the AI control plane. The AI reads the business graph and event timeline for context, interprets intent, and either responds with information or suggests an action requiring approval.

**Request body:**
```json
{
  "message": "What is the status of the Thornfield Capital onboarding?",
  "context_block_id": "uuid"
}
```

**Response: streaming Server-Sent Events (SSE)**
```
data: {"type":"text","content":"The Thornfield Capital onboarding is currently at step 3 of 5..."}
data: {"type":"text","content":" The AML check was completed on March 1st by the compliance team."}
data: {"type":"action_suggested","action_type":"workflow.step.approve","description":"Approve the legal review step to advance the onboarding","requires_human":true}
data: {"type":"done"}
```

> Note: Vercel function timeout applies. Use Edge Runtime or Vercel Pro for streaming endpoints. Confirm before AI-01 is marked DONE.

---

### AI Search — `POST /api/ai/search`

Semantic search across blocks and events using pgvector cosine similarity.

**Request body:**
```json
{
  "query": "capital markets client onboarding Singapore",
  "source_types": ["block", "event"],
  "limit": 10
}
```

**Response 200:**
```json
{
  "results": [
    {
      "source_type": "block",
      "source_id": "uuid",
      "content": "Thornfield Capital — client, Singapore jurisdiction, onboarded March 2026",
      "similarity": 0.92
    }
  ]
}
```

---

### Webhooks — `POST /api/webhooks/clerk`

Inbound Clerk webhook for user/org lifecycle events (user created, org created, membership changed).
- Validates Clerk `svix-signature` header before processing
- Creates or updates org and user records in Supabase

---

## Rate Limits (Prototype)

| Endpoint | Limit | Notes |
|----------|-------|-------|
| All routes | 100 req/min per org | Vercel default |
| `POST /api/ai/chat` | 20 req/min per user | Claude API cost protection |
| `POST /api/ai/search` | 30 req/min per org | pgvector query cost |
| `POST /api/actions/*` | 60 req/min per org | Action throughput limit |

---

## Contract Change Protocol

When implementation diverges from this spec:
1. Update this file FIRST — before merging code
2. Log a signal in `research/signals/build-learnings.md`
3. If response shape changes: notify frontend engineer explicitly in `sprints/shared-state.md` notes
4. Update the PRD CHANGELOG

---

## Archived

> Superseded contracts moved here with date and reason. Never deleted.
