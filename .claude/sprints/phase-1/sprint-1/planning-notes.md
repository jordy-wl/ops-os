# Planning Notes — Phase 1, Sprint 1

> Written by orchestrator during /plan-prd on 2026-03-02.
> Read by all roles at sprint kick-off.

---

## Product Summary

Ops OS is a Business Operating System that replaces the fragmented stack of SaaS tools operations-heavy businesses use to run themselves. Every business entity exists as a stateful, graph-connected Block with a complete, immutable event history. An ambient AI layer reads this business graph and routes workflow steps — recommending routine actions for human approval, and surfacing the right decisions to the right people at the right time. Primary target: Global Operations Leads at capital markets and financial services firms (50–500 employees, multi-jurisdiction, FCA/MAS/ASIC regulated) who need compliance-grade audit trails, configurable multi-jurisdiction workflows, and a single source of truth across teams.

---

## Top 5 Technical Risks

### Risk 1: Workflow Engine Durability (from R-002, score 16)
**Likelihood:** 4 | **Impact:** 4
The Postgres job queue is not durable. A server restart during a workflow step = silent progress loss. In a compliance context this is dangerous. **Mitigation:** The queue is prototype-only. It is explicitly tracked in the risk register. Gate condition: Postgres queue must not silently fail at demo partner volume (<50 concurrent jobs). Hard constraint: Temporal migration at Phase 2 kick-off — no sign-off without it.

### Risk 2: AI Confidence Miscalibration (from R-004, score 15)
**Likelihood:** 3 | **Impact:** 5
Too conservative = no AI value. Too permissive = AI executes wrong actions in regulated workflows. **Mitigation in Sprint 1:** AI confidence threshold is 1.0 — all actions require human approval. The chat endpoint recommends but never executes. Calibration data collection begins in Phase 1 (log what the AI would have done). Threshold only loosened after 30 days of data with PM + AI/ML Engineer sign-off.

### Risk 3: Graph Query Performance (from R-007, score 12)
**Likelihood:** 3 | **Impact:** 4
Postgres adjacency list traversal may degrade at real data volumes. **Mitigation in Sprint 1:** BE-02 must verify neighbour queries return <200ms on local data. Run the graph performance spike (10k blocks, 100k edges) before Phase 2 commitment to the data model.

### Risk 4: Rip-and-Replace Adoption (from R-001, score 20)
**Likelihood:** 4 | **Impact:** 5
Users want to layer Ops OS on top of existing tools, not replace them. **Mitigation:** Phase 1 asks for one workflow (client onboarding) to run through Ops OS — not CRM replacement. Integration layer (Salesforce, Xero) is Phase 3.

### Risk 5: Design Partner Recruitment (from R-005, score 12)
**Likelihood:** 4 | **Impact:** 3
Capital markets sales cycles are 6–12 months; bootstrap runway is finite. **Mitigation:** Target co-development design partners, not buyers. "Build this with us for 3 months" vs. "buy our product." PM must identify 2–3 capital markets contacts from founder network before Phase 1 Sprint 3.

---

## Tech Stack Confirmed

Tech stack from `research/findings/tech-stack-recommendation.md` — PM approval pending (see action item below).

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | Next.js 15 (App Router) + Tailwind v4 + shadcn/ui | Zero design cost; standard React meta-framework |
| Backend | Next.js API routes | Co-located with frontend; migrate to separate service at scale |
| Database | Supabase (Postgres) + pgvector | Managed, free tier, zero DevOps; pgvector built-in |
| Auth | Clerk | Multi-tenant, RBAC, org support out of box; saves 3–6 months |
| Workflow Engine | Postgres job queue (prototype) | Not durable at scale — explicit Phase 2 replacement with Temporal |
| AI — Reasoning | claude-sonnet-4-6 | Primary model for chat + routing |
| AI — Extraction | claude-haiku-4-5-20251001 | High-volume extraction (Phase 2+) |
| Embeddings | OpenAI text-embedding-3-small (1536 dims) | Claude API does not provide embeddings |
| Infrastructure | Vercel + Supabase | Zero DevOps, free tiers, auto-deploy |
| Canvas | DEFERRED TO PHASE 2+ | Not in Phase 1 scope under any circumstances |

