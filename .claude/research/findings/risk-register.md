# Risk Register — Ops OS

> Living document. Risks are NEVER removed — only mitigated or accepted.
> Updated by researcher at research phase; reviewed by orchestrator + PM at every phase boundary.
> Risk score = Likelihood (1–5) × Impact (1–5). Sorted by score, descending.
> Last updated: 2026-03-02

---

## How to Use This Register

**Researcher:** Add risks during initial research and as signals emerge. Use the format below.
**Engineers:** Flag technical risks discovered during sprint work — add as new rows.
**Orchestrator + PM:** Review at each phase boundary. Move mitigated risks to the Mitigated section.

---

## Active Risks

| ID | Category | Risk | Likelihood | Impact | Score | Mitigation | Owner | Status |
|----|----------|------|-----------|--------|-------|-----------|-------|--------|
| R-001 | Market | Users want layer-on-top of existing tools, not rip-and-replace. Ops OS requires the concept that it IS the central system — wrong adoption model = zero adoption. | 4 | 5 | 20 | Start with one workflow that Ops OS does better than anything else. Don't ask users to replace their CRM in Phase 1 — ask them to run one workflow through Ops OS. Prove value incrementally. | PM | ACTIVE |
| R-002 | Technical | Custom workflow engine built in prototype never replaced with Temporal. The Postgres queue becomes production load-bearing and fails at scale. | 4 | 4 | 16 | Hard constraint: Postgres queue is prototype-only. At Phase 2 kick-off, evaluate Temporal vs. Inngest. No workflow engine migration = no Phase 2 sign-off. | Architect | ACTIVE |
| R-003 | Execution | No-code canvas (Phase 2+) is scoped into Phase 1 under pressure from stakeholders or design partners. It is a product in its own right and will derail Phase 1 delivery. | 4 | 4 | 16 | Canvas is formally out of Phase 1 scope. If design partners ask for it: acknowledge, log as signal, roadmap for Phase 2. If internal pressure mounts: escalate to PM — the decision must be explicit, not drift. | PM + Orchestrator | ACTIVE |
| R-004 | Technical | AI confidence routing is miscalibrated. Too conservative = no AI value. Too permissive = AI executes wrong actions in regulated workflows. Either breaks the product. | 3 | 5 | 15 | Launch with confidence threshold = 1.0 (all actions require human approval). Log what the AI would have done automatically. After 30 days of data, review with PM and architect before enabling any autonomous execution. | AI/ML Engineer | ACTIVE |
| R-005 | Market | Capital markets sales cycles (6–12 months) are incompatible with bootstrap runway. Design partners are needed but the path to paying customers is long. | 4 | 3 | 12 | Target design partners, not buyers, in Phase 1. "Co-develop with us for 3 months" is a different conversation than "buy our product." Identify 2–3 capital markets contacts in the founder's network who can be design partners by Phase 1 start. | PM + Founder | ACTIVE |
| R-006 | Market | Wrong vertical anchor. Professional services vs. capital markets have very different requirements. Building for the wrong primary persona = wasted Phase 1 effort. | 3 | 4 | 12 | Decision: capital markets is the primary persona. Professional services is secondary. Orchestrator must flag any sprint task that optimises for professional services at the expense of the primary persona. If design partners are all professional services: revisit this decision explicitly at Phase 1 retro. | PM | ACTIVE |
| R-007 | Technical | Graph query performance degrades with real data. Client context queries become slow (>500ms) before the product is validated. | 3 | 4 | 12 | Run graph performance spike in Sprint 1 (10k blocks, 100k edges). If <200ms: proceed with Postgres adjacency list. If >200ms: evaluate Apache AGE or Neo4j before Phase 2 commit. | Backend Engineer | ACTIVE |
| R-008 | Technical | SOC 2 Type II requirement from capital markets design partners before they can use the system with production data. SOC 2 takes 6–12 months and costs £20–50k. | 2 | 5 | 10 | Negotiate with design partners: pilot with anonymised/test data first. SOC 2 is a production requirement, not a pilot requirement. Start SOC 2 process at Phase 2 (when first revenue signal exists). | DevOps + PM | ACTIVE |
| R-009 | Competitive | Rippling or another well-funded BOS expands into capital markets operations. Reduces differentiation window. | 2 | 5 | 10 | Rippling's capital markets expansion is unlikely in 24 months — they're focused on HR/IT/Finance in 80 countries. Our differentiation window: move fast, get design partners with references, build compliance-grade primitives that take years to replicate. | PM | ACTIVE |
| R-010 | Financial | Claude API costs scale unexpectedly if AI context assembly is expensive at scale. 500k tokens per user session = uneconomical. | 3 | 3 | 9 | Monitor API costs from day 1. Implement caching for context assembly (block data doesn't change every second). Use Haiku for extraction tasks. Set cost alerts at $50/day. | AI/ML Engineer | ACTIVE |
| R-011 | Competitive | Notion ships stateful blocks or an immutable event log feature. Reduces differentiation. | 2 | 4 | 8 | Notion's user base is knowledge workers, not compliance-regulated ops teams. They won't build compliance-grade audit trails that sacrifice their document-first model. Watch, don't panic. | PM | ACTIVE |
| R-012 | Execution | Founder is building solo or with a very small team. Context-switching between researcher/architect/engineer roles creates bottlenecks. | 3 | 3 | 9 | Ops OS orchestration system (this repo) is designed to reduce cognitive overhead. Use agent roles strictly. Orchestrator coordinates; engineers execute; researcher surfaces signals. Don't wear all hats simultaneously. | Orchestrator | ACTIVE |
| R-013 | External | Data residency requirements (FCA, MAS, ASIC) prevent using Supabase (US-hosted) for capital markets clients in some jurisdictions. | 2 | 4 | 8 | Supabase has EU region (Ireland). MAS requires Singapore data residency — Supabase may not support this. Verify Supabase region support for each target jurisdiction before signing capital markets design partners. Mitigation: design partner pilots on EU region; evaluate Neon or self-hosted Postgres for Singapore/APAC. | DevOps | ACTIVE |

---

## Mitigated Risks

| ID | Risk (summary) | Mitigation Applied | Date | Evidence |
|----|---------------|-------------------|------|---------|
| — | No entries yet | | | |

---

## Accepted Risks

| ID | Risk (summary) | Why Accepted | Acceptance Date | Reviewer |
|----|---------------|-------------|----------------|---------|
| — | No entries yet | | | |

---

## Risk Category Definitions

| Category | Description |
|---------|-------------|
| Technical | Engineering risks — performance, scalability, technology choices |
| Market | Customer, competitor, or market dynamics risks |
| Execution | Team, process, or delivery risks |
| External | Regulatory, legal, or third-party dependency risks |
| Financial | Revenue, cost, or funding risks |

---

## Risk Review Log

| Date | Reviewed By | Changes Made | Next Review |
|------|------------|-------------|------------|
| 2026-03-02 | Researcher | Initial register created | Phase 1 Sprint 1 retro |
