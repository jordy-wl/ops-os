# PRD Layer 03: System Architecture

> Last updated: 2026-03-04 | Author: Orchestrator / Researcher | Status: DRAFT
> Cross-references: `research/findings/tech-stack-recommendation.md` (stack rationale, PM approved 2026-03-02).
> Backend engineer and DevOps engineer: read this before planning.

---

## Architecture Overview

Ops OS is an event-sourced, graph-connected, AI-routed business operating system. The fundamental architectural decision — non-negotiable — is that the system mutates state only through Actions (a command pattern), and every mutation is recorded as an immutable Event in an append-only log. No data is ever updated in place; the event timeline is the single source of truth.

Business entities (Blocks) are graph-connected: a client Block connects to deal Blocks, project Blocks, contact Blocks, and contract Blocks. AI that reads the full graph can answer questions with complete business context, not just the contents of a single record. This is the structural advantage over competitors that store entities in silos.

Workflow execution in Phase 1 uses a Postgres job queue — simple, controllable, insufficient for production at scale. **In Phase 2, workflow definitions become Blocks in the business graph** (the "workflow-as-block" pattern): workflow templates store their full definition (triggers, steps, conditions, edges) as JSONB data, and when triggered they spawn workflow instance Blocks that track runtime state. This means workflows are first-class entities — they appear in the graph, generate events, and connect to other Blocks. The architecture is designed so the execution backend can be swapped (Postgres queue → Temporal in Phase 4) without touching the workflow-as-block data model. Similarly, the auth layer is wrapped behind `withAuth` middleware so Clerk can be replaced with WorkOS for enterprise SSO without touching every route.

---

## Confirmed Tech Stack

> PM-approved 2026-03-02. Full rationale in `research/findings/tech-stack-recommendation.md`.

| Layer | Technology | Tier | Rationale |
|-------|-----------|------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind + shadcn/ui | Prototype → Production (same) | Standard full-stack React; shadcn/ui gives production-quality components with zero design cost |
| Backend Runtime | Next.js API routes → Bun/Node.js services | Prototype → Production | Co-located for prototype; separate services when workflow engine needs long-running processes |
| Database | Supabase (Postgres + pgvector + Realtime) | Prototype → Neon/RDS + Redis | Zero ops overhead; pgvector for semantic search; Realtime for live dashboards |
| Auth | Clerk | Prototype → WorkOS (enterprise SSO) | Multi-tenant, org support, RBAC out of the box; saves 3–6 months of auth engineering |
| Workflow Engine | Postgres job queue (custom, minimal) | Prototype → Temporal | Fast to build; Temporal gives exactly-once execution semantics at production |
| AI — Reasoning | claude-sonnet-4-6 | Prototype → claude-opus-4-6 for highest-stakes | Best-in-class for long-context agentic reasoning and tool use |
| AI — Extraction | claude-haiku-4-5-20251001 | Same | Cost-efficient for high-volume structured extraction tasks |
| AI — Embeddings | OpenAI text-embedding-3-small (1536 dims) | Same | Claude API does not provide embeddings; OpenAI is cost-effective |
| Real-time | Supabase Realtime | Prototype → custom WebSocket if needed | Built into Supabase; zero overhead for prototype |
| Infrastructure | Vercel + Supabase free/hobby | AWS (ECS/Fargate) or Railway + Terraform IaC | Zero DevOps at prototype; full IaC at production |
| Email / Notifications | Resend | Resend → Sendgrid Enterprise | Commodity; generous free tier |
| Monitoring | Vercel Analytics + Supabase Dashboard | OpenTelemetry + Datadog or Axiom | No-config at prototype; full observability at production |
| CI/CD | GitHub Actions (auto via Vercel) | GitHub Actions + full pipeline | Automatic Vercel deployment from GitHub push |

---

## Architectural Principles

1. **Events are the source of truth:** Every state change is an immutable event. The current state of any Block is derived from its event history. This is both an engineering pattern and a product feature — the audit trail is the system, not a derivative.

2. **Actions are the only mutation path:** All state changes flow through the Actions API. No direct writes to entity tables from the frontend or from AI. This makes every change auditable and routing-safe.

