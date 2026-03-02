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
| 1 | Foundation & Primitive Validation | If we build Blocks + Events + Actions + basic workflow + AI chat, 2+ design partners will run live workflows through it | ≥2 orgs each run ≥10 active workflows/week for 2 consecutive weeks | PLANNING | Q2 2026 |
| 2 | AI Layer & Workflow Configurability | If we add AI routing + jurisdiction-aware workflow config, ≥30% of workflow actions will route through AI | ≥30% AI-routed actions, ≥1 design partner reports measurable coordination reduction | FUTURE | Q3 2026 |
| 3 | Integration Layer & Revenue | If we connect to existing tools + deliver audit export, ≥1 design partner converts to paying customer | ≥1 paying customer at ≥£2k/month | FUTURE | Q4 2026 |
| 4 | Scale & Production Hardening | If we migrate to production infrastructure + begin SOC 2, enterprise design partners can use production data | Temporal deployed, SOC 2 audit started, ≥5 paying customers | FUTURE | Q1–Q2 2027 |

> Status values: PLANNING / ACTIVE / COMPLETE / ON HOLD

---

## Roadmap Areas

| Area | Owner Role | PRD Doc | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|------|-----------|---------|---------|---------|---------|---------|
| Core data model (Blocks, Events, Actions) | Backend Engineer | prd/04-data-models.md | Heavy | Light | Light | Light |
| API and services | Backend Engineer | prd/05-api-contracts.md | Heavy | Medium | Medium | Medium |
| Workflow engine | Backend Engineer | prd/05-api-contracts.md | Medium | Heavy | Light | Light |
| AI routing layer | AI/ML Engineer | prd/07-ai-ml-spec.md | Light | Heavy | Medium | Light |
| Frontend (dashboard + block views) | Frontend Engineer | prd/06-frontend-spec.md | Heavy | Medium | Medium | Light |
| Auth + multi-tenancy | Backend Engineer | prd/10-security-compliance.md | Heavy | Light | Light | Light |
| Infrastructure + CI/CD | DevOps Engineer | prd/08-infra-devops.md | Medium | Light | Medium | Heavy |
| Data pipeline + analytics | Data Engineer | prd/09-data-pipeline.md | Light | Medium | Heavy | Medium |
| Security + compliance | All roles | prd/10-security-compliance.md | Medium | Medium | Heavy | Heavy |
| Integration layer | Backend Engineer | prd/05-api-contracts.md | — | Light | Heavy | Medium |
| No-code canvas | Frontend Engineer | prd/06-frontend-spec.md | — | — | Medium | Heavy |
| User research + design partners | Researcher + PM | prd/02-user-research.md | Heavy | Medium | Light | Light |

> Intensity: Heavy / Medium / Light / —

---

## Current Focus

| Role | Current Task | Status |
|------|-------------|--------|
| Orchestrator | /plan-prd complete — sprint tasks generated | DONE |
| Researcher | Research phase complete — all 6 findings files populated | DONE |
| Product Manager | Tech stack approval pending; review research/findings/tech-stack-recommendation.md | ACTION REQUIRED |
| Frontend Engineer | Awaiting Sprint 1 kick-off — run /load-agent frontend then /next-task | READY |
| Backend Engineer | Awaiting Sprint 1 kick-off — run /load-agent backend then /next-task | READY |
| AI/ML Engineer | Awaiting Sprint 1 kick-off — run /load-agent ai-ml then /next-task | READY |
| DevOps Engineer | Awaiting Sprint 1 kick-off — run /load-agent devops then /next-task | READY |
| Data Engineer | Awaiting Sprint 1 kick-off — run /load-agent data then /next-task | READY |
| QA Engineer | Awaiting Sprint 1 kick-off — run /load-agent qa then /next-task | READY |

> This section is updated by orchestrator at each sprint start and /status-report

---

## Changelog

> Append-only. See `roadmap/changelog.md` for full log.

| Date | Change | Trigger | Approved By |
|------|--------|---------|-------------|
| 2026-03-02 | Initial roadmap created — 4 phases with hypotheses and exit conditions | /plan-prd | ORCHESTRATOR |
