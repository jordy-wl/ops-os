# Master PRD — Ops OS

> Read this first. It orients you before diving into layer documents.
> All PRD edits logged in `prd/CHANGELOG.md`. No content is ever deleted — archived content moves to `## Archived` sections.

---

## Product Overview

Ops OS is a Business Operating System (BOS) that replaces the fragmented stack of SaaS tools a company uses to run itself. Every business entity — a client, a deal, a project, a contract — exists as a stateful, graph-connected Block with a complete, immutable event history. An ambient AI layer reads this business graph and routes workflow steps: executing routine actions automatically where confidence is high, and surfacing decisions to the right people at the right time. Primary market: global operations leads at capital markets and financial services firms (50–500 employees) who need compliance-grade audit trails, multi-jurisdiction workflow configuration, and a single source of truth across teams.

---

## The Problem Being Solved

Operations leads at capital markets firms use 5–12 disconnected SaaS tools (Salesforce, Monday.com, SharePoint, Xero, compliance systems) to run their business. When a new client onboards, data must be manually entered into each system, status must be manually aggregated, and approvals must be chased via email. When a regulator asks "what was the state of this client's onboarding on March 15th?" — the answer requires manually reconstructing events from email threads, spreadsheet versions, and timestamps across four different systems. Client onboarding takes 15–30 business days when it should take 3–5. Employees spend 20–40% of their week answering "where are we with X?" questions. The same onboarding workflow has 8–12 jurisdiction-specific variants, each maintained separately in spreadsheets with no version control.

---

## Who It's For

**Primary:** Global Operations Lead at a capital markets or financial services firm (50–500 employees). Titles: COO, Head of Operations, Head of Client Services, Compliance Operations Manager. Multi-jurisdiction operations (London + US + APAC). Willingness to pay: £2k–30k/month. Evaluates on: auditability, configurable workflows without IT, jurisdiction-aware permissions, security/data residency.

**Secondary A:** Operations Lead / RevOps at a professional services firm (10–50 employees, agency, consultancy, law firm). Uses Zapier as glue. Evaluates on time-to-value and immediate productivity impact.

**Secondary B:** Technical Co-founder / CTO at ops-heavy SaaS (20–100 employees). Evaluates on API quality, data model flexibility, audit trail completeness.

---

## What Makes It Different

Competitors store business entities in silos and bolt AI on top. Ops OS is designed from the ground up with four structural advantages:

1. **Immutable event timeline as a product feature:** Every change to every entity is recorded as an append-only event — a compliance-grade audit trail, not just good engineering. No competitor has this as a native primitive.
2. **Graph-connected business context:** Blocks connect to each other (client → deal → project → contract → contact). AI that reads the full graph can answer "tell me everything about XYZ Capital" — not just "here's the CRM entry."
3. **AI that governs, not just assists:** Confidence × risk policy routing determines whether an action auto-executes or routes to a human. Generic tools have chatbots; Ops OS has a risk-aware execution engine.
4. **Composable operations — workflows are Blocks:** Workflow definitions are first-class entities in the business graph. Templates define how work _should_ go; instances track how it _actually_ went. AI compares design vs reality = operational intelligence that no competitor can offer because they don't have workflow definitions in the same graph as business entities.

---

## The 12 PRD Layers

