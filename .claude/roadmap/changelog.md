# Roadmap Changelog

> Append-only. Never edit existing entries.
> Every roadmap change is logged HERE before it takes effect.
> An undocumented roadmap change is a silent inconsistency.

---

## Schema

| Field | Description |
|-------|-------------|
| Date | ISO date: YYYY-MM-DD |
| Change Type | See types below |
| What Changed | Before → After summary |
| Trigger | What caused this change (signal source, business event, exit condition evaluation) |
| Approved By | Role that approved: PM / ORC (orchestrator) |
| Downstream Effects | Which sprint task files, PRD docs, or shared-state.md were updated |

**Change Types:**
- `phase-added` — new phase added to roadmap
- `phase-modified` — phase hypothesis, exit condition, or scope changed
- `phase-closed` — phase evaluated and closed (exit conditions met)
- `phase-extended` — phase timeline extended (exit conditions not yet met)
- `area-reprioritised` — roadmap area moved between phases or intensity changed
- `exit-condition-updated` — exit condition rewritten (must include reason)
- `scope-changed` — features added or removed from a phase

---

## Log

| Date | Change Type | What Changed | Trigger | Approved By | Downstream Effects |
|------|------------|-------------|---------|-------------|-------------------|
| 2026-03-02 | phase-added | Initial roadmap created with 4 phases | /plan-prd | ORCHESTRATOR | sprints/phases.md created, sprint-1 task files generated |
| 2026-03-04 | phase-modified | Phase 2: "AI Layer & Workflow Configurability" → "Composable Blocks & Workflow Engine". Scope now includes custom block types, workflow-as-block, task routing, event subscriptions, webhook triggers, integration connectors. Exit condition: ≥1 custom workflow by partner + ≥1 LOI ≥£500/mo | Whiteboard session — product owner validated composable workflow vision with potential customers | PM + ORCHESTRATOR | prd/01,03,04,05,06,07,09; roadmap/ROADMAP.md, phase-hypotheses.md, north-star.md; sprints/phases.md |
| 2026-03-04 | phase-modified | Phase 3: "Integration Layer & Revenue" → "Visual Builder & Integrations". Scope now includes React Flow canvas, Salesforce/Xero connectors, document generation, agent AI, operational intelligence. Exit condition: ≥2 paying customers ≥£2k/mo | Whiteboard session — canvas moved from Phase 4 to Phase 3; integrations split across Phase 2-3 | PM + ORCHESTRATOR | prd/01,03,04,05,06,07; roadmap/ROADMAP.md, phase-hypotheses.md; sprints/phases.md |
| 2026-03-04 | phase-modified | Phase 4: "Scale & Production Hardening" → "Scale, Revenue & Compliance". Scope now includes Temporal, SOC 2, multi-region, marketplace. Exit condition: ≥5 paying, SOC 2 in progress | Whiteboard session — SOC 2 and multi-region consolidated here | PM + ORCHESTRATOR | roadmap/ROADMAP.md, phase-hypotheses.md; sprints/phases.md |
| 2026-03-04 | scope-changed | Phase 2 gains: custom block type definitions (block_type_definitions table), workflow-as-block pattern (templates are Blocks that spawn instances), task routing (route_human/route_agent steps), integration connectors table, inbound webhooks, event subscriptions | Whiteboard session — workflow definitions as Blocks in business graph validated with customers | PM + ORCHESTRATOR | prd/04-data-models.md, prd/05-api-contracts.md |
| 2026-03-04 | area-reprioritised | No-code canvas: moved from Phase 4 → Phase 3. Integration layer: split Phase 2 (connectors + webhooks) / Phase 3 (Salesforce/Xero connectors). Custom block types: added as new area in Phase 2. Task routing: added as new area in Phase 2. Document generation: added as new area in Phase 3. Operational intelligence: added as new area in Phase 3. | Whiteboard session — restructured roadmap | PM + ORCHESTRATOR | roadmap/ROADMAP.md |
| 2026-03-04 | exit-condition-updated | Phase 2 exit: was "≥30% AI-routed actions" → now "≥1 custom workflow created by design partner + ≥1 LOI ≥£500/mo". Reason: old condition measured AI autonomy (wrong priority); new condition measures composability value (validated as purchase driver) | Whiteboard session — AI autonomy metric premature; composability is the validated differentiator | PM + ORCHESTRATOR | roadmap/ROADMAP.md, roadmap/phase-hypotheses.md, sprints/phases.md |
| 2026-03-04 | exit-condition-updated | Phase 3 exit: was "≥1 paying customer ≥£2k/mo" → now "≥2 paying customers ≥£2k/mo". Reason: single-customer risk too high; need repeatable pattern | Whiteboard session — raised bar for revenue phase | PM + ORCHESTRATOR | roadmap/ROADMAP.md, roadmap/phase-hypotheses.md, sprints/phases.md |
| 2026-03-10 | phase-closed | Phase 1: ACTIVE → COMPLETE. All 4 sprints done (39/39 tasks). Core primitives validated: Blocks, Events, Actions, workflow engine, AI chat, embeddings, Clerk auth, Vercel deploy. | Sprint 4 retro — all exit conditions met (code); design partner metrics deferred (user = test user) | ORCHESTRATOR | sprints/phases.md, roadmap/ROADMAP.md |
| 2026-03-10 | phase-modified | Phase 2 scope expanded: Sprints 5–10. Added canvas (was Phase 3), Google integration, document generation, brand kit, action menu, library pages, My Work hub. Exit condition updated to: user runs ≥5 complete workflows E2E. | User direction — pull forward canvas, add Google, add docs, user is primary tester | PM + ORCHESTRATOR | sprints/phases.md, roadmap/ROADMAP.md, plan file |
| 2026-03-10 | scope-changed | Phase 2 CODE COMPLETE. 52/54 tasks done (96%) across 6 sprints. 395 tests. 2 deferred: Gmail receive trigger, UX research (moved to Sprint 10 and completed). All features built: canvas, Google OAuth/Gmail/Calendar/Drive, document templates/brand kit/AI generation/PDF, dashboard overhaul, 5 loading skeletons, E2E test, manual test plan. | Sprint 10 retro — final sprint complete | ORCHESTRATOR | sprints/shared-state.md, sprints/phases.md, roadmap/ROADMAP.md |
| 2026-03-12 | exit-condition-updated | Phase 2 exit conditions re-scoped. Original: "user runs ≥5 complete workflows with email + docs". New: closed as code-complete; usage validation moved to Phase 3 milestones (onboard 2-3 design partners). Reason: no design partners onboarded yet, exit conditions assumed partner usage during Phase 2. | User manual testing + feature gap analysis — user tested app, identified Phase 3 scope | PM + ORCHESTRATOR | sprints/phases.md, roadmap/ROADMAP.md |
| 2026-03-12 | phase-modified | Phase 3: "Scale, Advanced AI & Marketplace" → "Platform Evolution: RBAC, Routing, Delta AI, Doc Gen V2". Complete scope rewrite based on user feature gap analysis. New scope: 5 new block types, custom RBAC, routing engine, AI delta engine, doc gen V2, enhanced task cards, workflow canvas I/O, admin settings. Salesforce/Xero/billing deferred to Phase 4. Exit condition: RBAC + routing + delta AI + doc gen deployed with test data. | User feature gap analysis after manual testing — identified HubSpot-style blocks, RBAC, routing, AI insights as critical | PM + ORCHESTRATOR | sprints/phases.md, roadmap/ROADMAP.md, all PRDs updated |
| 2026-03-12 | scope-changed | Phase 3 activated. 8 sprints, 53 tasks. Sprint 0 = scaffold updates (PRDs, rules, standards, agents, task files). Sprint 1 = bug fixes. Sprint 2 = new block types. Sprint 3 = RBAC. Sprint 4 = routing engine. Sprint 5 = canvas enhancements. Sprint 6 = doc gen V2. Sprint 7 = delta engine. Sprint 8 = admin settings. | User-confirmed design decisions documented in plan file | ORCHESTRATOR | .claude/sprints/phase-3/ (49 files created), all coordination files |
| 2026-03-12 | scope-changed | Phase 4 gains: Block-specific layouts (HubSpot-style client, deal/project tabs, org page), revenue module, org dashboard, agent queue processor, enterprise features. Deferred from Phase 3 pending user-provided design direction. | User: "I will provide more detailed examples when we get around to it" | PM + ORCHESTRATOR | sprints/phases.md, roadmap/ROADMAP.md |
| 2026-03-13 | phase-closed | Phase 3: ACTIVE → COMPLETE (code). 70/70 tasks across 8 sprints. | Sprint 8 retro | ORCHESTRATOR | sprints/phases.md, roadmap/ROADMAP.md |
| 2026-03-13 | phase-closed | Phase 4: ACTIVE → COMPLETE (code). 42/42 tasks across 4 sprints. | Sprint 12 retro | ORCHESTRATOR | sprints/phases.md, roadmap/ROADMAP.md |
| 2026-03-15 | phase-closed | Phase 5: ACTIVE → COMPLETE (code). 48/48 tasks across 5 sprints. 1414 tests. | Sprint 17 retro | ORCHESTRATOR | sprints/phases.md, roadmap/ROADMAP.md |
| 2026-03-17 | phase-modified | Phase 6 core sprints (S18–S21) code-complete. 37/37 tasks, 1689 tests. AI layer deep-dive (6 improvements) shipped post-sprint. | Sprint 21 retro + AI-ML-Engineer deep-dive | ORCHESTRATOR | sprints/shared-state.md, sprints/phases.md |
| 2026-03-18 | scope-changed | Phase 6 extended with Sprints 22–23: Workflow Builder UX Redesign. Sprint 22 (Foundation, 8 tasks, COMPLETE): monolith decomposition + 7 shared components + AI templates. Sprint 23 (Per-Node Improvements, 15 tasks, PLANNED): trigger configs, route node, for-each node, variable picker wiring, condition handler, context-aware auto-fill. Phase 6 status → ACTIVE. | User-driven UX redesign — streamline workflow builder config for non-technical users (dropdown before free text, entity-driven, context-aware) | PM + ORCHESTRATOR | prd/06-frontend-spec.md, sprints/phases.md, sprints/shared-state.md, roadmap/ROADMAP.md |
| 2026-03-18 | phase-modified | ROADMAP.md phase table expanded: was 4 phases → now 7 phases with accurate status. Roadmap areas table expanded from P1–P4 to P1–P7. Current Focus section updated from stale Phase 3 to accurate Phase 6. | Documentation sync — ROADMAP.md was stale (showed Phase 3 as ACTIVE despite Phase 6 being current) | ORCHESTRATOR | roadmap/ROADMAP.md |

---

## Notes

- Each row represents one atomic change. Multiple changes on the same day = multiple rows.
- The "Before → After" in "What Changed" should be specific enough to reconstruct the state of the roadmap at any point.
- If a phase is closed and re-opened (rare), log both events separately.
- Exit condition updates require the most documentation — explain WHY the condition changed, not just what it changed to.
