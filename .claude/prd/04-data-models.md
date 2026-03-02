# PRD Layer 04: Data Models

> Last updated: 2026-03-02 | Author: Data Engineer / Backend Engineer | Status: DRAFT
> Cross-references: `prd/09-data-pipeline.md` (pipeline), `prd/10-security-compliance.md` (PII handling).
> Data engineer and backend engineer: read this before writing migrations or queries.
> All schema changes via Supabase migrations only — never raw ALTER TABLE in application code.

---

## Data Model Overview

The Ops OS data model has five core entities: **Blocks** (business entities), **Block Edges** (graph connections between Blocks), **Events** (immutable audit log), **Workflow Jobs** (execution queue), and **Embeddings** (semantic search). Everything in the system is either a Block, an event that happened to a Block, or a connection between Blocks.

The central entity is the **Block** — a flexible, stateful business record. A client is a Block. A deal is a Block. A project is a Block. A contract is a Block. Blocks connect to each other via Block Edges, forming the business graph. Every change to every Block is recorded as an Event. Events are immutable — they are never updated or deleted. This is both an architectural pattern (event sourcing) and a product feature (compliance-grade audit trail).

---

## Entity Relationship Summary

```
Org (1) ──── (many) Block
Org (1) ──── (many) Event
Org (1) ──── (many) WorkflowJob
Org (1) ──── (many) Embedding

Block (1) ──── (many) BlockEdge [as from_block]
Block (1) ──── (many) BlockEdge [as to_block]
Block (1) ──── (many) Event
Block (1) ──── (many) Embedding
Block (1) ──── (many) WorkflowJob

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
| type | TEXT | NO | — | `client`, `deal`, `project`, `contract`, `contact` |
| name | TEXT | NO | MAYBE | Human-readable label (may contain company name) |
| status | TEXT | NO | — | `active`, `archived`, `closed` |
| data | JSONB | NO | MAYBE | Type-specific attributes; review per field |
| jurisdiction | TEXT | YES | — | ISO 3166-1 alpha-2 code (`GB`, `SG`, `US`) or custom |
| org_id | UUID | NO | — | Org isolation key |
| created_by | UUID | YES | — | Clerk user ID of creator |
| created_at | TIMESTAMPTZ | NO | — | Creation timestamp |
| updated_at | TIMESTAMPTZ | NO | — | Last modification timestamp |

**Block types (Phase 1):**
- `client` — a firm or individual being onboarded or managed
- `deal` — a transaction or business engagement
- `project` — a delivery or implementation effort
- `contract` — a legal agreement or SLA
- `contact` — a person at a client firm

**Block types (Phase 2+):** `fund`, `regulatory_filing`, `compliance_case`, `workflow_template`

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

**Immutability enforcement:**
- Supabase RLS policy: no `UPDATE` or `DELETE` on `events` for any role (including service role)
- API layer: no `UPDATE` or `DELETE` routes exist for events
- Test: verified in contract tests (`tests/api/events.test.ts`)

**Indexes:** `(block_id, occurred_at DESC)`, `(org_id, event_type, occurred_at DESC)`, `(actor_id, occurred_at DESC)`

---

### Workflow Job (Execution Queue — Prototype Only)

The Postgres-based workflow execution queue. **Prototype-only. Replace with Temporal in Phase 2.**

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

## Relationship Details

| Relationship | Cardinality | Via | Notes |
|-------------|------------|-----|-------|
| Org → Block | 1:many | blocks.org_id | All blocks scoped to one org |
| Org → Event | 1:many | events.org_id | All events scoped to one org |
| Block → Event | 1:many | events.block_id | A block's complete history |
| Block → Block | many:many | block_edges table | Graph connections; directional |
| Block → Embedding | 1:many | embeddings.source_id | Searchable content per block |
| Event → Embedding | 1:many | embeddings.source_id | Searchable event content |

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
| Should Block `data` JSONB be type-validated (per-type schemas)? | Determines whether to add Zod validation or JSON Schema per block type | Backend Engineer | OPEN |
| What jurisdiction codes are needed for Phase 1 design partners? | Determines enum vs free-text for jurisdiction field | PM | OPEN |
| Should Block Edges support metadata (e.g. relationship start date)? | Adds complexity; needed if graph relationships have temporal aspects | Backend Engineer | OPEN |

---

## Archived

> Superseded entity definitions and relationships moved here. Never deleted.
