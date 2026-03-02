# Tech Stack Recommendation — Ops OS

> Populated by researcher: 2026-03-02.
> **PM approval required** before orchestrator uses these choices in sprint task generation.
> Context: Bootstrap / pre-revenue. Prototype tier first; production tier when concept is validated.

---

## Recommendation Summary

| Layer | Prototype Tier | Production Tier |
|-------|---------------|----------------|
| Frontend | Next.js 15 (App Router) + Tailwind + shadcn/ui | Same — proven and sufficient |
| Backend | Next.js API routes | Separate Bun/Node.js services (API, workflow, AI) |
| Database | Supabase (Postgres) + pgvector | Neon or RDS Postgres + Redis + pgvector |
| Auth | Clerk | Clerk → WorkOS if enterprise SSO required |
| Workflow Engine | Postgres job queue (custom, minimal) | Temporal (self-hosted or Temporal Cloud) |
| AI — Reasoning | Claude claude-sonnet-4-6 | Claude claude-opus-4-6 for highest-stakes routing |
| AI — Extraction | claude-haiku-4-5 | claude-haiku-4-5 |
| Real-time | Supabase Realtime | Supabase Realtime → custom WebSocket if needed |
| Infrastructure | Vercel + Supabase free/hobby | AWS (ECS/Fargate) or Railway + Terraform IaC |
| Document generation | Anvil or Docusign API | Same |
| Email/notifications | Resend | Resend → Sendgrid Enterprise |
| Monitoring | Vercel Analytics + Supabase Dashboard | OpenTelemetry + Datadog or Axiom |
| CI/CD | GitHub Actions (auto via Vercel) | GitHub Actions + full pipeline |

---

## Prototype Tier Philosophy

**Goal: validate the concept with real users. Build as little infrastructure as possible.**

Principles:
- Zero infrastructure to manage: Supabase + Vercel handle everything
- No DevOps overhead: no Kubernetes, no Terraform, no self-hosted services
- Free or near-free until first paying customer: all tiers below have generous free plans
- Replace early decisions when they break, not before

Acceptable prototype tradeoffs:
- Workflow engine is not durable (Postgres queue — may fail silently at scale)
- No horizontal scaling (single Vercel deployment is fine for <1000 users)
- No Redis cache (Postgres query performance acceptable for prototype data volumes)
- No dedicated AI service (Claude API calls from Next.js API routes)

---

## Prototype Stack — Detailed

### Frontend: Next.js 15 + Tailwind + shadcn/ui

**Why:** Next.js App Router is the standard for full-stack React. shadcn/ui gives production-quality components with zero design cost. Tailwind keeps CSS manageable.

**Key packages:**
- `next` v15 (App Router, Server Components, Server Actions)
- `tailwindcss` v4
- `shadcn/ui` — component library (Dialog, Table, Form, etc.)
- `react-hook-form` + `zod` — form validation
- `@tanstack/react-query` — data fetching and cache
- `recharts` or `tremor` — dashboard charts and metrics

**Canvas (no-code workflow builder):** `react-flow` — deferred to Phase 2+. Do NOT install or build in Phase 1.

**When to stop:** When the Next.js frontend becomes slow for users with large datasets, or when complex animations/interactions need a dedicated frontend team.

---

### Backend: Next.js API Routes → Bun/Node.js

**Prototype:** Next.js API routes in `/app/api/` serve all backend logic. Simple, co-located, zero setup.

**Structure:**
```
app/api/
├── blocks/          ← CRUD for business entities
├── events/          ← append-only event log (write only; no updates/deletes)
├── actions/         ← controlled mutation endpoints
├── workflows/       ← workflow trigger and status
├── ai/              ← AI routing + chat endpoint
└── webhooks/        ← inbound from integrations
```

**When to migrate to separate service:** When Next.js API routes become bottlenecked (>500ms response times under load), or when the workflow engine needs to run as a long-running process.

---

### Database: Supabase (Postgres + pgvector + Realtime)

**Why Supabase:** Managed Postgres with built-in auth (not used — using Clerk), real-time subscriptions, pgvector for semantic search, and a generous free tier. Zero ops overhead.

**Core schema design:**

