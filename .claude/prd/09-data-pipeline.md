# PRD Layer 09: Data Pipeline

> Last updated: 2026-03-02 | Author: Data Engineer | Status: DRAFT
> Cross-references: `prd/04-data-models.md` (entity schema), `prd/07-ai-ml-spec.md` (AI data needs).
> Data engineer: read this before claiming pipeline tasks.

---

## Data Pipeline Overview

The Ops OS data pipeline has two primary flows: the **event ingestion pipeline** (real-time, synchronous) and the **embedding pipeline** (asynchronous, fire-and-forget). The event pipeline is the core of the product — every state change generates an event, and events are the source of truth. The embedding pipeline enriches events and blocks with vector representations for semantic search.

Phase 1 has no external ETL, no data warehouse, and no analytics pipeline beyond basic counts from the operational database. Analytics in Phase 1 means: SQL queries on the `events` and `blocks` tables. Phase 2 introduces materialized views, aggregation jobs, and potentially a dedicated analytics store. The data model is designed to support this migration without schema changes.

---

## Data Sources (Phase 1)

| Source | Type | What It Produces | Volume Estimate | Update Frequency |
|--------|------|-----------------|-----------------|-----------------|
| Actions API | Application events | Immutable events in `events` table | 10–100 events/day at prototype scale | Real-time (synchronous) |
| Workflow engine | System events | Workflow step events in `events` table | 5–50 events/day | Every 60s (Vercel Cron) |
| AI routing decisions | System events | `ai.routing_decision` events in `events` table | 20–200/day | Real-time |
| Block mutations | Application events | Embeddings for blocks and events | 1 embedding per event/block | Async (fire-and-forget) |
| Clerk webhooks | Auth events | User/org records in Supabase | <10/day | On auth event |

Phase 2 data sources (not in scope for Phase 1):
- Salesforce integration (block data sync)
- Email inbox (event extraction via AI)
- Third-party compliance databases

---

## Pipeline Architecture

| Pipeline | Approach | Rationale |
|---------|---------|-----------|
| Event ingestion | Synchronous — every action writes an event atomically | Events must be consistent with actions; no eventual consistency for the audit trail |
| Embedding generation | Async, fire-and-forget — triggered after event creation | Embeddings are for search; slight delay is acceptable; don't block the action response |
| Workflow step execution | Async, Vercel Cron polling (every 60s) | Background processing; not on the critical path for user actions |
| Analytics aggregation | Synchronous SQL queries on events table | Phase 1 volumes are small enough that live queries are acceptable |

---

## Pipeline Specifications

### Pipeline 1: Event Ingestion (Core)

```
Source: Actions API (/api/actions/[type])
  ↓
Transform:
  - Validate action payload (Zod schema)
  - Execute action business logic (create/update block, trigger workflow)
  - Build event record: { event_type, block_id, actor_id, actor_type, payload, org_id }
  - Strip PII from payload before insertion (email, phone — use IDs only)
  ↓
Destination: events table (Supabase Postgres)
  - INSERT only — no UPDATE, no DELETE
  - Within same database transaction as the block mutation
  ↓
Side effect: Queue embedding generation (fire-and-forget — does not block response)
```

**Error handling:** If event INSERT fails, the entire action transaction is rolled back. No action succeeds without its event. This is enforced at the database transaction level.

**Idempotency:** Actions include a client-generated `idempotency_key` (optional). If the same key is submitted twice, the second request returns the original event without re-executing.

**SLA:** < 200ms for the full action + event write cycle (p95).

---

### Pipeline 2: Embedding Generation

```
Source: New event or block created (triggered by event ingestion pipeline)
  ↓
Transform:
  - Call buildEmbeddingContent(source) → clean text representation
    - For events: "Event type: [type]. Block: [block name]. Actor: [actor type]. Summary: [payload summary]"
    - For blocks: "Block name: [name]. Type: [type]. Jurisdiction: [jurisdiction]. Data: [key fields, PII stripped]"
  - Strip PII: remove email, phone number fields before building content
  - Call OpenAI text-embedding-3-small API → 1536-dim vector
  ↓
Destination: embeddings table (Supabase Postgres)
  - INSERT with: source_type, source_id, embedding, content, org_id
  - Update existing row if source_id already has an embedding (block update case)
```

**Error handling:** Fire-and-forget. If embedding fails: log error, continue. Search results will be incomplete for that entity until the next successful embedding. Do not surface embedding failures to the user.

**Idempotency:** Upsert on `(source_type, source_id)` — safe to retry.

**SLA:** Best-effort. Embedding should appear within 5 seconds of the event. Not on the critical path.

**Implementation:** `src/lib/embeddings.ts` — `embedEvent()` and `buildEmbeddingContent()` functions. Called from action handlers as a fire-and-forget side effect.

---

### Pipeline 3: Workflow Step Execution

```
Source: workflow_jobs table (polled every 60s by Vercel Cron)
  ↓
Worker logic:
  - SELECT pending jobs (status = 'pending', scheduled_at <= NOW()) — 1 job at a time
  - UPDATE status → 'running' (claim the job — prevents duplicate execution)
  - Execute step logic based on workflow_type + step_name
  - On success: UPDATE status → 'done', INSERT next step into workflow_jobs
  - On failure: UPDATE status → 'failed' + error message, increment retry_count
  - If retry_count < max_retries: re-insert into workflow_jobs with delay
  ↓
Side effects:
  - Supabase Realtime notifies connected clients of workflow_jobs changes
  - Records event: { event_type: "workflow.step.completed", block_id, actor_type: "workflow" }
```

