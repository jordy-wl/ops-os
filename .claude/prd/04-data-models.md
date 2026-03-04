# PRD Layer 04: Data Models

> Last updated: 2026-03-04 | Author: Data Engineer / Backend Engineer | Status: DRAFT
> Cross-references: `prd/09-data-pipeline.md` (pipeline), `prd/10-security-compliance.md` (PII handling).
> Data engineer and backend engineer: read this before writing migrations or queries.
> All schema changes via Supabase migrations only — never raw ALTER TABLE in application code.

---

## Data Model Overview

The Ops OS data model has seven core entities: **Blocks** (business entities), **Block Edges** (graph connections between Blocks), **Block Type Definitions** (custom block schemas), **Events** (immutable audit log), **Workflow Jobs** (Phase 1 execution queue), **Integration Connectors** (external system connections), and **Embeddings** (semantic search). Everything in the system is either a Block, an event that happened to a Block, or a connection between Blocks.

The central entity is the **Block** — a flexible, stateful business record. A client is a Block. A deal is a Block. A project is a Block. A contract is a Block. **In Phase 2, workflow templates are also Blocks** — they store the full workflow definition (triggers, steps, conditions, edges) in their `data` JSONB field. When triggered, a workflow template Block spawns a workflow instance Block that tracks runtime state. This "workflow-as-block" pattern means workflow definitions live in the business graph, connect to entities via edges, and generate events like any other Block. Blocks connect to each other via Block Edges, forming the business graph. Every change to every Block is recorded as an Event. Events are immutable — they are never updated or deleted. This is both an architectural pattern (event sourcing) and a product feature (compliance-grade audit trail).

---

## Entity Relationship Summary

```
Org (1) ──── (many) Block
Org (1) ──── (many) BlockTypeDefinition
Org (1) ──── (many) Event
Org (1) ──── (many) WorkflowJob [Phase 1 only]
Org (1) ──── (many) IntegrationConnector [Phase 2+]
Org (1) ──── (many) Embedding

Block (1) ──── (many) BlockEdge [as from_block]
Block (1) ──── (many) BlockEdge [as to_block]
Block (1) ──── (many) Event
Block (1) ──── (many) Embedding
Block (1) ──── (many) WorkflowJob [Phase 1 only]

BlockTypeDefinition (1) ──── (many) Block [via type_key matching block.type]

Workflow-as-Block relationships [Phase 2+]:
  workflow_template Block ──(instance_of)──> workflow_instance Block ──(processing)──> Entity Block
  workflow_instance Block ──(spawned)──> task_queue_item Block

BlockEdge: Block (many) ──── (many) Block [via relationship type]

User (Clerk) → org_id resolves to Org
```

---

## Core Entities

### Org

The root of multi-tenancy. Each customer firm is one Org. All data is isolated by `org_id`.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | UUID | NO | Primary identifier |
| name | TEXT | NO | Human-readable org name |
| slug | TEXT | NO | URL-safe unique identifier |
| clerk_org_id | TEXT | YES | Clerk organisation ID for auth sync |
| plan | TEXT | NO | `prototype` / `starter` / `growth` / `enterprise` |
| settings | JSONB | NO | Org-level config (default: `{}`) |
| created_at | TIMESTAMPTZ | NO | Creation timestamp |

**Indexes:** `slug` (unique), `clerk_org_id` (unique)

---

### Block

The fundamental business entity. Type-flexible via JSONB `data` field.

| Field | Type | Nullable | PII? | Description |
|-------|------|----------|------|-------------|
| id | UUID | NO | — | Primary identifier |
| type | TEXT | NO | — | System types + org-defined custom types (see block_type_definitions) |
| name | TEXT | NO | MAYBE | Human-readable label (may contain company name) |
| status | TEXT | NO | — | `active`, `archived`, `closed` |
| data | JSONB | NO | MAYBE | Type-specific attributes; review per field |
| jurisdiction | TEXT | YES | — | ISO 3166-1 alpha-2 code (`GB`, `SG`, `US`) or custom |
| org_id | UUID | NO | — | Org isolation key |
| created_by | UUID | YES | — | Clerk user ID of creator |
| created_at | TIMESTAMPTZ | NO | — | Creation timestamp |
| updated_at | TIMESTAMPTZ | NO | — | Last modification timestamp |

