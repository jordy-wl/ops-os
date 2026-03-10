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

---

## Notes

- Each row represents one atomic change. Multiple changes on the same day = multiple rows.
- The "Before → After" in "What Changed" should be specific enough to reconstruct the state of the roadmap at any point.
- If a phase is closed and re-opened (rare), log both events separately.
- Exit condition updates require the most documentation — explain WHY the condition changed, not just what it changed to.
