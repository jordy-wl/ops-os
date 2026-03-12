# PRD Layer 05: API Contracts

> Last updated: 2026-03-12 | Author: Backend Engineer | Status: DRAFT
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

**Action types added in Phase 2:**
- `block_type.create` — define a new custom block type for the org
- `block_type.update` — update a custom block type's field schema or display properties
- `workflow.template.create` — create a new workflow template (creates a workflow_template Block)
- `workflow.template.update` — update a workflow template definition
- `workflow.template.publish` — mark a workflow template as ready to trigger
- `workflow.instance.spawn` — manually spawn a workflow instance from a template (system also spawns automatically on trigger match)
- `task.claim` — claim a task_queue_item Block
- `task.complete` — mark a task_queue_item Block as done
- `task.reassign` — reassign a task_queue_item to a different person/agent
- `integration.connector.create` — register a new integration connector

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

### Block Types — `GET /api/block-types` (Phase 2)

List available block types for the authenticated org (system types + org custom types).

**Response 200:**
```json
{
  "block_types": [
    {
      "id": "uuid",
      "type_key": "client",
      "display_name": "Client",
      "icon": "building",
      "color": "#3B82F6",
      "field_schema": { "type": "object", "properties": { "industry": { "type": "string" } } },
      "is_system": true
    }
  ]
}
```

---

### Block Types — `POST /api/block-types` (Phase 2)

Create a custom block type for the org. Requires ops-admin role.

**Request body:**
```json
{
  "type_key": "invoice",
  "display_name": "Invoice",
  "icon": "file-text",
  "color": "#10B981",
  "field_schema": {
    "type": "object",
    "properties": {
      "amount": { "type": "number" },
      "currency": { "type": "string", "enum": ["GBP", "USD", "AUD", "SGD"] },
      "due_date": { "type": "string", "format": "date" }
    },
    "required": ["amount", "currency"]
  }
}
```

**Response 201:** Returns the created block type. Records `block_type.created` event.

---

### Workflow Templates — `GET /api/workflow-templates` (Phase 2)

List workflow templates for the org. Returns workflow_template Blocks.

**Query params:** `applies_to_type`, `status` (draft/published), `limit`, `offset`

**Response 200:**
```json
{
  "templates": [
    {
      "id": "uuid",
      "name": "Client Onboarding — London (FCA)",
      "status": "published",
      "data": {
        "version": 1,
        "applies_to_type": "client",
        "triggers": [{ "id": "t1", "type": "manual", "config": {} }],
        "steps": [{ "id": "s1", "type": "route_human", "name": "KYC Review", "config": {} }],
        "edges": [{ "from": "t1", "to": "s1" }]
      },
      "created_at": "2026-03-04T10:00:00Z"
    }
  ],
  "total": 5
}
```

---

### Workflow Templates — `POST /api/workflow-templates` (Phase 2)

Create a new workflow template (creates a workflow_template Block). Validates the definition schema.

**Request body:**
```json
{
  "name": "Client Onboarding — Australia (ASIC)",
  "data": {
    "version": 1,
    "applies_to_type": "client",
    "triggers": [{ "id": "t1", "type": "manual", "config": {} }],
    "steps": [
      { "id": "s1", "type": "route_human", "name": "KYC Review", "config": { "role": "compliance-approver" } },
      { "id": "s2", "type": "call_api", "name": "AML Check", "config": { "connector_id": "uuid" } }
    ],
    "edges": [
      { "from": "t1", "to": "s1" },
      { "from": "s1", "to": "s2" }
    ]
  }
}
```

**Response 201:** Returns the created workflow_template Block. Records `workflow.template.published` event if status is published.

---

### Workflow Instances — `GET /api/workflow-instances` (Phase 2)

List workflow instances. Returns workflow_instance Blocks with runtime state.

**Query params:** `template_id`, `entity_block_id`, `status` (running/completed/failed), `limit`, `offset`