```sql
-- Blocks: business entities
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,                    -- "client", "deal", "project", etc.
  data JSONB NOT NULL,                   -- flexible entity data
  jurisdiction TEXT,                     -- ISO jurisdiction code
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id UUID NOT NULL REFERENCES orgs(id)
);

-- Block graph edges
CREATE TABLE block_edges (
  from_block_id UUID NOT NULL REFERENCES blocks(id),
  to_block_id UUID NOT NULL REFERENCES blocks(id),
  relationship TEXT NOT NULL,            -- "client_of", "related_to", etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (from_block_id, to_block_id, relationship)
);

-- Events: immutable audit log (append-only, never UPDATE or DELETE)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID REFERENCES blocks(id),
  event_type TEXT NOT NULL,
  actor_id UUID,                         -- who triggered it
  actor_type TEXT,                       -- "user", "workflow", "ai"
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  org_id UUID NOT NULL REFERENCES orgs(id)
  -- No updated_at — events are immutable
);

-- Enforce immutability via RLS (no UPDATE/DELETE for service role on events)

-- Workflow jobs (Postgres queue prototype)
CREATE TABLE workflow_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending / running / done / failed
  payload JSONB NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error TEXT,
  org_id UUID NOT NULL
);

-- AI memory: semantic embeddings (pgvector)
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,             -- "event", "block", "document"
  source_id UUID NOT NULL,
  embedding vector(1536),                -- Claude embedding dimensions
  content TEXT NOT NULL,
  org_id UUID NOT NULL REFERENCES orgs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON embeddings USING ivfflat (embedding vector_cosine_ops);
```

**Supabase free tier limits:** 500MB database, 1GB storage, 2GB bandwidth — sufficient for prototype with 3–5 design partners.

---

### Auth: Clerk

**Why:** Multi-tenant out of the box, organisation support (critical for multi-jurisdiction), RBAC, MFA, SSO-ready for future enterprise. Saves 3–6 months of auth engineering.

**Key Clerk features used:**
- Organisations for multi-tenancy (each client firm = one org)
- Custom roles (ops-admin, ops-user, compliance-approver, etc.)
- JWT tokens for API authentication

**Prototype free tier:** 10,000 MAU free. Sufficient for design partners.

**Migration path:** To WorkOS if enterprise SSO (SAML) is required before Clerk's Enterprise plan pricing is viable.

---

### Workflow Engine: Postgres Job Queue (Prototype)

**How it works:**
1. An Action or trigger inserts a row into `workflow_jobs` with status `pending`
2. A background worker (Next.js route or Vercel Cron) polls for `pending` jobs
3. Worker claims a job (UPDATE status to `running`), executes the step, updates to `done` or `failed`
4. For multi-step workflows: each step inserts the next step when it completes

**Limitations:** Not durable (server restart = in-progress job is lost and must be retried manually). Not horizontally scalable. Acceptable for prototype with 3–5 design partners running <100 concurrent workflows.

**Production replacement:** Temporal (open-source, MIT license, battle-tested). Temporal Cloud: $0.05/1000 actions (~$5/day at 100k actions/day). Self-hosted: ~$200–400/month for EC2 + RDS.

---

### AI Layer: Claude API

**Model selection:**
- `claude-sonnet-4-6` — primary reasoning, workflow interpretation, action routing decisions
- `claude-haiku-4-5-20251001` — high-volume extraction tasks (parsing emails, extracting structured data from documents, embedding generation prompts)
- `claude-opus-4-6` — deferred to production tier; use for highest-stakes compliance interpretations only (cost: ~10x Sonnet)

**Cost estimate at prototype:**
- 10 active design-partner users × 20 AI interactions/day = 200 calls/day
- ~500 input tokens + 200 output tokens per call average
- Sonnet at $3/$15 per M tokens: ~$1–3/day at prototype scale
- Haiku at $0.25/$1.25 per M tokens: ~$0.10/day for extraction tasks
- **Total AI cost prototype: $30–90/month** — fully manageable

**Key AI integration points:**
1. **Chat control plane:** User types "onboard XYZ Capital" → Claude interprets intent → routes to action or asks for clarification
2. **Action routing:** For each action, Claude assesses confidence + cites the relevant event history → routes to human if below threshold
3. **Context assembly:** Before any AI response, assemble context from: relevant Blocks (graph), recent Events (timeline), workflow state, user role
4. **Semantic search:** pgvector cosine similarity on embeddings for "find similar clients" and "what happened last time we onboarded a firm like this"

