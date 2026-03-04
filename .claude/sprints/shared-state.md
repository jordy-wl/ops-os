# Shared State — Ops OS

> READ THIS FIRST at every session start.
> Single source of truth for all active work coordination.
> Every agent updates this file before starting and after finishing a task.

---

## Current Phase and Sprint

**Phase:** 1 — Foundation & Primitive Validation
**Sprint:** 3
**Sprint Goal:** Make workflows triggerable from the UI, harden production cron, enrich AI context for demo quality, and onboard ≥1 real external capital markets design partner to a live workflow session.
**Sprint Started:** 2026-03-03
**Sprint Target End:** [SET AT KICK-OFF — 2 weeks]

---

## Active Work

| Task ID | Title | Role | Status | Last Updated |
|---------|-------|------|--------|-------------|
| P1-S3-FE-01 | Workflow Trigger — Block Detail Button | Frontend | IN_PROGRESS | 2026-03-03 |
| P1-S3-FE-02 | Block Detail — Events Timeline Polish | Frontend | OPEN | 2026-03-03 |
| P1-S3-BE-01 | Cron Config + Engine Hardening | Backend | IN_PROGRESS | 2026-03-03 |
| P1-S3-AI-01 | Context Assembly — Org Summary + Graph | AI/ML | IN_PROGRESS | 2026-03-04 |
| P1-S3-QA-01 | E2E Test — Workflow Trigger to Completion | QA | OPEN | 2026-03-03 |
| P1-S3-DE-01 | Real Design Partner Onboarding | ORC/Data | IN_PROGRESS | 2026-03-03 |
| P1-S3-RES-01 | Process Sprint 2 Signals — PRD Updates | Research | OPEN | 2026-03-03 |

**How to update:** Status → IN_PROGRESS when claiming, DONE when finished, BLOCKED when stuck.
**Sprint metrics:** run `/sync-sprint-metrics` to recalculate. Full history: `shared-state-history.md`.

---

## Blockers

| Task ID | Task Title | Blocked By | Age (days) | Escalated? |
|---------|-----------|-----------|-----------|-----------|

**Blocker rules:** Log immediately when blocked. Blockers over 48 hours: orchestrator must resolve.
When unblocked: update status back to OPEN and add a handoff note below.

---

## Signals Queue

PENDING signals that researcher needs to process (P1-S3-RES-01):

| Date | Source | Summary | Signal Strength | Logged By |
|------|--------|---------|----------------|-----------|
| 2026-03-02 | BE-01 | workflow_jobs.started_at exposed as claimed_at in API. Mapped at API layer; DB column unchanged. PRD-04 schema needs both names documented. | LOW | BACKEND-ENGINEER |
| 2026-03-02 | BE-01 | Sprint 1 migration comment says status='completed'; Sprint 2 spec/contract says 'done'. PRD-04 status enum must be corrected. **STRONG (with above — same PRD section).** | LOW | BACKEND-ENGINEER |
| 2026-03-02 | BE-01 | vercel.json cron config and WORKFLOW_ENGINE_SECRET not in any task scope. Required for production workflow engine. PRD-03 and PRD-08 missing these deploy artifacts. | MODERATE | BACKEND-ENGINEER |
| 2026-03-03 | DE-01 | Australia/ASIC confirmed as primary market. PRD-08 specifies eu-west-1 (FCA) as default region — incorrect. Must update to ap-southeast-2 (Sydney). | MODERATE | ORCHESTRATOR |
| 2026-03-03 | DE-01 | Design partner walkthrough assumed workflow trigger UI. No trigger in Sprint 2. PRD-06 must add trigger UI as pre-condition for partner sessions. | MODERATE | DATA-ENGINEER |

**How to add a signal:** Run `/log-signal [task-id] [strength]` — writes to `build-learnings.md` and here atomically.

---

## Notes (cross-role communications)

