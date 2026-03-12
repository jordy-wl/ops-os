# Sprint 7 — AI/ML Tasks

## P3-S7-AI-01 — Delta Calculation Engine (HIGH)

**Priority:** 1 (foundational -- all other tasks depend on this)
**Deps:** None (Sprints 4+5 complete is external prerequisite)
**Gates:** G1, G2, G3, G5, G6

### What to Build
A delta calculation engine at `src/lib/ai/delta-engine.ts` that takes a block (workflow instance), its associated workflow template definition, and the instance's event history, then computes: current position in the workflow, remaining steps, expected vs actual timeline for each completed step, gap analysis (overdue steps, skipped steps, out-of-order execution), and an overall health score.

### Key Files
- Create: `src/lib/ai/delta-engine.ts` -- core delta calculation: `calculateDelta(block, template, events) => DeltaResult`
- Create: `src/lib/ai/delta-types.ts` -- TypeScript types: DeltaResult, StepDelta, TimelineGap, HealthScore
- Create: `src/lib/ai/__tests__/delta-engine.test.ts` -- unit tests for all calculation paths

### Acceptance Criteria
- [ ] `calculateDelta()` returns: currentStepIndex, completedSteps[], remainingSteps[], timelineDeltas[], gapAnalysis, healthScore (0-100)
- [ ] Timeline delta per step: expected_duration vs actual_duration, variance in hours
- [ ] Gap analysis detects: overdue steps (past expected completion), skipped steps, out-of-order execution
- [ ] Health score formula: 100 - (overdue_penalty + skip_penalty + variance_penalty), clamped to 0-100
- [ ] Handles edge cases: no events yet (fresh instance), completed workflow, single-step workflow
- [ ] Pure function with no side effects -- testable without database

---

## P3-S7-AI-02 — AI Insights Generator (HIGH)

**Priority:** 2 (depends on AI-01 for delta data)
**Deps:** P3-S7-AI-01
**Gates:** G1, G2, G3, G5, G6

### What to Build
Take a DeltaResult plus block context and generate human-readable insights via Claude. Output four sections: "What's done" (completed steps summary), "What's next" (upcoming steps with expected timing), "What's at risk" (overdue, skipped, low health), "Recommendations" (actionable next steps). Cache insights per block, invalidate when new events arrive.

### Key Files
- Create: `src/lib/ai/insights-generator.ts` -- `generateInsights(delta, blockContext) => InsightsResult`
- Create: `src/lib/ai/insights-cache.ts` -- in-memory cache with block_id key, invalidated on new events
- Create: `src/prompts/delta-insights.v1.md` -- prompt template for insight generation
- Create: `src/lib/ai/__tests__/insights-generator.test.ts` -- unit tests with mocked Claude responses

### Acceptance Criteria
- [ ] Returns 4 sections: whatsDone, whatsNext, whatsAtRisk, recommendations (each as string[])
- [ ] Recommendations are actionable (e.g., "Reassign step 3 to reduce delay" not "There is a delay")
- [ ] Cache hit returns stored insights without calling Claude (keyed by block_id + last_event_id)
- [ ] Cache invalidated when a new event is recorded for the block
- [ ] Graceful degradation: if Claude call fails, return delta data as plain text fallback
- [ ] Generation time under 5 seconds for typical workflows (5-15 steps)

---

## P3-S7-AI-03 — Delta-Aware Chat Context (MEDIUM)

**Priority:** 2 (depends on AI-01, can run parallel with AI-02)
**Deps:** P3-S7-AI-01
**Gates:** G1, G2, G3, G5

### What to Build
Enhance the existing chat context assembly to include delta information when the user is viewing a workflow instance block. Chat naturally references "what's next", "what's at risk", and current progress. In Execute mode, the chat can action recommendations from the delta (e.g., reassign a step, extend a deadline).

### Key Files
- Modify: `src/lib/ai/context-assembly.ts` -- include delta result in context when block is a workflow_instance
- Modify: `src/lib/ai/chat-tools.ts` -- add tools for actioning delta recommendations (reassign_step, extend_deadline)
- Create: `src/prompts/delta-chat-context.v1.md` -- system prompt additions for delta-aware conversation

### Acceptance Criteria
- [ ] When chatting on a workflow_instance block, context includes delta summary (health score, current step, risks)
- [ ] Chat can answer "What's the status of this workflow?" using delta data (not just raw events)
- [ ] Execute mode: "Reassign step 3 to Sarah" triggers reassign_step tool
- [ ] Execute mode: "Extend the deadline for document review by 2 days" triggers extend_deadline tool
- [ ] Delta context only included for workflow_instance blocks (not other block types)