3. **Graph-first context:** Business entities connect to each other. AI reads the full connected graph before responding — not just a single record. This is what makes Ops OS AI qualitatively different from competitors that bolt AI onto siloed data.

4. **Conservative AI by default:** AI confidence threshold starts at 1.0 (all actions require human approval). Auto-execution is unlocked incrementally, with calibration data, never speculatively.

5. **Swappable primitives:** Workflow engine (Postgres → Temporal), auth (Clerk → WorkOS), graph (adjacency list → Apache AGE) — each layer is behind an interface that allows swapping without touching the API surface.

---

## System Components

| Component | Responsibility | Technology | Owner Role | Phase |
|-----------|---------------|-----------|-----------|-------|
| Web Application | Frontend UI + API routes | Next.js 15 | Frontend / Backend Engineer | 1 |
| Blocks API | CRUD for business entities | Next.js API routes | Backend Engineer | 1 |
| Events API | Append-only event log (read only) | Next.js API routes | Backend Engineer | 1 |
| Actions Gateway | All state mutations; AI confidence routing | Next.js API routes | Backend / AI-ML Engineer | 1 |
| Workflow Engine (Phase 1) | Job queue polling and step execution | Postgres + Vercel Cron | Backend Engineer | 1 |
| AI Service | Chat control plane, action routing, semantic search | Claude API + pgvector | AI/ML Engineer | 1 |
| Auth Layer | Multi-tenant auth, JWT validation, RBAC | Clerk | Backend Engineer | 1 |
| Database | All persistent storage + real-time subscriptions | Supabase (Postgres + pgvector) | Data Engineer | 1 |
| Block Type Manager | Custom block type CRUD, field schema validation | Next.js API routes | Backend Engineer | 2 |
| Workflow Builder API | Workflow template CRUD, trigger/step/condition management | Next.js API routes | Backend Engineer | 2 |
| Workflow Runtime (Phase 2) | Instance spawning, step execution via workflow-as-block | Next.js + Supabase | Backend Engineer | 2 |
| Task Queue Service | Human/agent task routing, claim, complete, reassign | Next.js API routes | Backend Engineer | 2 |
| Integration Connector | Inbound webhooks, outbound API calls to external systems | Next.js API routes | Backend Engineer | 2 |
| Operational Intelligence | Design vs reality analysis (template → instance comparison) | Claude API | AI/ML Engineer | 3 |
| Agent Queue Processor | AI agent that processes route_agent task_queue_items | Claude API | AI/ML Engineer | 3 |
| Document Generation | Template-based document creation from block data | Next.js + template engine | Backend Engineer | 3 |
| Visual Workflow Builder | React Flow canvas for composing workflow templates | React Flow | Frontend Engineer | 3 |

---

## Component Communication

| From | To | How | Sync/Async | Notes |
|------|----|-----|-----------|-------|
| Browser | Next.js API routes | HTTPS REST | Sync | Clerk JWT in Authorization header |
| API routes | Supabase | Supabase JS client | Sync | Connection pooling via Supabase |
| API routes | Claude API | HTTPS (Anthropic SDK) | Sync (streaming for chat) | Streaming SSE for chat endpoint |
| API routes | OpenAI | HTTPS | Sync | Embeddings only — no user PII |
| Vercel Cron | workflow_jobs table | Poll + UPDATE | Async | Polls for pending jobs every 60s |
| Supabase Realtime | Browser | WebSocket | Async | Event updates pushed to dashboard |

---

## Data Flow: Core User Journey (Client Onboarding)

```
1. Ops Lead types "Start onboarding for Thornfield Capital" in chat

2. Browser → POST /api/ai/chat
   → withAuth validates Clerk JWT → extracts org_id
   → AI assembles context: relevant blocks from graph + recent events
   → Claude interprets intent → action_type: "workflow.trigger"
   → Confidence routing: threshold = 1.0, risk = HIGH → route to human
   → Response streamed: "I'll trigger London client onboarding for Thornfield. Approve?"

3. Ops Lead approves → POST /api/actions/workflow.trigger
   → withAuth validates → org isolation enforced
   → Action handler validates payload + checks Block exists in this org
   → Inserts workflow_jobs row (status: pending)
   → Records event: { event_type: "workflow.started", block_id: ..., actor_type: "user" }
   → Returns { status: "executed", event: { ... } }

4. Vercel Cron polls workflow_jobs
   → Claims pending job → status: running
   → Executes first step: "send KYC request"
   → Records event: { event_type: "workflow.step.completed", step: "kyc_request" }
   → Inserts next step into workflow_jobs
   → Embedding queued for new event (fire-and-forget)

5. Ops Lead: "What's the status of Thornfield?" → POST /api/ai/chat
   → AI assembles context: all events for Thornfield Capital block
   → Returns: "Thornfield Capital onboarding is at step 2 of 5.
               Current step: AML check, pending compliance team."
```

