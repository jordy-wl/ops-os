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
| 1 | Foundation & Primitive Validation | If we build Blocks + Events + Actions + basic workflow + AI chat, 2+ design partners will run live workflows through it | ≥2 orgs each run ≥10 active workflows/week for 2 consecutive weeks | ACTIVE | Q2 2026 |
| 2 | Composable Blocks & Workflow Engine | If we add custom block types, workflow-as-block, task routing, event subscriptions, webhook triggers, and integration connectors, ≥1 design partner creates a custom workflow and ≥1 LOI is signed | ≥1 custom workflow by partner + ≥1 LOI ≥£500/mo | FUTURE | Q3 2026 |
| 3 | Visual Builder & Integrations | If we add a React Flow visual canvas, Salesforce/Xero connectors, document generation, agent AI, and operational intelligence, ≥2 customers convert to paying | ≥2 paying customers ≥£2k/mo | FUTURE | Q4 2026 |
| 4 | Scale, Revenue & Compliance | If we migrate to Temporal, start SOC 2, add multi-region, and build a marketplace, enterprise customers can use production data | ≥5 paying, SOC 2 in progress | FUTURE | Q1–Q2 2027 |

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

**Phase 1 Sprint 3** — Workflow trigger UI, cron hardening, AI context enrichment, design partner onboarding.

| Role | Current Task | Status |
|------|-------------|--------|
| Frontend Engineer | P1-S3-FE-01 Workflow Trigger Button + FE-02 Events Timeline | IN_PROGRESS / OPEN |
| Backend Engineer | P1-S3-BE-01 Cron Config + Engine Hardening | IN_PROGRESS |
| AI/ML Engineer | P1-S3-AI-01 Context Assembly — Org Summary + Graph | IN_PROGRESS |
| QA Engineer | P1-S3-QA-01 E2E Workflow Trigger Test (scaffold ready) | OPEN |
| Data Engineer / ORC | P1-S3-DE-01 Real Design Partner Onboarding | IN_PROGRESS |
| Researcher | P1-S3-RES-01 Process Sprint 2 Signals | OPEN |

> This section is updated by orchestrator at each sprint start and /status-report

---

## Changelog

> Append-only. See `roadmap/changelog.md` for full log.

| Date | Change | Trigger | Approved By |
|------|--------|---------|-------------|
| 2026-03-02 | Initial roadmap created — 4 phases with hypotheses and exit conditions | /plan-prd | ORCHESTRATOR |
| 2026-03-04 | Major restructuring: Phase 2 → "Composable Blocks & Workflow Engine", Phase 3 → "Visual Builder & Integrations", Phase 4 → "Scale, Revenue & Compliance". 8 PRDs updated. | Whiteboard session — product owner validated composable workflow vision | PM + ORCHESTRATOR |