**Estimated AI cost at prototype scale:** ~$30–90/month (10 design-partner users × 20 AI interactions/day)

**⚠️ PM ACTION REQUIRED:** Approve or modify the tech stack in `research/findings/tech-stack-recommendation.md` (PM approval table at bottom of file) before Sprint 1 starts. Any change there ripples into all task files.

---

## Phase Structure Overview

| Phase | Name | Hypothesis | Exit Condition | Status |
|-------|------|-----------|----------------|--------|
| 1 | Foundation & Primitive Validation | Blocks + Events + AI chat = design partners run live workflows | ≥2 orgs, ≥10 workflows/week each | PLANNING |
| 2 | AI Layer & Workflow Configurability | Confidence routing + jurisdiction config = 30% AI-routed actions | ≥30% actor_type='ai' events | FUTURE |
| 3 | Integration Layer & Revenue | Salesforce/Xero + audit export = first paying customer | ≥1 paying customer ≥£2k/month | FUTURE |
| 4 | Scale & Production Hardening | Temporal + SOC 2 = enterprise production use | ≥5 paying customers | FUTURE |

Full phase details: `.claude/sprints/phases.md`

---

## Sprint 1 Scope and Goal

**Sprint goal:** Walking skeleton — infrastructure standing, core data model implemented, auth working, Blocks + Events API functional, Block detail + list UI, and basic AI chat endpoint. By end of Sprint 1, a user can sign in, create a Block, record Events against it, view the event timeline, and ask Claude a question about it.

**What is NOT in Sprint 1:**
- Workflow engine (Sprint 2) — only the schema is created, no runner
- Actions API functional integration (Sprint 2 refinement after BE-04 skeleton)
- Dashboard and reporting (Sprint 2)
- Confidence routing (Phase 2)
- Jurisdiction-aware workflow configuration (Phase 2)
- Canvas of any kind (Phase 2+)
- Integration with Salesforce/Xero/email (Phase 3)

---

## Critical Path

```
OPS-01 (2d) → BE-01 (2d) → BE-02 + BE-03 (2d each, parallel) → FE-02 (3d) → QA-02 (1d)
                          → BE-05 (1d) → FE-01 (2d) ─────────────────────────────────┘
                          → AI-02 (2d) → AI-01 (3d)
                          → DE-01 (1d)
```

**Minimum elapsed time** (all roles in parallel, no slack): ~8-9 calendar days
**Sprint window:** 2 weeks (10 working days) — comfortable fit with buffer

**The single most critical task is P1-S1-OPS-01.** Every other task blocks on it. DevOps Engineer must complete it in the first 1-2 days of the sprint.

---

## Assumptions Made During Planning

1. **Solo / very small team** — tasks are scoped for a 1-person-per-role model; adjust estimates if roles are combined (e.g. BE + DevOps = 1 person)
2. **Clerk free tier** is sufficient for 3–5 design partners (10k MAU limit — confirmed)
3. **Supabase free tier** is sufficient for Sprint 1 (500MB DB, 1GB storage)
4. **No mobile-first requirement** — 375px breakpoint tested but not primary UX target
5. **Design partners will tolerate pre-built workflow templates** — no canvas required in Phase 1 (this must be validated with interviews before Phase 2 planning)
6. **Embedding model** = OpenAI text-embedding-3-small (1536 dims matching schema); if Voyage AI is preferred, update schema vector dimension to 1024 and note in `.env.example`
7. **`claude-sonnet-4-6` for Sprint 1 chat** — Haiku deferred to Phase 2 high-volume extraction
8. **Capital markets design partner recruitment** is in parallel with Sprint 1–3 engineering; not blocked on product being complete

---

## Open Actions After Planning

| Action | Owner | Due |
|--------|-------|-----|
| Approve tech stack in `research/findings/tech-stack-recommendation.md` | PM | Before Sprint 1 kick-off |
| Set sprint start and target end dates in `shared-state.md` | PM / Orchestrator | Sprint kick-off day |
| Identify 2–3 capital markets design partner contacts from founder network | PM + Founder | Before Sprint 3 |
| Decide embedding model (OpenAI vs Voyage AI) and add to .env.example | AI/ML Engineer | Before DE-02 starts |
| Validate "design partners don't need canvas in Phase 1" assumption | Researcher | Sprint 1–2 |
