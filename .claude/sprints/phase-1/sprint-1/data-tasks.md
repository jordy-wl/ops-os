# Data Engineering Tasks — Phase 1, Sprint 1

> Tasks for Data Engineer only. Source of truth: `tasks.md` (master list).
> Run `/load-agent data` then `/next-task` to claim your first task.

---

## Sprint Header

**Phase:** 1 | **Sprint:** 1 | **Role:** DATA-ENGINEER
**Sprint Goal:** Build the seed data that makes design partner demos feel real, and implement the pgvector embedding pipeline that powers future semantic search.
**Your critical path:** DE-01 (seed data) is unblocked as soon as BE-01 (schema) is done. DE-02 (embeddings) depends on BE-01 + BE-03.
**Note on embeddings:** Claude API does not provide embeddings. Use OpenAI `text-embedding-3-small` (1536 dims) or Voyage AI. Add the embedding API key to `.env.example`.

---

## P1-S1-DE-01: Seed Data + Demo Scenario

**Description:** Create seed scripts that populate a realistic capital markets demo scenario. This data is used for: design partner demos, QA fixtures, and local development. It must feel real — not "Test Client 1."

**Demo scenario: "Thornfield Capital Partners — FCA-regulated fund manager onboarding"**

Data to create:
- **Org:** `{ name: "Acme Capital Operations", clerk_org_id: "demo_org_001" }`
- **Blocks:**
  - Client: `Thornfield Capital Partners` — `{ name, aum: "£450M", regulatory_status: "FCA Authorised", relationship_manager: "Emma Hartley", jurisdiction: "GB", type: "fund_manager" }`
  - Deal: `Thornfield Q1 2026 Onboarding` — `{ name, status: "in_progress", estimated_close: "2026-04-30" }`
  - Project: `KYC/AML Review — Thornfield` — `{ name, stage: "document_review", assigned_team: "compliance" }`
  - Contact: `Sarah Okonkwo (CEO)` — `{ name, title: "Chief Executive Officer", email: "s.okonkwo@thornfield.com" }`
  - Contact: `Marcus Webb (CFO)` — `{ name, title: "Chief Financial Officer", email: "m.webb@thornfield.com" }`
- **Edges:** client→deal (owns), client→project (owns), deal→project (related_to), client→contact×2 (has_contact)
- **Events (15 total):** Create a realistic progression:
  1. `onboarding.initiated` — actor: user, "Onboarding initiated by Emma Hartley"
  2. `client.created` — actor: system
  3. `document.requested` — actor: workflow, payload: `{ document_type: "Certificate of Incorporation" }`
  4. `document.requested` — actor: workflow, payload: `{ document_type: "FCA Registration Certificate" }`
  5. `document.received` — actor: user, payload: `{ document_type: "Certificate of Incorporation" }`
  6. `kyc.check.initiated` — actor: workflow
  7. `aml.screening.running` — actor: ai, payload: `{ provider: "ComplyAdvantage" }`
  8. `aml.screening.clear` — actor: ai, payload: `{ risk_score: "low", matches: 0 }`
  9. `document.received` — actor: user, payload: `{ document_type: "FCA Registration Certificate" }`
  10. `compliance.review.required` — actor: workflow, payload: `{ reason: "PEP check required for senior management" }`
  11. `compliance.review.assigned` — actor: user, payload: `{ assignee: "James Osei", team: "compliance" }`
  12. `meeting.scheduled` — actor: user, payload: `{ type: "compliance_call", date: "2026-03-15" }`
  13. `compliance.review.in_progress` — actor: user
  14. `document.requested` — actor: workflow, payload: `{ document_type: "Source of Funds Declaration" }`
  15. `onboarding.step.pending` — actor: system, payload: `{ next_step: "Awaiting Source of Funds Declaration" }`
- **Workflow job (1 pending):** `{ workflow_type: "onboarding", status: "pending", payload: { client_block_id: [id], current_step: "source_of_funds_review" } }`

**Acceptance Criteria:**
- [ ] Seed script at `supabase/seed.sql` or `scripts/seed.ts` runs without errors
- [ ] `npm run db:seed` completes in <10 seconds
- [ ] All 5 blocks with realistic JSONB content
- [ ] All 15 events with realistic `event_type` names and `payload` content; `occurred_at` timestamps span the last 30 days realistically
- [ ] All 6 edges created
- [ ] 1 workflow_job in `pending` status
- [ ] Script is idempotent (safe to run multiple times — upserts or truncates first)
- [ ] Works on both local and remote Supabase

**Applicable Gates:** 1, 5
**Dependencies:** P1-S1-BE-01
**Complexity:** LOW
**Estimate:** 1 day
**Assigned Role:** DATA-ENGINEER

---

## P1-S1-DE-02: pgvector Embedding Pipeline

**Description:** Build the embedding pipeline that generates vector embeddings for events, enabling future semantic search. Sprint 1: synchronous + fire-and-forget (failures don't block event creation).

**Pipeline flow:**
1. `POST /api/events` inserts event
2. Events API calls `embedEvent(event)` after successful insert (async, non-blocking)
3. `embedEvent` generates embedding via `text-embedding-3-small` (1536 dims)
4. Embedding stored in `embeddings` table: `{ source_type: "event", source_id: event.id, content: "...", embedding: [...] }`

**Note:** Claude API does not provide embeddings. Use `openai` package with `text-embedding-3-small` model (1536 dims matching the schema), OR Voyage AI `voyage-3` (1024 dims — update schema if using this). Document choice in `.env.example`.

**Content format for embedding:**
```
"[event_type] on [block.type] '[block.data.name]': [JSON.stringify(payload).slice(0, 200)]"
```
Example: `"compliance.review.required on client 'Thornfield Capital Partners': {\"reason\":\"PEP check required for senior management\"}"`

**Acceptance Criteria:**
- [ ] `embedEvent(event: Event): Promise<void>` exported from `lib/embeddings.ts`
- [ ] Embedding model API key in `.env.example` with description (specify OpenAI or Voyage)
- [ ] After creating an event via `POST /api/events`, an embedding row appears in `embeddings` within 5 seconds
- [ ] `content` field contains meaningful text (not just IDs) per format above
- [ ] Embedding failure is caught, logged with error details, but does NOT cause event creation to fail
- [ ] `GET /api/embeddings/search?q=:query&limit=10` — returns matching event content by cosine similarity (`embedding <=> query_embedding`)
- [ ] Unit test: `embedEvent` with mocked API call stores correct format in DB

**Applicable Gates:** 1, 2, 3, 5
**Dependencies:** P1-S1-BE-01, P1-S1-BE-03
**Complexity:** MEDIUM
**Estimate:** 2 days
**Assigned Role:** DATA-ENGINEER