**Error handling:** If a step fails 3 times (max_retries), it moves to `failed` status. A `workflow.step.failed` event is recorded. The ops lead sees this in the block timeline and can manually intervene.

**Idempotency:** The UPDATE to `running` status uses optimistic locking — `WHERE status = 'pending'` prevents two workers from claiming the same job. Safe even if Vercel Cron fires twice.

**SLA:** Steps execute within 60–120s of being scheduled (Cron frequency × execution time).

**Critical warning:** This workflow engine has no durability guarantees. If the Vercel function is killed mid-execution, the job stays `running` indefinitely (no automatic recovery). This is acceptable for prototype scale (<100 concurrent workflows). Temporal replaces this in Phase 2.

---

## Storage Destinations

| Destination | Format | Purpose | Owner |
|------------|--------|---------|-------|
| `events` table | Postgres rows (append-only) | Primary audit trail and state history | Data Engineer / Backend |
| `blocks` table | Postgres rows (mutable) | Current state of business entities | Data Engineer / Backend |
| `embeddings` table | Postgres + pgvector (1536-dim) | Semantic search index | Data Engineer / AI-ML |
| `workflow_jobs` table | Postgres rows | Execution queue (prototype only) | Data Engineer / Backend |

Phase 2 additions (not in scope):
- Materialized views for analytics aggregation
- Possibly a read replica for heavy analytics queries

---

## Analytics Requirements (Phase 1)

Phase 1 analytics are SQL queries on the operational database — no separate analytics store.

| Question | Required By | How Answered | Data Source |
|----------|------------|-------------|------------|
| How many active blocks per org? | PM | SELECT COUNT(*) FROM blocks WHERE org_id = ? AND status = 'active' | blocks table |
| How many events per day? | PM | SELECT DATE(occurred_at), COUNT(*) FROM events GROUP BY 1 | events table |
| Average onboarding duration? | PM, design partners | MAX(occurred_at) - MIN(occurred_at) per workflow group | events table |
| Which workflow steps take longest? | PM | Time between workflow.step events per step name | events table |
| Design partner activity (last 7 days) | PM | events WHERE occurred_at > NOW() - INTERVAL '7 days' | events table |
| AI routing decisions logged | AI/ML | SELECT COUNT(*) FROM events WHERE event_type = 'ai.routing_decision' | events table |

**Dashboard (Phase 1):** These queries power the stats strip on the dashboard. Executed server-side on each page load. Cached for 30s.

---

## Data Quality Requirements

| Dimension | Requirement | How Measured | Action on Failure |
|-----------|------------|-------------|------------------|
| Event immutability | Zero UPDATE or DELETE on events table | Database-level RLS policy; contract test | RLS policy blocks mutation; alert |
| Org isolation | Zero cross-org data access | All queries include org_id; contract tests | Query blocked at DB level |
| Event completeness | Every action has a corresponding event | Contract test: action handler must insert event atomically | Rollback entire action if event fails |
| Embedding freshness | >90% of events have an embedding within 5 minutes | Query: events LEFT JOIN embeddings WHERE embeddings.source_id IS NULL | Alert; retry embedding job |
| No PII in logs | Zero PII in Vercel log output | Security scan in CI | Block deployment |

---

## Data Retention

| Data | Retention Policy | Reason |
|------|-----------------|--------|
| Events | Indefinite | Audit trail is a core product feature; compliance requires it |
| Blocks | Until org deletion | Active business records |
| Embeddings | Until source event/block is deleted | Search index; derived data |
| Workflow jobs (completed) | 90 days | Operational logs; not compliance-critical |
| Workflow jobs (failed) | 365 days | Audit of failed automations |

**Data deletion:** When an org requests account deletion, all their data is purged across all tables. `org_id` foreign key cascade handles this if the `orgs` table row is deleted. Verify cascade behaviour in migrations.

---

## Data Access Patterns

| Consumer | What They Query | Access Method | Frequency |
|---------|----------------|--------------|-----------|
| Next.js API routes | All tables | Supabase client (service role on server) | Per API request |
| Frontend (authenticated) | blocks, events (via API) | REST API | Per user action |
| AI context assembly | blocks + events for a block | Supabase client (server) | Per AI chat message |
| Embedding pipeline | New events/blocks | Supabase client (server) | Fire-and-forget |
| Analytics (PM) | Event counts, durations | Direct Supabase SQL (Phase 1) | Daily |
| Semantic search | embeddings (cosine similarity) | match_embeddings() RPC | Per search query |

---

## Pipeline Monitoring (Phase 1)

| Pipeline | Alert Condition | How to Detect | Action |
|---------|----------------|--------------|--------|
| Workflow engine | Jobs stuck in 'running' for >10 min | Query: workflow_jobs WHERE status = 'running' AND started_at < NOW() - INTERVAL '10 min' | Manual intervention; restart job |
| Embedding pipeline | >10% of recent events missing embeddings | Query: events LEFT JOIN embeddings | Retry embedding generation |
| Event volume | Zero events in last 24h (design partners active) | Query: events WHERE occurred_at > NOW() - '24h' | Check design partner activity |

Phase 2: automated alerting via Datadog or Axiom.

---

## Archived

> Superseded pipeline designs moved here. Never deleted.