**Response 200:**
```json
{
  "instances": [
    {
      "id": "uuid",
      "template_id": "uuid",
      "template_name": "Client Onboarding — London (FCA)",
      "entity_block_id": "uuid",
      "entity_block_name": "Thornfield Capital",
      "status": "running",
      "current_step": "aml_check",
      "data": { "started_at": "...", "variables": {} },
      "created_at": "2026-03-04T10:00:00Z"
    }
  ],
  "total": 12
}
```

---

### Task Queue — `GET /api/tasks` (Phase 2)

List task_queue_item Blocks assigned to the current user or their role.

**Query params:** `assignee_type` (human/agent), `status` (pending/claimed/completed), `priority`, `limit`, `offset`

**Response 200:**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "name": "KYC Review — Thornfield Capital",
      "workflow_instance_id": "uuid",
      "assignee_type": "human",
      "assignee_id": "user_clerk_abc",
      "priority": "high",
      "due_at": "2026-03-06T17:00:00Z",
      "status": "pending",
      "data": { "step_config": {} }
    }
  ],
  "total": 3
}
```

---

### Task Queue — `POST /api/tasks/:id/claim` (Phase 2)

Claim a pending task. Records `task.claimed` event.

**Response 200:**
```json
{
  "task": { "id": "uuid", "status": "claimed", "claimed_at": "..." },
  "event": { "id": "uuid", "event_type": "task.claimed" }
}
```

---

### Task Queue — `POST /api/tasks/:id/complete` (Phase 2)

Complete a claimed task. Records `task.completed` event. Advances the workflow instance to the next step.

**Request body:**
```json
{
  "outcome": "approved",
  "notes": "KYC documentation verified — all clear"
}
```

**Response 200:**
```json
{
  "task": { "id": "uuid", "status": "completed", "completed_at": "..." },
  "event": { "id": "uuid", "event_type": "task.completed" },
  "next_step": { "step_id": "s2", "step_name": "AML Check" }
}
```

---

### Integration Connectors — `GET /api/integrations` (Phase 2)

List integration connectors for the org.

**Response 200:**
```json
{
  "connectors": [
    {
      "id": "uuid",
      "name": "Inbound Webhook — CRM",
      "provider": "webhook",
      "direction": "inbound",
      "status": "active",
      "last_sync_at": "2026-03-04T09:00:00Z"
    }
  ]
}
```

---

### Integration Connectors — `POST /api/integrations` (Phase 2)

Create a new integration connector. Returns a webhook URL for inbound connectors.

**Request body:**
```json
{
  "name": "Inbound Webhook — CRM",
  "provider": "webhook",
  "direction": "inbound",
  "config": { "event_type_mapping": { "new_lead": "block.created" } }
}
```

**Response 201:**
```json
{
  "connector": { "id": "uuid", "status": "active" },
  "webhook_url": "https://[domain]/api/webhooks/integration/[connector_id]"
}
```

---

### Inbound Webhooks — `POST /api/webhooks/integration/:connector_id` (Phase 2)

Receive webhooks from external systems via integration connectors. Validates connector exists and is active. Records `integration.webhook.received` event. Triggers workflow evaluation if any workflow template has a matching webhook trigger.

**Response 200:**
```json
{
  "received": true,
  "event_id": "uuid",
  "workflows_triggered": 1
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

## Phase 3 API Endpoints

### RBAC & Team Management

#### `GET /api/roles`
List all roles for the org (system + custom).
**Response:** `{ data: Role[] }` — each Role has `id`, `name`, `permissions`, `is_system`

#### `POST /api/roles`
Create a custom role. **Permission required:** `manage_team`
**Body:** `{ name: string, permissions: string[] }`
**Response:** `{ data: Role }` (201)

#### `PATCH /api/roles/:id`
Update a custom role's permissions. System roles cannot be modified.
**Body:** `{ permissions: string[] }`
**Response:** `{ data: Role }`

#### `DELETE /api/roles/:id`
Delete a custom role. System roles cannot be deleted. Users on this role are reassigned to `ops-user`.
**Response:** `{ data: null }` (204)

#### `GET /api/team`
List team members for the org with hierarchy.
**Response:** `{ data: TeamMember[] }` — includes role, reporting_to, department

#### `POST /api/team/invite`
Invite a new team member. Triggers Clerk invite. **Permission required:** `manage_team`
**Body:** `{ email: string, role_id: string, reporting_to?: string, department?: string }`

#### `PATCH /api/team/:userId`
Update a team member's role, department, or reporting-to.
**Body:** `{ role_id?: string, reporting_to?: string, department?: string }`

#### `DELETE /api/team/:userId`
Deactivate a team member (soft delete — keeps audit trail).

### Org Hierarchy

#### `GET /api/org/hierarchy`
Returns the org hierarchy as a tree structure.
**Response:** `{ data: OrgNode }` — recursive tree with `children: OrgNode[]`

#### `POST /api/org/sub-orgs`
Create a sub-org. **Permission required:** `manage_settings`
**Body:** `{ name: string, org_level: 'suborg' | 'department' | 'team', parent_org_id: string }`
**Validation:** Max 4 levels deep.

#### `PATCH /api/org/:id`
Update an org's name, level, or parent. **Permission required:** `manage_settings`

### Routing & Policy

#### `GET /api/routing/policies`
List routing policies for the org.
**Response:** `{ data: Block[] }` — Policy blocks with `policy_type` filtering

#### `POST /api/routing/resolve`
Resolve a routing decision for a given step + context. Used internally by workflow engine.
**Body:** `{ step_config: object, confidence: number, risk_level: string }`
**Response:** `{ data: { route: 'human' | 'agent' | 'auto', reason: string } }`

### Notifications

#### `GET /api/notifications`
List notifications for the current user. Supports `?unread=true` filter.
**Response:** `{ data: Notification[], meta: { unread_count: number } }`

#### `PATCH /api/notifications/:id/read`
Mark a notification as read.

#### `POST /api/notifications/read-all`
Mark all notifications as read for the current user.

### Document Storage & Versioning

#### `POST /api/documents/upload`
Upload a reference document (PDF/DOCX/HTML) as a document_template block.
**Body:** `multipart/form-data` — file + metadata (name, category)
**Response:** `{ data: { block: Block, storage_path: string } }` (201)

#### `GET /api/documents/:blockId/versions`
List all generated document versions for a block.
**Response:** `{ data: DocumentVersion[] }` — version number, created_at, storage_path

#### `GET /api/documents/:blockId/versions/:version`
Download a specific document version.
**Response:** File stream with appropriate Content-Type

### API Key Management

#### `POST /api/api-keys`
Generate a new org API key. **Permission required:** `manage_integrations`
**Response:** `{ data: { key: string, key_id: string, prefix: string } }` — key shown ONCE, never retrievable again

#### `GET /api/api-keys`
List API keys (shows prefix + created_at only, never the full key).

#### `DELETE /api/api-keys/:keyId`
Revoke an API key. Logged as `api_key.revoked` event.

---

## Archived

> Superseded contracts moved here with date and reason. Never deleted.

### [2026-03-04] Phase 1 Workflow Endpoints — superseded by workflow-as-block endpoints

The `GET /api/workflows` (template list) and `GET /api/workflows/jobs/:id` (job status) endpoints above remain active in Phase 1. In Phase 2, they are replaced by:
- `GET /api/workflow-templates` — lists workflow_template Blocks (richer schema, composable definition)
- `GET /api/workflow-instances` — lists workflow_instance Blocks (replaces job status)
- `POST /api/tasks/:id/claim` and `POST /api/tasks/:id/complete` — replace workflow step approve/reject

The Phase 1 endpoints will be deprecated (not removed) when Phase 2 endpoints are production-ready. Clients should migrate to Phase 2 endpoints.