| # | Document | Description | Status |
|---|---------|-------------|--------|
| 01 | [01-vision-goals.md](01-vision-goals.md) | Vision, strategic goals, non-goals, assumptions | DRAFT |
| 02 | [02-user-research.md](02-user-research.md) | Personas, user journeys, key insights | DRAFT |
| 03 | [03-system-architecture.md](03-system-architecture.md) | Architecture overview, component map, tech decisions | DRAFT |
| 04 | [04-data-models.md](04-data-models.md) | Core entities, relationships, PII map | DRAFT |
| 05 | [05-api-contracts.md](05-api-contracts.md) | Endpoint catalogue, request/response schemas | DRAFT |
| 06 | [06-frontend-spec.md](06-frontend-spec.md) | UI flows, component inventory, state requirements | DRAFT |
| 07 | [07-ai-ml-spec.md](07-ai-ml-spec.md) | AI features, evaluation criteria, cost model | DRAFT |
| 08 | [08-infra-devops.md](08-infra-devops.md) | Infrastructure, environments, deployment, observability | DRAFT |
| 09 | [09-data-pipeline.md](09-data-pipeline.md) | Data sources, pipelines, analytics requirements | DRAFT |
| 10 | [10-security-compliance.md](10-security-compliance.md) | Security model, PII handling, compliance requirements | DRAFT |
| 11 | [11-testing-strategy.md](11-testing-strategy.md) | Test pyramid, coverage targets, E2E paths | DRAFT |
| 12 | [12-launch-operations.md](12-launch-operations.md) | Launch plan, monitoring, runbooks, success metrics | DRAFT |

Status: DRAFT / IN REVIEW / APPROVED / SUPERSEDED

---

## Open Questions (Cross-Cutting)

| Question | Why It Matters | Owner | Status |
|----------|---------------|-------|--------|
| Rip-and-replace vs. layer-on-top strategy | Determines integrations priority and GTM approach — Phase 1 design partners will answer this | PM + Researcher | OPEN |
| Which specific capital markets workflow is the highest-pain entry point? | Client onboarding is the leading hypothesis; validate with design partner interviews | Researcher | OPEN |
| ~~Canvas requirement timing: do design partners need it before paying?~~ | ~~If yes, Phase 2 timeline moves up; if no, Phase 1 proves primitives without it~~ | ~~PM~~ | **CLOSED** — 2026-03-04. Answer: No. Phase 2 delivers composable workflows via API + forms. Canvas (React Flow) is Phase 3 — after composition patterns are validated. Validated in whiteboard session. |
| Time to first working version / launch target | Affects phase scope and resourcing | PM | OPEN — NEEDS USER INPUT |
| ~~React Flow vs alternative canvas libraries~~ | ~~Phase 3 visual workflow builder needs a canvas library. React Flow is leading candidate but evaluate alternatives (Xyflow, custom SVG).~~ | ~~Frontend Engineer~~ | **CLOSED** — 2026-03-12. Answer: React Flow confirmed. Already implemented in Phase 2 canvas. No re-evaluation needed. |
| What is the "signature workflow" for each vertical? | The workflow template that becomes the entry point demo. Client onboarding for capital markets; what for professional services? | Researcher + PM | OPEN — Phase 2 |
| ~~Which agent framework for route_agent processing?~~ | ~~Phase 3 agent queue processor needs a framework. Claude API tool use is baseline; evaluate LangChain, custom.~~ | ~~AI/ML Engineer~~ | **CLOSED** — 2026-03-12. Answer: Claude API tool use (current approach). Already implemented in Phase 2 chat system. Agent queue processor deferred to Phase 4. |

---

## Decision Log