---

## Workflow-as-Block Architecture (Phase 2)

The core insight: **workflow definitions are Blocks in the business graph**. A workflow template is a Block with `type = 'workflow_template'` that stores triggers, steps, conditions, and edges in its `data` JSONB field. When triggered, it spawns a `workflow_instance` Block that tracks runtime state and connects to the entity being processed.

```
workflow_template Block  ──(instance_of)──>  workflow_instance Block  ──(processing)──>  Client Block
                                                     │
                                              (spawned) edge
                                                     v
                                            task_queue_item Block
```

**Why this pattern matters:**
1. **Design vs reality:** The template defines how work _should_ go; the instance's event timeline shows how it _actually_ went. AI compares them = operational intelligence.
2. **Graph-native:** Workflows appear in the business graph, connected to entities. "Show me all workflows touching Thornfield Capital" is a graph traversal, not a separate query.
3. **Composable:** Workflows can trigger other workflows (`start_workflow` step type). Templates reference each other by ID.
4. **Auditable:** Every workflow state change is an Event. The immutable timeline applies to workflows just as it does to clients and deals.

**Execution flow:**
1. Trigger fires (manual, event, schedule, webhook, API signal, workflow completion)
2. System creates a `workflow_instance` Block linked to the template and target entity
3. Runtime evaluates edges from the trigger to first step(s)
4. Each step executes: `create_block`, `update_block`, `route_human`, `route_agent`, `call_api`, etc.
5. `route_human`/`route_agent` steps spawn `task_queue_item` Blocks (assigned, with due dates)
6. Conditions and branching (`if_else`, `switch`, `parallel`, `loop`, `approval_gate`) control flow
7. Each state transition records an Event; completion updates the instance Block status

**Integration layer (Phase 2):**
- **Inbound:** Integration connectors receive webhooks → create Events → trigger evaluation engine checks if any workflow template has a matching trigger → spawns instances
- **Outbound:** `call_api` workflow steps call external APIs via integration connectors → record success/failure events

---

## External Dependencies

| Service | Purpose | Failure Impact | Alternative |
|---------|---------|----------------|-------------|
| Supabase | Postgres + pgvector + Realtime | CRITICAL — primary datastore | Neon + Ably (production) |
| Clerk | Auth + multi-tenant | HIGH — auth fails for all users | WorkOS (Phase 3 if needed) |
| Claude API | AI reasoning and routing | HIGH — chat and routing unavailable | Graceful degradation: manual-only mode |
| OpenAI Embeddings | Semantic search | MEDIUM — search unavailable | Cohere embeddings |
| Vercel | Hosting + serverless functions | HIGH — application unavailable | Railway, Render (30 min migration) |

---

## Architecture Decision Log

