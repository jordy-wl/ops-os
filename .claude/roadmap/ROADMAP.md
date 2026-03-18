# Product Roadmap — Ops OS

> Phases are hypotheses, not commitments. Exit conditions must be explicitly evaluated before a phase closes.
> Changes to this document are logged in `roadmap/changelog.md` BEFORE they take effect.

---

## Product
**Name:** Ops OS
**One-line description:** A Business Operating System for capital markets and operations-heavy firms — stateful entities, immutable audit trail, AI-routed workflows.
**North Star Metric:** Weekly Active Workflows (unique workflow instances processed per week across all orgs) — see `roadmap/north-star.md`

---

## Phase Structure

| # | Phase Name | Hypothesis | Exit Condition | Status | Target |
|---|-----------|-----------|----------------|--------|--------|
| 1 | Foundation & Primitive Validation | Blocks + Events + Actions + workflow + AI chat → 2+ design partners run live workflows | ≥2 orgs with ≥10 workflows/week | COMPLETE | Q1 2026 |
| 2 | Composable Blocks, Visual Builder & Integrations | Canvas + Google + documents + action menu + polish → user runs ≥5 E2E workflows | User runs ≥5 complete workflows with email + docs | COMPLETE | Q1 2026 |
| 3 | Platform Evolution: RBAC, Routing, Delta AI, Doc Gen V2 | Custom RBAC, routing engine, AI delta engine, doc gen V2, 5 new block types, admin settings | RBAC + routing + delta AI + doc gen deployed | COMPLETE | Q1 2026 |
| 4 | Workflow Engine V2, Client Portal, Chat V2, Analytics | Task nodes, client portal, forms, e-sig, chat history, workflow analytics | Full E2E onboarding → form → doc → sig → audit trail | COMPLETE | Q1 2026 |
| 5 | Org Intelligence + Workflow Power-Up | Org dashboard, revenue forecasting, 9 new step handlers, strategy blocks, My Work V2 | 6+ node categories, 25+ nodes, delta-chat wired, all block types visible | COMPLETE | Q1 2026 |
| 6 | Productivity Suite + Infrastructure Planning | Time tracking, calendar, performance metrics, infra research, workflow builder UX redesign | Timer, calendar sync, performance trends, infra report, node config decomposition | ACTIVE | Q1–Q2 2026 |
| 7 | Enterprise, Scale & Compliance | Temporal, SOC 2, multi-region, marketplace | ≥5 paying, SOC 2 in progress | FUTURE | Q3–Q4 2026 |

> Status values: PLANNING / ACTIVE / COMPLETE / ON HOLD

---

## Roadmap Areas

| Area | Owner Role | PRD Doc | P1 | P2 | P3 | P4 | P5 | P6 | P7 |
|------|-----------|---------|----|----|----|----|----|----|-----|
| Core data model (Blocks, Events, Actions) | Backend Engineer | prd/04-data-models.md | Heavy | Medium | Light | Light | Light | — | Light |
| Custom block types | Backend Engineer | prd/04-data-models.md | — | Heavy | Light | — | Medium | — | — |
| API and services | Backend Engineer | prd/05-api-contracts.md | Heavy | Heavy | Medium | Medium | Medium | Light | Medium |
| Workflow engine (workflow-as-block) | Backend Engineer | prd/04-data-models.md, prd/05-api-contracts.md | Medium | Heavy | Medium | Heavy | Heavy | — | Heavy |
| Workflow builder UX | Frontend Engineer | prd/06-frontend-spec.md | — | — | Medium | Medium | Heavy | **Heavy** | — |
| Task routing (human + agent) | Backend + AI/ML | prd/05-api-contracts.md, prd/07-ai-ml-spec.md | — | Heavy | Medium | Light | Medium | — | Light |
| AI routing layer | AI/ML Engineer | prd/07-ai-ml-spec.md | Light | Medium | Heavy | Light | Medium | Light | Light |
| Operational intelligence | AI/ML Engineer | prd/07-ai-ml-spec.md | — | — | Heavy | Medium | Heavy | Light | Medium |
| Frontend (dashboard + block views) | Frontend Engineer | prd/06-frontend-spec.md | Heavy | Medium | Medium | Light | Medium | Medium | Light |
| Auth + multi-tenancy | Backend Engineer | prd/10-security-compliance.md | Heavy | Light | Light | — | Light | — | Medium |
| Infrastructure + CI/CD | DevOps Engineer | prd/08-infra-devops.md | Medium | Light | Medium | — | — | Medium | Heavy |
| Data pipeline + analytics | Data Engineer | prd/09-data-pipeline.md | Light | Medium | Medium | Medium | Medium | Medium | Heavy |
| Integration layer (webhooks + connectors) | Backend Engineer | prd/05-api-contracts.md, prd/09-data-pipeline.md | — | Medium | Heavy | Medium | Light | — | Medium |
| Document generation | Backend + Frontend | prd/06-frontend-spec.md | — | — | Medium | Medium | — | — | — |
| Security + compliance | All roles | prd/10-security-compliance.md | Medium | Medium | Medium | — | — | — | Heavy |
| User research + design partners | Researcher + PM | prd/02-user-research.md | Heavy | Medium | Light | Light | — | — | Light |
| Client portal + forms | Frontend + Backend | prd/06-frontend-spec.md | — | — | — | Heavy | — | — | Light |
| Productivity (time, calendar, perf) | Frontend + Backend | prd/06-frontend-spec.md | — | — | — | — | — | Heavy | — |