**Block types (Phase 1 — system-defined):**
- `client` — a firm or individual being onboarded or managed
- `deal` — a transaction or business engagement
- `project` — a delivery or implementation effort
- `contract` — a legal agreement or SLA
- `contact` — a person at a client firm

**Block types (Phase 2 — system-defined):**
- `workflow_template` — stores the full workflow definition (triggers, steps, conditions, edges) in `data` JSONB. See Workflow Template Data Schema below.
- `workflow_instance` — spawned when a workflow_template is triggered. Tracks runtime state (current step, variable context, started/completed timestamps). Connected to the template via `instance_of` edge and to the entity being processed via `processing` edge.
- `task_queue_item` — spawned by `route_human` or `route_agent` workflow steps. Represents pending work assigned to a person or AI agent. Fields: `assignee_type` (human/agent), `assignee_id`, `due_at`, `priority`, `claimed_at`, `completed_at`.
- `fund` — a financial fund or investment vehicle
- `regulatory_filing` — a regulatory submission or filing
- `compliance_case` — an open compliance review or investigation

**Block types (Phase 2+ — org-defined custom types):** Organisations can define their own block types via the `block_type_definitions` table. Custom types have org-scoped field schemas (JSON Schema draft-07) that validate the `data` JSONB field on create/update.

**PII in this entity:**
- `name` — may be a person's name for `contact` type blocks. Handle: never log raw; review before including in AI prompts
- `data` JSONB — may contain email, phone, address for contacts. Audit each field. Never log JSONB content in plaintext.

**Indexes:** `(org_id, type)`, `(org_id, status)`, `(org_id, created_at DESC)`

---

### Block Edge (Graph Connections)

First-class, directional relationships between Blocks. The edges define the business graph.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| from_block_id | UUID | NO | Source block (FK → blocks.id) |
| to_block_id | UUID | NO | Target block (FK → blocks.id) |
| relationship | TEXT | NO | Relationship type label |
| org_id | UUID | NO | Org isolation key |
| created_by | UUID | YES | Clerk user ID of creator |
| created_at | TIMESTAMPTZ | NO | Creation timestamp |

**Primary key:** `(from_block_id, to_block_id, relationship)` — composite

