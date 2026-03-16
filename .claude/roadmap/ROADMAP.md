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
| 2 | Composable Blocks, Visual Builder & Integrations | Canvas + Google + documents + action menu + polish → user runs ≥5 E2E workflows | User runs ≥5 complete workflows with email + docs | CODE COMPLETE | Q1 2026 |
| 3 | Platform Evolution: RBAC, Routing, Delta AI, Doc Gen V2 | Custom RBAC, routing engine, AI delta engine, doc gen V2, 5 new block types, admin settings | RBAC + routing + delta AI + doc gen deployed | ACTIVE | Q2 2026 |
| 4 | Enterprise & Compliance | Temporal, SOC 2, multi-region, marketplace | ≥5 paying, SOC 2 in progress | FUTURE | Q3–Q4 2026 |

> Status values: PLANNING / ACTIVE / COMPLETE / ON HOLD

---

## Roadmap Areas

| Area | Owner Role | PRD Doc | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|-----------|---------|---------|---------|---------|---------|
| Core data model (Blocks, Events, Actions) | Backend Engineer | prd/04-data-models.md | Heavy | Medium | Light | Light |
| Custom block types | Backend Engineer | prd/04-data-models.md | — | Heavy | Light | Light |
| API and services | Backend Engineer | prd/05-api-contracts.md | Heavy | Heavy | Medium | Medium |
| Workflow engine (workflow-as-block) | Backend Engineer | prd/04-data-models.md, prd/05-api-contracts.md | Medium | Heavy | Medium | Light |
| Task routing (human + agent) | Backend + AI/ML | prd/05-api-contracts.md, prd/07-ai-ml-spec.md | — | Heavy | Medium | Light |
| AI routing layer | AI/ML Engineer | prd/07-ai-ml-spec.md | Light | Medium | Heavy | Light |
| Operational intelligence | AI/ML Engineer | prd/07-ai-ml-spec.md | — | — | Heavy | Medium |
| Frontend (dashboard + block views) | Frontend Engineer | prd/06-frontend-spec.md | Heavy | Medium | Medium | Light |
| Visual workflow builder (React Flow) | Frontend Engineer | prd/06-frontend-spec.md | — | — | Heavy | Medium |
| Auth + multi-tenancy | Backend Engineer | prd/10-security-compliance.md | Heavy | Light | Light | Light |
| Infrastructure + CI/CD | DevOps Engineer | prd/08-infra-devops.md | Medium | Light | Medium | Heavy |
| Data pipeline + analytics | Data Engineer | prd/09-data-pipeline.md | Light | Medium | Medium | Heavy |
| Integration layer (webhooks + connectors) | Backend Engineer | prd/05-api-contracts.md, prd/09-data-pipeline.md | — | Medium | Heavy | Medium |
| Document generation | Backend + Frontend | prd/06-frontend-spec.md | — | — | Medium | Light |
| Security + compliance | All roles | prd/10-security-compliance.md | Medium | Medium | Medium | Heavy |
| User research + design partners | Researcher + PM | prd/02-user-research.md | Heavy | Medium | Light | Light |

> Intensity: Heavy / Medium / Light / —

---

## Current Focus

**Phase 3 — ACTIVE** (started 2026-03-12)

Phase 2 code-complete (86/88 tasks, 550 tests, 12 sprints). Phase 3: 8 sprints, 53 tasks.

| Milestone | Status |
|-----------|--------|
| Sprint 0: Scaffold updates (PRDs, rules, standards, agents) | IN PROGRESS |
| Sprint 1: Bug fixes (400 error, chat position, dark toggle, responsiveness) | PENDING |
| Sprint 2: 5 new block types + sub-org hierarchy | PENDING |
| Sprint 3: Custom RBAC engine | PENDING |
| Sprint 4: Routing engine + policy system | PENDING |
| Sprint 5: Workflow canvas enhancements (I/O nodes) | PENDING |
| Sprint 6: Document Generation V2 | PENDING |
| Sprint 7: AI Delta Engine | PENDING |
| Sprint 8: Core admin settings | PENDING |

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
