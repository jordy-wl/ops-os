# Sprint 5 Retrospective

> Phase 2: Composable Blocks & Workflow Engine
> Sprint 5: Workflow Runtime + Task Queue
> Sprint dates: 2026-03-06 to 2026-03-09
> Retro date: 2026-03-09

---

## Sprint Summary

**Goal:** Build workflow instance spawning from templates, step execution engine, trigger evaluation (manual + event), task queue API. Also merge the 11-PR backlog to production.

**Result:** 7/7 tasks DONE (100%). All PRs (#13-#19) merged to main. PR #20 (bug fixes from gap analysis) still open. 182 tests passing, 33 skipped, 0 failed.

**Velocity:** 7 tasks / 12.5 estimated days of effort across 3 roles (Backend x4, Frontend x2, QA x1). Delivered in ~3 calendar days.

---

## Deliverables

| Task ID | Title | PR | Tests | Status |
|---------|-------|-----|-------|--------|
| P2-S5-BE-01 | Workflow Instance Spawning API | #13 MERGED | 14 tests | DONE |
| P2-S5-BE-02 | Step Execution Engine | #14 MERGED | 23 tests | DONE |
| P2-S5-BE-03 | Trigger Evaluation (Manual + Event) | #15 MERGED | 16 tests | DONE |
| P2-S5-BE-04 | Task Queue API | #16 MERGED | 14 tests | DONE |
| P2-S5-FE-01 | Workflow Template List + Create UI | #17 MERGED | 4 breakpoints | DONE |
| P2-S5-FE-02 | My Tasks Queue UI | #18 MERGED | 4 breakpoints | DONE |
| P2-S5-QA-01 | Workflow Runtime Integration Tests | #19 MERGED | 37 integration tests | DONE |

---

## What Went Well

1. **Clean critical path execution.** The dependency chain (BE-01 -> BE-02 + BE-03 + BE-04 -> FE-02 + QA-01) was respected and tasks flowed smoothly. No task was blocked by another for longer than expected.

2. **11-PR backlog cleared.** Sprints 3-4 had accumulated 11 unmerged PRs (#2-#12). All were merged to main during Sprint 5, unblocking production deployments. This was the single biggest risk identified at sprint start and was resolved immediately.

3. **Comprehensive test coverage.** QA-01 delivered 37 integration tests validating all workflow runtime contracts. Combined with per-task unit tests (67 total across BE tasks), the workflow runtime has strong test coverage. Full suite: 182 passed, 0 failed.

4. **Workflow-as-block pattern validated.** The core architectural bet of Sprint 5 (workflow instances as Blocks, task queue items as Blocks, all connected via edges) worked cleanly. Instances reference templates via `instance_of` edges, connect to entity blocks via `processing` edges, and spawn `task_queue_item` Blocks via `spawned` edges. The event timeline captures the full workflow lifecycle.

5. **All gate evidence filed.** Every task has Gates 1, 2 (or 4 for FE), 3 (for BE), and 5 logged with passing evidence. No NEEDS_WORK verdicts.

---

## What Did Not Go Well

1. **Gap analysis found 4 bugs in previously merged code.** A post-merge gap analysis uncovered defects that should have been caught during their original sprint gates:
   - **Edge type column naming:** `block_edges` table used `edge_type` but application code expected `relationship`. Mismatch between migration and PRD-04 spec.
   - **Missing actor_id:** Event creation paths were not consistently passing `actor_id`, resulting in NULL actor_id in events where a user was clearly the actor. Breaks audit trail completeness.
   - **PII in embeddings:** The `embedEvent()` function was passing raw block names (potentially containing personal names for contact-type blocks) into the embedding content without PII stripping. Violates PRD-10 (security-compliance) and Gate 5.
   - **Block + event not atomic:** Block creation and its corresponding `block.created` event were not wrapped in a transaction. If the event insert failed, a block would exist without an audit trail entry. Violates the events-first principle in PRD-05.

   These are logged as PR #20 (fix/pii-and-atomicity) and are still OPEN. They represent a gate discipline issue: the original tasks passed Gate 5 (security baseline) but the checks were not thorough enough to catch these cross-cutting concerns.

2. **Gate results file was not populated inline.** Despite all tasks having gate evidence in their respective PRs and the status report, the `gate-results.md` file in the sprint folder remained at its template state. Gate evidence was generated but not centralized in the canonical location.

3. **Sprint 5 shared-state.md was not updated during execution.** All 7 tasks remained at OPEN status in shared-state.md even after completion. In a multi-agent environment, this would have caused coordination failures. Single-operator mode masked this issue but it must be addressed for Sprint 6.

---

## Key Learnings

1. **Cross-cutting concerns need dedicated gate checks.** Column naming consistency (migration vs. application code), PII flow through embedding pipelines, and transaction boundaries are not caught by per-route testing. Sprint 6 should add a "cross-cutting consistency check" to the backend task template.

2. **The workflow-as-block pattern creates rich graph connections.** Each workflow instance now generates 3+ edges (instance_of, processing, spawned) and 3+ events (spawned, step.completed, instance.completed). This means the business graph and event timeline become significantly richer once workflows are active. Good for audit trail; watch for query performance.

3. **PR merge backlog is a production deploy blocker.** Sprint 5 started with 11 unmerged PRs. This was correctly identified as Priority 0 and resolved. Sprint 6 must not accumulate a backlog -- PRs should be merged as they complete, not batched.

---

## Blocker Analysis

No blockers were logged during Sprint 5. The PR merge backlog was identified as a pre-condition risk at sprint planning and resolved proactively.

---

## Gate 7 -- Architect Sign-off

```
GATE 7 -- ARCHITECT SIGN-OFF
Sprint: 5 (Phase 2)
Date: 2026-03-09

Tasks audited: 7/7 have gate evidence
  P2-S5-BE-01: G1 PASS, G2 PASS (14 tests), G3 PASS, G5 PASS — PR #13 MERGED
  P2-S5-BE-02: G1 PASS, G2 PASS (23 tests), G3 PASS, G5 PASS — PR #14 MERGED
  P2-S5-BE-03: G1 PASS, G2 PASS (16 tests), G3 PASS, G5 PASS — PR #15 MERGED
  P2-S5-BE-04: G1 PASS, G2 PASS (14 tests), G3 PASS, G5 PASS — PR #16 MERGED
  P2-S5-FE-01: G1 PASS, G4 PASS (375/768/1280/1920), G5 PASS — PR #17 MERGED
  P2-S5-FE-02: G1 PASS, G4 PASS (375/768/1280/1920), G5 PASS — PR #18 MERGED
  P2-S5-QA-01: G1 PASS, G2 PASS (37 tests), G5 PASS — PR #19 MERGED

Missing evidence: gate-results.md file not populated (evidence exists in PRs and status reports)
Outstanding: PR #20 (bug fixes) still OPEN — not a Sprint 5 task but affects Sprint 5 code

Phase 2 exit conditions: NOT MET
  - Custom workflow template by design partner: NOT YET (no design partner onboarded)
  - Signed LOI at >=GBP 500/month: NOT YET
  - Workflow runtime is code-complete but needs integration connectors + webhooks (Sprint 6) and
    condition/branching logic + polish (Sprint 7) before exit evaluation

Build learnings: No new PENDING signals logged during Sprint 5.
  4 bugs found via gap analysis are addressed in PR #20 (not signals — they are defect fixes).

Next sprint: Sprint 6 generated — integration connectors, inbound webhooks, webhook trigger
  evaluation, task routing enhancements, connectors UI.
```

---

## Sprint 6 Scope Decision

Per `phases.md` Sprint 6 guidance: "Integration connectors, inbound webhooks, trigger evaluation engine, task routing UI."

Sprint 5 already delivered the core trigger evaluation engine (manual + event triggers). Sprint 6 will extend triggers to include **webhook triggers** (inbound HTTP from external systems) and add the **integration connector framework** (the `integration_connectors` table and CRUD API). The task routing UI enhancement will add connector management and webhook configuration to the frontend.

Sprint 6 tasks have been generated at `.claude/sprints/phase-2/sprint-6/`.

---

## Recommendation

Sprint 5 was a strong execution sprint. The workflow runtime is the most architecturally significant deliverable since the core schema in Sprint 1. The 4 bugs found by gap analysis are concerning but contained -- they affect pre-Sprint-5 code and are addressed in PR #20. Recommend merging PR #20 before starting Sprint 6 code work.

Phase 2 is on track. Sprint 6 (connectors + webhooks) and Sprint 7 (conditions/branching + AI routing + polish) remain before exit evaluation. The critical path to Phase 2 exit is now: integration infrastructure (Sprint 6) -> composable builder polish + design partner engagement (Sprint 7) -> LOI pursuit.
