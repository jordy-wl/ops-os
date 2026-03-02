# Shared State — Ops OS

> READ THIS FIRST at every session start.
> Single source of truth for all active work coordination.
> Every agent updates this file before starting and after finishing a task.

---

## Current Phase and Sprint

**Phase:** 1 — Foundation & Primitive Validation
**Sprint:** 2
**Sprint Goal:** Make Ops OS demo-ready and operationally viable — working workflow engine, production deploy, chat UI, and at least 1 capital markets design partner onboarded to a real (not local) environment.
**Sprint Started:** [SET AT KICK-OFF]
**Sprint Target End:** [SET AT KICK-OFF — 2 weeks]

---

## Active Work

| Task ID | Title | Role | Status | Last Updated |
|---------|-------|------|--------|-------------|
| P1-S2-OPS-01 | Git Init + GitHub Actions CI Pipeline | DevOps | IN_PROGRESS | 2026-03-02 |
| P1-S2-BE-01 | Workflow Engine — Job Processor | Backend | REVIEW | 2026-03-02 |
| P1-S2-BE-02 | RBAC Roles | Backend | OPEN | 2026-03-02 |
| P1-S2-FE-01 | Dashboard — Metrics + Events Feed | Frontend | DONE | 2026-03-02 |
| P1-S2-FE-02 | Chat UI — Streaming Component | Frontend | OPEN | 2026-03-02 |
| P1-S2-FE-03 | Workflow Status View | Frontend | OPEN | 2026-03-02 |
| P1-S2-AI-01 | Semantic Search in Context Assembly | AI/ML | IN_PROGRESS | 2026-03-02 |
| P1-S2-QA-01 | Workflow Engine Contract Tests | QA | OPEN | 2026-03-02 |
| P1-S2-DE-01 | Production Deploy + Design Partner Onboarding | Data/ORC | OPEN | 2026-03-02 |

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

PENDING signals that researcher needs to process:

| Date | Source | Summary | Signal Strength | Logged By |
|------|--------|---------|----------------|-----------|
| 2026-03-02 | BE-01 | AI-01 in-progress changes (semantic search) broke 7 unit tests in context-assembly.test.ts and chat.test.ts. Implementation/test mismatch. AI-01 must fix before DONE. | MEDIUM | BACKEND-ENGINEER |
| 2026-03-02 | BE-01 | workflow_jobs.started_at exposed as claimed_at in API response (no schema change needed). API contract in dependencies.md says claimed_at; DB has started_at. Mapped at API layer. | LOW | BACKEND-ENGINEER |

**How to add a signal:** Run `/log-signal [task-id] [strength]` — writes to `build-learnings.md` and here atomically.

---

## Notes (cross-role communications)

| Date | Author | Note |
|------|--------|------|
| 2026-03-02 | FRONTEND-ENGINEER | FE-01 DONE. Dashboard: 4 metric cards (block counts by type, active workflows, events 24h), recent events feed (20 events, clickable to /blocks/:id), Create Block modal (POST /api/blocks). GET /api/dashboard/summary built. SSR initial data + 30s polling. Gates 1/4/5 passed. Fixed pre-existing S1 lint issue in embeddings.test.ts. AI-01 test failures (7 tests) flagged to AI-ML engineer — pre-existing. FE-02 unblocked. |
| 2026-03-02 | BACKEND-ENGINEER | BE-01 IN PROGRESS. Migration + engine + onboarding handler + workflow-jobs API + cron endpoint + instrumentation.ts written. 17/17 unit tests pass. 5 contract tests skip (await Supabase). SIGNAL: AI-01 changes broke 7 tests in tests/unit/context-assembly.test.ts + chat.test.ts — AI-01 needs to fix. Contract deviation logged: DB column started_at exposed as claimed_at in GET /api/workflow-jobs (no new column needed). Status values use 'done' per API contract (migration comment erroneously said 'completed'). |
| 2026-03-02 | ORCHESTRATOR | SPRINT 1 RETRO COMPLETE — 16/16 tasks DONE. 100% completion rate. Gate evidence filed for all tasks. Phase 1 exit conditions: NOT MET (no workflow engine, no production deploy, no design partners). Sprint 2 initiated. |
| 2026-03-02 | ORCHESTRATOR | **SPRINT 2 KICKOFF**: OPS-01 is FIRST PRIORITY — no git repo means no parallel dev safety. Every other role can start their day-1 tasks but OPS-01 must complete before any code is pushed to GitHub. |
| 2026-03-02 | ORCHESTRATOR | **CRITICAL PATH**: BE-01 (workflow engine) is HIGH complexity (4 days). FE-03 and QA-01 are blocked on it. Backend: prioritise BE-01 above BE-02. If 2 backend agents running: one on BE-01, one on BE-02. |
| 2026-03-02 | ORCHESTRATOR | **GATE EVIDENCE DISCIPLINE**: Sprint 1 had 10 tasks with informal evidence (shared-state notes, not gate-results.md). Sprint 2: engineers MUST write gate evidence to gate-results.md DURING the task. QA Engineer: enforce this at peer reviews. |
| 2026-03-02 | ORCHESTRATOR | **DESIGN PARTNER**: DE-01 requires a real design partner. If no partner available by day 5 of sprint, run a "design partner simulation" — team member walks through the system as a proxy user. Do not let phase exit condition remain blocked on external scheduling. |
| 2026-03-02 | ORCHESTRATOR | Day-1 parallel tracks (all unblocked): OPS-01, BE-01, BE-02, FE-01, FE-02, AI-01. Blocked until BE-01 DONE: FE-03, QA-01. Blocked until OPS-01+FE-01+FE-02 DONE: DE-01. |

---

## MCP Actions This Sprint

| Date | Server | Action | Outcome | Task ID | Agent |
|------|--------|--------|---------|---------|-------|

---

## Recently Completed — Sprint 1 Archive

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
