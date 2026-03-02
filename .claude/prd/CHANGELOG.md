# PRD Changelog

> Append-only. Never edit existing entries.
> Every PRD change is logged here. No PRD content is ever deleted — archived content moves to `## Archived` sections.

---

## Schema

| Field | Description |
|-------|-------------|
| Date | ISO date: YYYY-MM-DD |
| Document | Which PRD layer file was changed |
| Section | Which section within that document |
| Summary | Before → After in one sentence |
| Trigger | What caused this change: build-learning / user-feedback / market-change / architect-decision / initial-creation |
| Author | Role that made the change |
| Downstream Effects | Which sprint tasks, roadmap areas, or other PRD docs were affected |

---

## Log

| Date | Document | Section | Summary | Trigger | Author | Downstream Effects |
|------|---------|---------|---------|---------|--------|-------------------|
| 2026-03-02 | master-prd.md | All sections | Initial PRD structure created | initial-creation | ORCHESTRATOR | All sprint tasks pending /plan-prd |
| 2026-03-02 | 01-vision-goals.md | All sections | Populated from concept brief + research findings | initial-creation | RESEARCHER | Vision, goals, non-goals, assumptions now Ops OS specific |
| 2026-03-02 | 02-user-research.md | All sections | Populated from user-personas.md research | initial-creation | RESEARCHER | 3 personas + user journeys now Ops OS specific |
| 2026-03-02 | 03-system-architecture.md | All sections | Populated from tech-stack-recommendation.md (PM-approved) | initial-creation | ORCHESTRATOR | Confirmed stack, component map, data flows |
| 2026-03-02 | 04-data-models.md | All sections | Populated with Block, Event, Edge, WorkflowJob, Embedding schemas | initial-creation | DATA ENGINEER | Schema matches Sprint 1 migrations |
| 2026-03-02 | 05-api-contracts.md | All sections | Populated with Blocks, Events, Actions, Workflows, AI endpoints | initial-creation | BACKEND ENGINEER | Contract spec for Sprint 2 integration |
| 2026-03-02 | 06-frontend-spec.md | All sections | Populated with 5 core user flows, component inventory, state management | initial-creation | FRONTEND ENGINEER | Desktop-first; shadcn/ui; TanStack Query |
| 2026-03-02 | 07-ai-ml-spec.md | All sections | Populated with chat control plane, action routing, semantic search, cost model | initial-creation | AI/ML ENGINEER | Sonnet for reasoning; Haiku Phase 2; OpenAI embeddings |
| 2026-03-02 | 08-infra-devops.md | All sections | Populated with Vercel+Supabase prototype stack, CI/CD, secrets management | initial-creation | DEVOPS ENGINEER | Zero-ops prototype; production upgrade path documented |
| 2026-03-02 | 09-data-pipeline.md | All sections | Populated with event ingestion, embedding, workflow pipelines | initial-creation | DATA ENGINEER | 3 pipelines; analytics requirements; data quality |
| 2026-03-02 | 10-security-compliance.md | All sections | Populated with event immutability enforcement, GDPR, SOC 2 roadmap, org isolation | initial-creation | ALL ROLES | FCA/MAS compliance requirements; PII inventory |
| 2026-03-02 | 11-testing-strategy.md | All sections | Populated with Vitest+Playwright pyramid, skip guards, critical E2E paths | initial-creation | QA ENGINEER | Matches Sprint 1 test counts; contract test patterns confirmed |
| 2026-03-02 | 12-launch-operations.md | All sections | Populated with design-partner launch plan, monitoring, support runbook | initial-creation | PM + DEVOPS | Design-partner-only Phase 1; no public launch |

---

## Notes

- Each PRD change = one row. Multiple changes on the same date = multiple rows.
- "Before → After" must be specific enough to understand what changed without reading the doc.
- Signal references: use the signal log entry date to link to the signal that triggered the change.
- Build-learning triggers: cite the task ID that generated the signal (e.g. "build-learning from P1-S1-BE-04").
- Downstream effects: be specific — "frontend-tasks.md P1-S1-FE-03 may need rework" is better than "frontend affected".