---

### Infrastructure: Vercel + Supabase

**Prototype deployment:**
```
GitHub repo → Vercel auto-deploy on push to main
Vercel: Next.js frontend + API routes
Supabase: Postgres + pgvector + Realtime
```

Zero configuration. Zero DevOps. Zero cost for prototype scale.

**Production upgrade path:**
- Vercel Pro ($20/month) for production limits
- Supabase Pro ($25/month) for 8GB database
- When outgrowing Vercel: migrate API to Railway, Render, or AWS ECS

---

## Production Tier Philosophy

**Build for longevity. Every decision should be defensible in a 2-year retrospective.**

Principles:
- Separate services for separation of concerns and independent scaling
- IaC for all infrastructure (Terraform)
- Observability from day one in production (logs, metrics, traces)
- Data residency: evaluate multi-region Postgres for FCA/MAS/ASIC compliance

---

## Alternatives Considered

| Layer | Alternative | Why Rejected |
|-------|------------|-------------|
| Database | MongoDB | Lack of ACID transactions; Postgres better for financial data |
| Database | PlanetScale | MySQL-based; less suited for complex joins and graph queries |
| Auth | NextAuth / Auth.js | Too much custom code for multi-tenant RBAC; Clerk is better DX |
| Workflow | Inngest | Good alternative to Temporal; evaluate at production tier if Temporal proves too complex |
| Workflow | Prefect | Data pipeline focused; not ideal for business workflows |
| AI | OpenAI GPT-4o | Claude better for long-context, agentic reasoning, tool use; also strategic alignment with Anthropic safety model |
| Frontend | Remix | Next.js has wider ecosystem and better Vercel integration |
| Canvas | Retool | No-code but locked to their platform; not embeddable in our product |

---

## PM Approval

> **PM: review this before orchestrator generates sprint tasks.**
> Confirm or modify each choice. Any change here ripples into all task files.

| Layer | Recommendation | PM Decision | Notes |
|-------|---------------|------------|-------|
| Frontend | Next.js 15 + shadcn/ui | ✅ APPROVED | No concerns. UI polish is a design sprint concern, not a stack concern. |
| Database | Supabase (Postgres) | ✅ APPROVED | Condition: verify Supabase region support for Singapore/APAC (MAS data residency) before signing any APAC design partner. EU region (Ireland) confirmed for FCA. Do not block Sprint 1 on this — block APAC partner agreements on it. |
| Auth | Clerk | ✅ APPROVED | Condition: auth layer must be wrapped behind `withAuth` middleware (per BE-05) to make future migration to WorkOS feasible without touching every route. Already in task spec — confirm at code review. |
| Workflow engine | Postgres queue (prototype) | ✅ APPROVED | Hard constraint: this is prototype-only. Temporal migration is a Phase 2 requirement, not optional. Phase 2 kick-off is blocked until Temporal evaluation is documented. Do not let this queue become load-bearing infrastructure. |
| AI | Claude API (Sonnet + Haiku) | ✅ APPROVED | Note: embeddings use OpenAI text-embedding-3-small (1536 dims) — Claude API does not provide embeddings. This must be clear in .env.example. Haiku deferred to Phase 2 extraction tasks. |
| Infrastructure | Vercel + Supabase | ✅ APPROVED | Note: verify streaming chat endpoint (AI-01) operates within Vercel function timeout limits (300s on Pro, 60s on Hobby). If prototype uses Hobby tier, must either upgrade to Pro or use Vercel Edge Runtime for the streaming endpoint. Confirm before AI-01 is marked DONE. |
| Canvas | Deferred to Phase 2+ | ✅ APPROVED — ENFORCE STRICTLY | Canvas is Phase 2+. Any request to bring canvas into Phase 1 — from design partners or internal — must be escalated to PM. The decision to defer must be explicit, not drift. |

**Approved by:** PM
**Date:** 2026-03-02
**Notes:** All layers approved. Three conditions attached: (1) APAC data residency check before APAC design partner agreements; (2) Vercel function timeout verification for streaming chat; (3) Temporal migration is a hard Phase 2 requirement. These conditions do not block Sprint 1 from starting.