**Standard relationship types (Phase 1):**
- `part_of` — deal or project is part of a client relationship
- `governed_by` — project is governed by a contract
- `owned_by` — block is owned by / assigned to a contact or user
- `related_to` — general association (for use when a more specific type doesn't apply)
- `counterparty_to` — for deal blocks

**Standard relationship types (Phase 2 — workflow-as-block):**
- `instance_of` — workflow_instance → workflow_template (which template was used)
- `processing` — workflow_instance → entity block (which entity this workflow is operating on)
- `spawned` — workflow_instance → task_queue_item (tasks created by this workflow run)
- `triggered_by` — workflow_instance → event or integration_connector (what started this workflow)

**Indexes:** `from_block_id`, `to_block_id`

---

### Event (Immutable Audit Log)

The most important table. Append-only. **Never UPDATE or DELETE.** Enforced via Supabase RLS.

| Field | Type | Nullable | PII? | Description |
|-------|------|----------|------|-------------|
| id | UUID | NO | — | Primary identifier |
| block_id | UUID | YES | — | Related block (NULL for org-level events) |
| event_type | TEXT | NO | — | Namespaced type: `block.created`, `workflow.step.completed` |
| actor_id | TEXT | YES | PSEUDONYMOUS | Clerk user ID or NULL for system/workflow actors |
| actor_type | TEXT | NO | — | `user`, `workflow`, `ai`, `system` |
| payload | JSONB | NO | MAYBE | Event-specific data — audit before logging |
| org_id | UUID | NO | — | Org isolation key |
| occurred_at | TIMESTAMPTZ | NO | — | When the event happened (not insertion time) |

> **No `updated_at` field.** Events are immutable by design.

**Standard event types (Phase 1):**

| Event Type | Fired When |
|------------|-----------|
| `block.created` | A new Block is created |
| `block.updated` | Block data is modified via an Action |
| `block.status_changed` | Block status changes |
| `block.edge.created` | A graph connection is established |
| `workflow.started` | A workflow is triggered for a Block |
| `workflow.step.completed` | A workflow step completes successfully |
| `workflow.step.failed` | A workflow step fails |
| `workflow.completed` | All workflow steps are done |
| `action.requested` | An action is submitted (AI or user) |
| `action.approved` | A human approves a pending action |
| `action.executed` | An action is executed |
| `action.rejected` | A human rejects a pending action |
| `ai.routing_decision` | AI routing decision logged (confidence, risk, outcome) |
| `user.comment` | A human adds a comment or note to a Block |
| **Phase 2 event types** | |
| `block_type.created` | A custom block type definition is created |
| `block_type.updated` | A custom block type definition is modified |
| `workflow.template.published` | A workflow template is published (ready to trigger) |
| `workflow.instance.spawned` | A workflow instance is created from a template |
| `workflow.instance.completed` | A workflow instance finishes all steps |
| `workflow.instance.failed` | A workflow instance fails and cannot continue |
| `task.created` | A task_queue_item block is spawned by a workflow step |
| `task.claimed` | A human or agent claims a task_queue_item |
| `task.completed` | A task_queue_item is marked done |
| `task.reassigned` | A task_queue_item is reassigned to a different person/agent |
| `integration.webhook.received` | An inbound webhook is received from an external system |
| `integration.api_call.completed` | An outbound API call to an external system completes |
| `integration.api_call.failed` | An outbound API call to an external system fails |

**Immutability enforcement:**
- Supabase RLS policy: no `UPDATE` or `DELETE` on `events` for any role (including service role)
- API layer: no `UPDATE` or `DELETE` routes exist for events
- Test: verified in contract tests (`tests/api/events.test.ts`)

**Indexes:** `(block_id, occurred_at DESC)`, `(org_id, event_type, occurred_at DESC)`, `(actor_id, occurred_at DESC)`

---

### Workflow Job (Phase 1 Only — Replaced by Workflow Instance Blocks in Phase 2)

The Postgres-based workflow execution queue. **Phase 1 only.** In Phase 2, workflow execution is modelled as `workflow_instance` Blocks with `task_queue_item` Blocks for individual steps. The WorkflowJob table remains for Phase 1 backwards compatibility and is archived below when Phase 2 migration completes.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | UUID | NO | Primary identifier |
| workflow_type | TEXT | NO | e.g. `client_onboarding_london` |
| step_name | TEXT | NO | e.g. `send_kyc_request` |
| status | TEXT | NO | `pending`, `running`, `done`, `failed` |
| payload | JSONB | NO | Step-specific data |
| block_id | UUID | YES | Related block (FK → blocks.id) |
| org_id | UUID | NO | Org isolation key |
| scheduled_at | TIMESTAMPTZ | NO | When to execute (default: NOW()) |
| started_at | TIMESTAMPTZ | YES | When worker claimed the job |
| completed_at | TIMESTAMPTZ | YES | When job completed or failed |
| error | TEXT | YES | Error message if failed |
| retry_count | INTEGER | NO | Number of retries attempted (default: 0) |
| max_retries | INTEGER | NO | Maximum allowed retries (default: 3) |

**Indexes:** `(status, scheduled_at)` WHERE status = 'pending' — partial index for efficient polling

---

### Embedding (Semantic Search)

Vector embeddings for semantic search across Blocks and Events. Powered by pgvector.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | UUID | NO | Primary identifier |
| source_type | TEXT | NO | `event`, `block`, `block_data` |
| source_id | UUID | NO | FK to blocks.id or events.id |
| embedding | vector(1536) | YES | OpenAI text-embedding-3-small dimensions |
| content | TEXT | NO | The text that was embedded (used for retrieval) |
| org_id | UUID | NO | Org isolation key |
| created_at | TIMESTAMPTZ | NO | Creation timestamp |

**Indexes:** `(org_id)`, IVFFlat index on embedding for cosine similarity: `USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`

---

### Block Type Definition (Phase 2 — Custom Block Types)

Defines a block type's schema and display properties. System types are seeded with `org_id = NULL`. Org-specific types are scoped to the org.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | UUID | NO | Primary identifier |
| org_id | UUID | YES | NULL for system-defined types; org UUID for custom types |
| type_key | TEXT | NO | Machine-readable type key (e.g. `client`, `workflow_template`, `invoice`) |
| display_name | TEXT | NO | Human-readable name (e.g. "Client", "Workflow Template") |
| icon | TEXT | YES | Icon identifier (e.g. `building`, `workflow`, `file-text`) |
| color | TEXT | YES | Display colour (hex or Tailwind class) |
| field_schema | JSONB | NO | JSON Schema draft-07 defining the structure of Block.data for this type |
| is_system | BOOLEAN | NO | TRUE for system-defined types; cannot be modified by orgs |
| created_by | UUID | YES | Clerk user ID of creator |
| created_at | TIMESTAMPTZ | NO | Creation timestamp |
| updated_at | TIMESTAMPTZ | NO | Last modification timestamp |

**Unique constraint:** `(org_id, type_key)` — each type key is unique within an org (or globally for system types)

**System-seeded types (Phase 1):** `client`, `deal`, `project`, `contract`, `contact`
**System-seeded types (Phase 2):** `workflow_template`, `workflow_instance`, `task_queue_item`, `fund`, `regulatory_filing`, `compliance_case`

---

### Workflow Template Data Schema (Phase 2)

When a Block has `type = 'workflow_template'`, its `data` JSONB field must conform to this schema:

```json
{
  "version": 1,
  "applies_to_type": "client",
  "triggers": [
    {
      "id": "t1",
      "type": "manual|event|schedule|webhook|api_signal|workflow_completion",
      "config": {}
    }
  ],
  "steps": [
    {
      "id": "s1",
      "type": "create_block|update_block|create_edge|route_human|route_agent|generate_doc|send_notify|call_api|start_workflow|wait",
      "name": "Human-readable step name",
      "config": {}
    }
  ],
  "conditions": [
    {
      "id": "c1",
      "type": "field_condition|status_condition|time_condition|role_condition|graph_condition",
      "config": {}
    }
  ],
  "edges": [
    { "from": "t1", "to": "s1", "condition_id": null, "label": "optional" }
  ],
  "branching": [
    {
      "id": "b1",
      "type": "if_else|switch|parallel|loop|approval_gate",
      "config": {}
    }
  ]
}
```

**Trigger types (6):** `manual`, `event` (on specific event_type), `schedule` (cron expression), `webhook` (inbound HTTP), `api_signal` (from integration connector), `workflow_completion` (when another workflow finishes)

**Action step types (10):** `create_block`, `update_block`, `create_edge`, `route_human`, `route_agent`, `generate_doc`, `send_notify`, `call_api`, `start_workflow`, `wait`

**Condition types (5):** `field_condition`, `status_condition`, `time_condition`, `role_condition`, `graph_condition`

**Branching types (5):** `if_else`, `switch`, `parallel`, `loop`, `approval_gate`

**Template variables:** `{{block.*}}`, `{{context.*}}`, `{{now}}`, `{{org.*}}`, `{{trigger.*}}` — interpolated at runtime in step configs.

---

### Integration Connector (Phase 2)

External system connections for inbound webhooks and outbound API calls.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | UUID | NO | Primary identifier |
| org_id | UUID | NO | Org isolation key |
| name | TEXT | NO | Human-readable name (e.g. "Salesforce Production") |
| provider | TEXT | NO | `salesforce`, `xero`, `webhook`, `custom_api` |
| direction | TEXT | NO | `inbound`, `outbound`, `bidirectional` |
| config | JSONB | NO | Connection config (base URL, auth type, headers — secrets in env vars, NOT in JSONB) |
| credentials_ref | TEXT | YES | Reference to secrets manager key (never store credentials in DB) |
| status | TEXT | NO | `active`, `paused`, `error`, `pending_auth` |
| last_sync_at | TIMESTAMPTZ | YES | Last successful sync/webhook receipt |
| created_by | UUID | YES | Clerk user ID of creator |
| created_at | TIMESTAMPTZ | NO | Creation timestamp |
| updated_at | TIMESTAMPTZ | NO | Last modification timestamp |

**Indexes:** `(org_id, provider)`, `(org_id, status)`

**Phase 2 providers:** `webhook` (generic inbound), `custom_api` (generic outbound)
**Phase 3 providers:** `salesforce`, `xero`, `email`

---

## Relationship Details

| Relationship | Cardinality | Via | Notes |
|-------------|------------|-----|-------|
| Org → Block | 1:many | blocks.org_id | All blocks scoped to one org |
| Org → BlockTypeDefinition | 1:many | block_type_definitions.org_id | Custom types per org; NULL org_id = system types |
| Org → Event | 1:many | events.org_id | All events scoped to one org |
| Org → IntegrationConnector | 1:many | integration_connectors.org_id | External connections per org (Phase 2) |
| Block → Event | 1:many | events.block_id | A block's complete history |
| Block → Block | many:many | block_edges table | Graph connections; directional |
| Block → Embedding | 1:many | embeddings.source_id | Searchable content per block |
| Event → Embedding | 1:many | embeddings.source_id | Searchable event content |
| BlockTypeDefinition → Block | 1:many | block.type = block_type_definitions.type_key | Type schema governs block data validation (Phase 2) |
| workflow_template Block → workflow_instance Block | 1:many | block_edges (instance_of) | Template spawns instances (Phase 2) |
| workflow_instance Block → entity Block | many:1 | block_edges (processing) | Instance processes an entity (Phase 2) |
| workflow_instance Block → task_queue_item Block | 1:many | block_edges (spawned) | Instance creates tasks (Phase 2) |

---

## PII Inventory

| Table | Field | Classification | At Rest | In Logs | In Prompts | Retention |
|-------|-------|---------------|---------|---------|-----------|----------|
| blocks | name (contact type) | Level 1 — Direct Identifier | Standard | NEVER | NEVER without pseudonymisation | Until org deletion |
| blocks | data->>'email' | Level 1 — Direct Identifier | Standard | NEVER | NEVER | Until org deletion |
| blocks | data->>'phone' | Level 1 — Direct Identifier | Standard | NEVER | NEVER | Until org deletion |
| events | actor_id | Level 2 — Pseudonymous | Standard | OK (user ID only) | OK (user ID only) | Indefinite (audit trail) |
| events | payload | MAYBE — audit each type | Standard | NEVER raw payload | Audit before use | Indefinite (audit trail) |
| embeddings | content | MAYBE — derived from blocks/events | Standard | NEVER | OK if PII stripped from source | Until source deleted |

---

## Data Volume Estimates (Prototype — Phase 1 End)

| Table | Rows | Notes |
|-------|------|-------|
| orgs | 3–5 | Design partners only |
| blocks | 50–500 | ~100 blocks per design partner |
| block_edges | 200–2,000 | ~4 edges per block average |
| events | 1,000–10,000 | ~20–50 events per block over Phase 1 |
| workflow_jobs | 100–1,000 | |
| embeddings | 1,000–10,000 | 1 embedding per event + block |

All within Supabase free tier (500MB database).

---

## Data That Changes Frequently vs. Rarely

**Changes frequently:**
- `blocks.status` — changes as blocks move through workflows
- `blocks.data` — changes on every block update action
- `blocks.updated_at` — updates on every action

**Changes rarely (safe to cache):**
- `orgs` — set at account creation; rarely updated
- `block_edges` — connections are established and rarely removed
- `workflow_jobs` (completed/failed rows) — terminal state; never change

---

## Open Data Model Questions

| Question | Impact | Owner | Status |
|----------|--------|-------|--------|
| ~~Should Block `data` JSONB be type-validated (per-type schemas)?~~ | ~~Determines whether to add Zod validation or JSON Schema per block type~~ | ~~Backend Engineer~~ | **CLOSED** — Yes. Phase 2 `block_type_definitions.field_schema` (JSON Schema draft-07) validates Block.data on create/update. System types seeded; orgs define custom types. Decision: 2026-03-04. |
| What jurisdiction codes are needed for Phase 1 design partners? | Determines enum vs free-text for jurisdiction field | PM | OPEN |
| Should Block Edges support metadata (e.g. relationship start date)? | Adds complexity; needed if graph relationships have temporal aspects | Backend Engineer | OPEN |
| How should workflow template versioning work? | When a template is edited, should running instances use the old or new version? | Backend Engineer | OPEN — Phase 2 |
| What is the SLA guarantee for task_queue_item claim time? | Affects whether route_human steps need escalation rules | PM | OPEN — Phase 2 |

---

## Archived

> Superseded entity definitions and relationships moved here. Never deleted.

### [2026-03-04] WorkflowJob table — superseded by workflow_instance Blocks

The `workflow_jobs` table (defined above) remains active in Phase 1 as the Postgres-based execution queue. In Phase 2, its functionality is replaced by the workflow-as-block pattern: `workflow_instance` Blocks track execution state, `task_queue_item` Blocks replace individual job steps, and the event timeline replaces the `started_at`/`completed_at`/`error` fields. The `workflow_jobs` table will be archived (not deleted) when Phase 2 migration is complete. Migration plan: create workflow_instance Blocks from active workflow_jobs, then stop writing new workflow_jobs rows.
