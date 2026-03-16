# Sprint 4 — QA Tasks

## P3-S4-QA-01 — Routing Engine Tests

**Complexity:** HIGH
**Priority:** 5 (after BE-02, FE-01, FE-02)
**Dependencies:** P3-S4-BE-02, P3-S4-FE-01, P3-S4-FE-02
**Applicable Gates:** G1, G2, G5, G6
**Assigned Role:** QA Engineer
**Estimate:** 3 days

### Description

Comprehensive testing of the routing decision engine, policy resolution, confidence scoring, enhanced task cards, and routing configuration UI.

### Test Plan

1. **Regression baseline:**
   - All existing tests pass (0 regressions)
   - Build clean, lint clean

2. **Routing decision engine tests (unit -- critical):**
   - Step-level routing_mode override takes priority over policy
   - Policy risk_routing_map correctly routes by risk level:
     - low risk + high confidence --> agent
     - medium risk + medium confidence --> hybrid
     - high risk + any confidence --> human_only
   - Confidence threshold boundary tests:
     - Score exactly at threshold --> routes to agent
     - Score 0.01 below threshold --> routes to human
   - Escalation chain builds correct approval order
   - No policy found --> falls back to human_only
   - Missing confidence score --> routes to human

3. **Policy resolution tests (unit):**
   - Step-level policy found --> returns step policy
   - No step policy, workflow policy found --> returns workflow policy
   - No step or workflow policy, org default found --> returns org default
   - No policy at any level --> returns null (triggers fallback)

4. **Confidence scoring tests (unit + integration):**
   - Clear instructions + complete data --> high score (>= 0.8)
   - Vague instructions + incomplete data --> low score (<= 0.4)
   - AI evaluation failure --> returns 0.0
   - Caching: same inputs return cached result
   - Token usage tracked

5. **Enhanced task card tests (integration):**
   - Task creation populates input_data, routing_decision, routing_reason
   - GET /api/tasks returns enriched fields
   - PATCH /api/tasks/[id] with decision and actual_output
   - Filter by routing_decision works
   - Legacy tasks (without new fields) still render

6. **Workflow template schema tests:**
   - Step with routing_mode, instructions, required_permissions validates
   - Step with invalid routing_mode rejected
   - Step with invalid permission slugs rejected
   - Existing templates without routing fields still validate

7. **Frontend tests:**
   - Routing mode selector in node config saves correctly
   - Task card renders AI recommendation when present
   - Task card renders gracefully without AI data
   - Confidence badge shows correct color for score ranges
   - Approve/Reject/Edit buttons call correct API endpoints

### Files to Create

- `tests/routing/decision-engine.test.ts`
- `tests/routing/policy-resolution.test.ts`
- `tests/ai/confidence-scoring.test.ts`
- `tests/tasks/enhanced-task-cards.test.ts`
- `tests/workflow/routing-template-schema.test.ts`
- `tests/components/task-card.test.tsx`
- `tests/components/routing-config.test.tsx`

### Acceptance Criteria

- [ ] All existing tests pass (0 regressions)
- [ ] Routing decision engine: at least 10 test cases covering all paths
- [ ] Policy resolution: priority chain tested (step > workflow > org > fallback)
- [ ] Confidence scoring: boundary tests, failure fallback, caching
- [ ] Enhanced task CRUD: enriched fields, filtering, decision recording
- [ ] Template schema: routing fields validated, backward compat confirmed
- [ ] Frontend: task card rendering, action buttons, routing config persistence
- [ ] Build and lint clean
