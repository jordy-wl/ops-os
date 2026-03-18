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
| 2026-03-04 | 04-data-models.md | Core Entities, Block types, ER diagram, Open Questions | Added block_type_definitions table, workflow_template/workflow_instance/task_queue_item block types, integration_connectors table, new event types. WorkflowJob archived (replaced by workflow_instance Blocks in Phase 2). Closed "Block data validation" open question (answered: yes, via block_type_definitions.field_schema). | architect-decision | ORCHESTRATOR | prd/05 (new endpoints), prd/06 (dynamic fields), sprints/phases.md |
| 2026-03-04 | 03-system-architecture.md | System Components, Architecture Decision Log | Added workflow-as-block architecture section, integration layer architecture, 5 new system components (workflow builder API, task queue service, integration connector, document generation, operational intelligence). Canvas decision archived → moved to Phase 3. | architect-decision | ORCHESTRATOR | prd/04 (data model), prd/05 (API contracts) |
| 2026-03-04 | 05-api-contracts.md | Endpoint Catalogue, Action Types | Added endpoints: block type management (CRUD), workflow template CRUD, task queue (claim/complete/reassign), integration connectors (CRUD + test), inbound webhooks. Expanded action types with 10 new types. Phase 1 workflow endpoints archived. | architect-decision | ORCHESTRATOR | prd/06 (frontend), prd/03 (architecture) |
| 2026-03-04 | 06-frontend-spec.md | Core User Flows, Component Inventory | Added 4 new flows: Visual Workflow Builder (Phase 3), Block Type Configuration (Phase 2), Task Queue (Phase 2), Document Generation (Phase 3). Updated Flow 2 + Flow 4 for dynamic fields. Added ~10 new components. | architect-decision | ORCHESTRATOR | prd/05 (API source) |
| 2026-03-04 | 07-ai-ml-spec.md | AI Features, Evaluation Criteria | Added: Operational Intelligence (design vs reality analysis), Agent Queue Processor, Document Intelligence, Workflow Suggestion. New eval criteria for each. | architect-decision | ORCHESTRATOR | prd/04 (workflow_instance events), prd/09 (pipelines) |
| 2026-03-04 | 09-data-pipeline.md | Pipeline Specifications | Added Pipeline 4 (Integration Signal Pipeline: webhooks → events → trigger evaluation → workflow spawn) and Pipeline 5 (Outbound Action Pipeline: API calls from workflow steps). | architect-decision | ORCHESTRATOR | prd/04 (integration_connectors), prd/05 (webhook endpoint) |
| 2026-03-04 | 01-vision-goals.md | Non-Goals, Assumptions, Strategic Goals | Canvas non-goal archived (→ Phase 3). Integrations split Phase 2/3. Added assumptions: custom blocks validated, workflow composition validated, task routing validated. Updated Phase 2 strategic goals. | architect-decision | ORCHESTRATOR | roadmap/ROADMAP.md, sprints/phases.md |
| 2026-03-04 | master-prd.md | Differentiators, Open Questions, Decision Log | Added 4th differentiator (composable operations). Closed canvas open question. Added 3 new open questions (React Flow vs alternatives, signature workflow, agent framework). Updated PRD status dates. | architect-decision | ORCHESTRATOR | All PRD layers |
| 2026-03-04 | 04-data-models.md | Workflow Job schema | `started_at` → `claimed_at`, `retry_count` → `attempts`, clarified `done` as canonical status value (not `completed`) | build-learning from P1-S2-BE-01 | RESEARCHER | None — aligns PRD with existing implementation |
| 2026-03-04 | 03-system-architecture.md | Component Communication | Added CRON_SECRET/WORKFLOW_ENGINE_SECRET auth details to Vercel Cron row | build-learning from P1-S2-BE-01 | RESEARCHER | prd/08-infra-devops.md env vars section |
| 2026-03-04 | 08-infra-devops.md | Cloud Provider and Region, Environment Variables | Primary region changed from EU West (Ireland) to APAC (ap-south-1) for ASIC; EU moved to Phase 4. Added CRON_SECRET + WORKFLOW_ENGINE_SECRET to env vars. | build-learning from P1-S2-DE-01, P1-S2-BE-01 | RESEARCHER | prd/10-security-compliance.md region references may need updating |
| 2026-03-04 | 06-frontend-spec.md | Flow 2: Block Detail | Added "Start Onboarding" button as Phase 1 primary workflow trigger path; "Trigger workflow" sheet deferred to Phase 2+ | build-learning from P1-S2-DE-01 | RESEARCHER | Sprint 3 FE-01 already shipped this |
| 2026-03-12 | 04-data-models.md | Block types, New entities | Added 5 new Phase 3 block types (Solution, Product, Service, Team Member, Policy). Added RBAC tables (roles, permission_groups, user_permissions). Added notifications table. Added sub-org hierarchy (parent_org_id, org_level on orgs). | architect-decision | ORCHESTRATOR | prd/05 (new endpoints), sprints/phase-3/ task files |
| 2026-03-12 | 05-api-contracts.md | Endpoint Catalogue | Added Phase 3 endpoints: RBAC permission/role management, team CRUD, org hierarchy, routing policy API, notification API, document storage/versioning, API key management. | architect-decision | ORCHESTRATOR | prd/06 (frontend flows), prd/04 (data models) |
| 2026-03-12 | 06-frontend-spec.md | User Flows, Component Inventory | Added Phase 3 flows: settings page restructure (10 sections), enhanced task cards (approve/reject/edit), Input/Output canvas nodes, document preview panel, AI insights panel, theme toggle. | architect-decision | ORCHESTRATOR | prd/05 (API source), prd/07 (AI insights) |
| 2026-03-12 | 07-ai-ml-spec.md | AI Features | Added Phase 3 AI features: delta calculation engine, AI insights generator (4 categories), confidence scoring framework, context-aware document generation, delta-aware chat context, auto task generation from delta thresholds. | architect-decision | ORCHESTRATOR | prd/04 (notification table), prd/09 (delta pipeline) |
| 2026-03-12 | 10-security-compliance.md | RBAC, Audit | Added Phase 3 security: granular RBAC permission model (10 permissions), agent decision audit logging, API key security (hashing + rotation), routing decision audit trail. | architect-decision | ORCHESTRATOR | prd/05 (API key endpoints), prd/04 (RBAC tables) |
| 2026-03-12 | master-prd.md | Open Questions, Decision Log, PRD Status | Closed: React Flow confirmed, agent framework = Claude API tool use. Added 5 Phase 3 decisions. Updated PRD status dates. | architect-decision | ORCHESTRATOR | All PRD layers |
| 2026-03-18 | 06-frontend-spec.md | Workflow Builder UX Redesign (new section) | Added comprehensive Workflow Builder UX Redesign section: design principles (5), architecture overview (3-layer decomposition), shared component inventory (14 components), node palette (27 nodes, 8 categories), AI prompt templates (14 templates, 4 node types). Archived Input/Output node section (superseded by trigger/action config integration). | architect-decision | FRONTEND ENGINEER | sprints/phase-6/ (sprint-22, sprint-23 task files), roadmap/ROADMAP.md |

---

## Notes

- Each PRD change = one row. Multiple changes on the same date = multiple rows.
- "Before → After" must be specific enough to understand what changed without reading the doc.
- Signal references: use the signal log entry date to link to the signal that triggered the change.
- Build-learning triggers: cite the task ID that generated the signal (e.g. "build-learning from P1-S1-BE-04").
- Downstream effects: be specific — "frontend-tasks.md P1-S1-FE-03 may need rework" is better than "frontend affected".