| Date | Decision | Options Considered | Rationale | Decided By |
|------|----------|-------------------|-----------|-----------|
| 2026-03-02 | Primary persona = capital markets ops lead (not professional services) | Professional services SMB, capital markets, developer/CTO | Capital markets has highest willingness to pay, strongest fit with audit trail primitives, and unserved mid-market white space | PM |
| 2026-03-02 | Canvas is Phase 2+ only | Phase 1 canvas, Phase 2+ canvas, no canvas | Canvas is a product in its own right; Phase 1 proves primitives via API + chat | Orchestrator + PM |
| 2026-03-02 | Prototype stack: Next.js + Supabase + Clerk + Claude API + Vercel | Multiple alternatives evaluated in tech-stack-recommendation.md | Bootstrap-compatible: zero DevOps, generous free tiers, fast time-to-working-product | Researcher → PM APPROVED 2026-03-02 |
| 2026-03-02 | AI confidence threshold starts at 1.0 (all actions require human approval) | 0.8, 0.9, 1.0 | Too risky to auto-execute in regulated context without calibration data; tune after 30 days of data | AI/ML Engineer |
| 2026-03-04 | Workflow definitions are Blocks in the business graph ("workflow-as-block") | Separate workflow_definitions table, Workflow as Block, external workflow service | Workflows in the graph = auditable, graph-traversable, composable, AI-readable. Validated with potential customers in whiteboard session. | PM + Orchestrator |
| 2026-03-04 | Phase 2 restructured: "Composable Blocks & Workflow Engine" (custom block types, workflow-as-block, task routing, integration connectors) | Keep original Phase 2 (AI routing focus), Restructure around composability | Composability is the validated purchase driver; AI autonomy is premature without workflow infrastructure | PM + Orchestrator |
| 2026-03-04 | Visual canvas moved to Phase 3 (was Phase 4) | Phase 2 canvas, Phase 3 canvas, Phase 4 canvas | Phase 2 proves composable workflows via API+forms; Phase 3 adds visual canvas when patterns are validated | PM + Orchestrator |
| 2026-03-04 | Temporal deferred to Phase 4 (was Phase 2) | Phase 2 Temporal, Phase 4 Temporal | Workflow-as-block pattern handles Phase 2-3 scale; Temporal needed only for exactly-once at enterprise scale | PM + Orchestrator |
| 2026-03-12 | Phase 3 scope: RBAC + Routing + Delta AI + Doc Gen V2 | HubSpot-style layouts (deferred), full platform evolution, incremental | Foundation engines first; block-specific layouts require user-provided design direction deferred to Phase 4 | PM + Orchestrator |
| 2026-03-12 | Custom RBAC independent of Clerk | Clerk-managed roles, hybrid, fully custom | Clerk = login only; full RBAC independence allows granular permissions (10 permissions) and custom role creation | PM |
| 2026-03-12 | React Flow confirmed for Phase 3 canvas enhancements | React Flow, Xyflow, custom SVG | Already implemented in Phase 2; no need to re-evaluate. Add Input/Output nodes and data flow visualization | PM + Frontend Engineer |
| 2026-03-12 | Agent framework = Claude API tool use (current approach) | Claude API, LangChain, custom framework | Already implemented in Phase 2 chat; agent queue processor deferred to Phase 4 | AI/ML Engineer |
| 2026-03-12 | Sub-org hierarchy: 4-level max | Flat (no hierarchy), unlimited depth, fixed depth | Org → SubOrg → Department → Team. Self-referencing FK on orgs table. Prevents runaway nesting complexity | PM |

---

## PRD Status

| Layer | Author | Last Updated | Approved By |
|-------|--------|-------------|-------------|
| 01 Vision | Researcher | 2026-03-04 | PM — PENDING |
| 02 Research | Researcher | 2026-03-02 | PM — PENDING |
| 03 Architecture | Orchestrator | 2026-03-04 | PM — PENDING |
| 04 Data Models | Data Engineer | 2026-03-12 | Orchestrator — PENDING |
| 05 API Contracts | Backend Engineer | 2026-03-12 | Frontend Engineer — PENDING |
| 06 Frontend Spec | Frontend Engineer | 2026-03-12 | PM — PENDING |
| 07 AI/ML Spec | AI/ML Engineer | 2026-03-12 | PM — PENDING |
| 08 Infra/DevOps | DevOps Engineer | 2026-03-02 | Orchestrator — PENDING |
| 09 Data Pipeline | Data Engineer | 2026-03-04 | Orchestrator — PENDING |
| 10 Security | All roles review | 2026-03-12 | PM — PENDING |
| 11 Testing | QA Engineer | 2026-03-02 | Orchestrator — PENDING |
| 12 Launch Ops | PM + DevOps | 2026-03-02 | PM — PENDING |