| Date | Decision | Options Considered | Rationale | Tradeoffs Accepted |
|------|----------|-------------------|-----------|-------------------|
| 2026-03-02 | Event sourcing as core architecture | Event sourcing, CRUD with history table | Compliance-grade audit trail is a product feature | Higher query complexity for "current state" |
| 2026-03-02 | Postgres adjacency list for graph | Neo4j, Apache AGE, Postgres adjacency list | Zero additional ops; sufficient for prototype | Must spike performance at 10k+ blocks |
| 2026-03-02 | Clerk for auth | NextAuth, Auth.js, Clerk, custom JWT | Multi-tenant + RBAC out of the box | Vendor lock-in; migration cost if pricing changes |
| 2026-03-02 | Postgres queue for workflow engine | Temporal, Inngest, Postgres queue | Fastest to build; controllable at prototype scale | Not durable; must replace in Phase 2 |
| 2026-03-02 | AI confidence threshold = 1.0 | 0.7, 0.9, 1.0 | Cannot calibrate in regulated context without real data | No autonomous AI execution in Phase 1 |
| 2026-03-02 | ~~No-code canvas deferred Phase 2+~~ | ~~Phase 1 canvas, Phase 2+ canvas~~ | ~~Canvas is a product in its own right~~ | ~~Design partners must tolerate pre-built templates~~ — **ARCHIVED 2026-03-04**: see below |
| 2026-03-04 | Visual workflow builder (React Flow) in Phase 3 | Phase 2 canvas, Phase 3 canvas, no canvas | Phase 2 delivers composable workflows via API/forms; Phase 3 adds visual canvas when composition patterns are validated | Design partners use form-based workflow creation in Phase 2; canvas in Phase 3 |
| 2026-03-04 | Workflow definitions are Blocks ("workflow-as-block") | Separate workflow_definitions table, Workflow as Block, external workflow service | Workflows in the graph = auditable, graph-traversable, composable, AI-readable. Validated with potential customers. | Increases Block table size; type field becomes more critical to index |
| 2026-03-04 | Custom block types via block_type_definitions table | Hardcoded types only, JSON Schema validation, Zod schemas | JSON Schema draft-07 in DB = org-configurable without code deploys; field_schema validates Block.data | Schema evolution must be managed carefully; need versioning strategy |
| 2026-03-04 | Task routing as workflow step types (route_human, route_agent) | Separate task management system, embedded in workflow engine, external task queue | Task items are Blocks = appear in graph, have events, searchable. Human and agent routing are symmetric. | task_queue_item Blocks add volume; need efficient queries for "my pending tasks" |
| 2026-03-04 | Integration connectors in DB, credentials in secrets manager | All config in env vars, full config in DB, external integration platform | DB config = per-org, self-service; secrets manager = secure. Never store credentials in JSONB. | Adds complexity; need robust error handling for failed external calls |
| 2026-03-04 | Temporal deferred to Phase 4 (was Phase 2) | Phase 2 Temporal, Phase 3 Temporal, Phase 4 Temporal | Workflow-as-block pattern handles Phase 2-3 scale; Temporal needed only for exactly-once semantics at enterprise scale | Workflow-as-block execution is not as durable as Temporal; acceptable for <1000 concurrent instances |

---

## Scalability Approach

| Scale Point | Current Approach | Upgrade Path |
|-------------|-----------------|-------------|
| <1,000 users / 3–5 orgs | Single Vercel deployment + Supabase free tier | No action needed |
| 1,000–10,000 users | Vercel Pro + Supabase Pro ($25/month) | Upgrade plans; no architecture change |
| >10,000 users or >1M events | Separate API service (Railway/AWS) | Migrate API routes to dedicated service |
| Workflow engine >100 concurrent | Postgres queue shows failures | Migrate to Temporal (Phase 2 hard requirement) |
| Graph queries >200ms | Postgres adjacency list degrades | Evaluate Apache AGE or Neo4j |

---

## Known Architectural Risks

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|-----------|-------|
| Postgres queue fails silently at scale | HIGH | HIGH | Hard constraint: prototype-only; Temporal in Phase 2 | Backend Engineer |
| AI confidence routing miscalibrated | MEDIUM | HIGH | Start at threshold = 1.0; tune with data after 30 days | AI/ML Engineer |
| Graph queries degrade at 10k+ blocks | MEDIUM | HIGH | Performance spike in Sprint 2 before Phase 2 commit | Backend Engineer |
| Vercel function timeout on streaming chat | MEDIUM | MEDIUM | Use Edge Runtime or upgrade to Vercel Pro | DevOps Engineer |

---

## Archived

> Superseded content moved here. Never deleted.

### [2026-03-04] Canvas deferred to Phase 2+ decision — superseded

Original decision (2026-03-02): "No-code canvas deferred Phase 2+". Canvas was described as "a product in its own right" requiring 6+ months.

**Superseded by:** Visual workflow builder (React Flow) now planned for Phase 3. Phase 2 delivers composable workflows via API and form-based UI. The canvas is no longer deferred indefinitely — it has a specific phase and purpose (visual composition of workflow templates that already work via the API).