> Intensity: Heavy / Medium / Light / —

---

## Current Focus

**Phase 6 — Productivity Suite + Infrastructure Planning** (Sprints 18–23)

Phases 1–5 code-complete. Phase 6 core sprints complete (S18–S21, 37/37 tasks, 1689 tests). Workflow Builder UX Redesign in progress (S22–S23).

| Milestone | Status |
|-----------|--------|
| Sprint 18: Time Tracking + Timebox (9 tasks) | COMPLETE |
| Sprint 19: Calendar Integration (9 tasks) | COMPLETE |
| Sprint 20: Performance Metrics (10 tasks) | COMPLETE |
| Sprint 21: Infrastructure Research + Final Polish (9 tasks) | COMPLETE |
| Sprint 22: Workflow Builder UX — Foundation (8 tasks) | **COMPLETE** |
| Sprint 23: Workflow Builder UX — Per-Node Improvements (15 tasks) | PLANNED |

**Sprint 22 delivered:** Decomposed 1,697-line node-config-panel.tsx monolith into 8 per-node config components + 7 shared components (form primitives, routing section, duration picker, condition builder, variable picker, schedule config, AI template picker) + 14 built-in AI prompt templates. Zero new TypeScript errors.

**Sprint 23 scope:** Trigger configs (event/schedule/webhook), Route node (new), AI template integration, external action consolidation, variable picker wiring, context-aware auto-fill, condition handler implementation, For Each node (new), workflow completion config.

> This section is updated by orchestrator at each sprint start and /status-report

---

## Changelog

> Append-only. See `roadmap/changelog.md` for full log.

| Date | Change | Trigger | Approved By |
|------|--------|---------|-------------|
| 2026-03-02 | Initial roadmap created — 4 phases with hypotheses and exit conditions | /plan-prd | ORCHESTRATOR |
| 2026-03-04 | Major restructuring: Phase 2 → "Composable Blocks & Workflow Engine", Phase 3 → "Visual Builder & Integrations", Phase 4 → "Scale, Revenue & Compliance". 8 PRDs updated. | Whiteboard session — product owner validated composable workflow vision | PM + ORCHESTRATOR |
| 2026-03-10 | Phase 1 marked COMPLETE. Phase 2 scope expanded (Sprints 5–10): canvas, Google, docs, polish. Phase 2 marked CODE COMPLETE. Phase table updated with actual deliverables. | Sprint 10 retro — all 52/54 tasks done (96%) | ORCHESTRATOR |
| 2026-03-12 | Phase 2 closed as code-complete. Usage exit conditions re-scoped as Phase 3 milestones. Phase 3 activated: "Platform Evolution" — RBAC, routing engine, delta AI, doc gen V2, 5 new block types, admin settings. 8 sprints, 53 tasks. Block-specific layouts deferred to Phase 4. | User manual testing + feature gap analysis | PM + ORCHESTRATOR |
| 2026-03-13 | Phase 3 closed as code-complete (70/70 tasks). Phase 4 activated and completed (42/42 tasks). | Sprint 12 retro | ORCHESTRATOR |
| 2026-03-15 | Phase 5 closed as code-complete (48/48 tasks, 1414 tests). | Sprint 17 retro | ORCHESTRATOR |
| 2026-03-17 | Phase 6 core sprints (S18-S21) code-complete (37/37 tasks, 1689 tests). AI layer deep-dive shipped post-sprint (6 improvements). | Sprint 21 retro | ORCHESTRATOR |
| 2026-03-18 | Phase 6 extended: Sprint 22 (Workflow Builder UX Foundation, 8 tasks, COMPLETE) + Sprint 23 (Per-Node Improvements, 15 tasks, PLANNED). Monolith decomposition + shared components. Phase table expanded to 7 phases. Roadmap areas expanded to P1–P7. | User-driven UX redesign — streamline workflow builder config for non-technical users | PM + ORCHESTRATOR |