| Date | Author | Note |
|------|--------|------|
| 2026-03-03 | ORCHESTRATOR | **SPRINT 2 RETRO COMPLETE** — 9/9 DONE (100%). DE-01 status corrected to DONE (gate evidence was filed; shared-state had it as IN_PROGRESS). Phase 1 exit: NOT MET (0/4 conditions). Sprint 3 initiated. Full retro in `sprint-2/retro-notes.md`. |
| 2026-03-03 | ORCHESTRATOR | **SPRINT 3 CRITICAL PATH**: FE-01 (trigger UI) + BE-01 (cron) are Day-1 unblocked and MUST be deployed to production before DE-01 (partner onboarding) starts. Orchestrator confirms production readiness before scheduling any partner session. |
| 2026-03-03 | ORCHESTRATOR | **STRONG SIGNAL — PRD-04**: Two Sprint 2 signals both challenge prd/04-data-models.md (schema naming). This meets the two-signal strong threshold. RES-01 must process this section first. |
| 2026-03-03 | ORCHESTRATOR | **GATE 6 — DE-01**: Partner onboarding is HIGH complexity. QA-ENGINEER reviews design-partner-notes.md for completeness before DE-01 can be marked DONE. Gate 6 template in sprint-3/gate-results.md. |
| 2026-03-03 | ORCHESTRATOR | **PARTNER BLOCKER PROTOCOL**: If no real external partner confirmed by Day 8, log a blocker immediately. Do NOT run another proxy session without PM approval. |
| 2026-03-03 | ORCHESTRATOR | **ENGINE HARDENING**: BE-01 Gate 6 found fail-open cron secret (route.ts:20) and unhandled markDone/markFailed DB errors. Both in P1-S3-BE-01 scope. Must land before external partner traffic. |
| 2026-03-03 | DATA-ENGINEER | Sprint 2 DE-01 DONE. Proxy partner session ran successfully. 1 real event (block.created) in production org_3AQGS4rMy4Zc4YQyTstKUrJECjN. Trigger UI gap logged as signal. Sprint 3 must get a real external partner with revised walkthrough. |
| 2026-03-04 | QA-ENGINEER | **P1-S3-QA-01 SCAFFOLD READY** — tests/e2e/workflow-trigger.spec.ts written. 10-step flow: sign-in → create block via API → click trigger button → assert toast → poll /workflows 30s for 'done' → assert 3 events on block detail. Lint zero errors, TypeScript zero errors, Vitest suite unaffected (115 pass). Waiting on FE-01 (OPEN) + BE-01 (IN_PROGRESS) before claiming task DONE. |
| 2026-03-04 | ORCHESTRATOR | **ROADMAP RESTRUCTURING COMPLETE** — Whiteboard session with product owner validated composable workflow vision. 15 files updated across PRDs, roadmap, and sprint planning. Key changes: Phase 2 → "Composable Blocks & Workflow Engine" (custom block types, workflow-as-block, task routing, integration connectors); Phase 3 → "Visual Builder & Integrations" (React Flow canvas, Salesforce/Xero, document generation, operational intelligence); Phase 4 → "Scale, Revenue & Compliance" (Temporal, SOC 2, marketplace). Core new concept: workflow definitions are Blocks in the business graph. **Sprint 3 tasks UNAFFECTED — continue as planned.** Phase 1 scope unchanged. All changes logged in prd/CHANGELOG.md and roadmap/changelog.md. |

---

## MCP Actions This Sprint

| Date | Server | Action | Outcome | Task ID | Agent |
|------|--------|--------|---------|---------|-------|

---

## Recently Completed — Sprint 2 Archive

Sprint 2 (2026-03-03): 9/9 tasks DONE. Retro in `sprint-2/retro-notes.md`.
Production: https://ops-os-gamma.vercel.app live. 115 unit + 29 contract/E2E tests. 1 proxy partner session.

| Task ID | Title | Role | Status |
|---------|-------|------|--------|
| P1-S2-OPS-01 | Git Init + GitHub Actions CI Pipeline | DevOps | DONE |
| P1-S2-BE-01 | Workflow Engine — Job Processor | Backend | DONE |
| P1-S2-BE-02 | RBAC Roles | Backend | DONE |
| P1-S2-FE-01 | Dashboard — Metrics + Events Feed | Frontend | DONE |
| P1-S2-FE-02 | Chat UI — Streaming Component | Frontend | DONE |
| P1-S2-FE-03 | Workflow Status View | Frontend | DONE |
| P1-S2-AI-01 | Semantic Search in Context Assembly | AI/ML | DONE |
| P1-S2-QA-01 | Workflow Engine Contract Tests | QA | DONE |
| P1-S2-DE-01 | Production Deploy + Design Partner Onboarding | Data/ORC | DONE |

Sprint 1 (2026-03-02): 16/16 tasks DONE in 1 session. Full details in `shared-state-history.md`.

| Task ID | Title | Role | Status |
|---------|-------|------|--------|
| P1-S1-OPS-01 | Scaffold Project — Next.js + Supabase + Vercel | DevOps | DONE |
| P1-S1-OPS-02 | Local Development Environment | DevOps | DONE |
| P1-S1-BE-01 | Core Database Schema | Backend | DONE |
| P1-S1-BE-02 | Blocks API | Backend | DONE |
| P1-S1-BE-03 | Events API | Backend | DONE |
| P1-S1-BE-04 | Actions API Skeleton | Backend | DONE |
| P1-S1-BE-05 | Auth Middleware — Clerk JWT + Org Scoping | Backend | DONE |
| P1-S1-FE-01 | App Shell + Clerk Auth Flow | Frontend | DONE |
| P1-S1-FE-02 | Block Detail View | Frontend | DONE |
| P1-S1-FE-03 | Block List View | Frontend | DONE |
| P1-S1-AI-01 | Basic Chat Endpoint | AI/ML | DONE |
| P1-S1-AI-02 | Context Assembly Service | AI/ML | DONE |
| P1-S1-DE-01 | Seed Data + Demo Scenario | Data | DONE |
| P1-S1-DE-02 | pgvector Embedding Pipeline | Data | DONE |
| P1-S1-QA-01 | API Contract Tests — Blocks + Events | QA | DONE |
| P1-S1-QA-02 | E2E Smoke Test | QA | DONE |
