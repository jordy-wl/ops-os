# Sprint 4 — Gate Results

> Phase 3, Sprint 4: Routing Engine & Policy System

---

## P3-S4-BE-01 — Policy block schema & routing config

**GATE 1 — CODE QUALITY**
Linter: `npx next lint` — zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 2 — TESTING**
Coverage: 6 tests in `src/lib/routing/__tests__/policy.test.ts`
Test run: 6 passed, 0 failed
Edge cases: step-level policy, workflow fallback, org default, no policies, inactive skip, missing metadata

**GATE 3 — INTEGRATION CHECK**
Happy path: resolvePolicy returns correct config from step-level policy block
Error case 1: no active policies → returns DEFAULT_ROUTING
Error case 2: inactive policy skipped → falls back to org default
Contract match: YES

**GATE 5 — SECURITY BASELINE**
Input validation: policy IDs validated via Supabase query (not user input)
Auth check: resolvePolicy called from server-side only
PII in logs: N/A (no logging in policy module)
Dependency scan: no new dependencies

**Summary:** Created routing type system (`src/lib/routing/types.ts`) with RoutingMode, RiskLevel, PolicyRoutingConfig, RoutingInput, RoutingDecision. Created policy resolution (`src/lib/routing/policy.ts`) with step > workflow > org priority. Updated Policy block type in system-types.ts with routing-specific fields. Migration `20260312000004_policy_routing_schema.sql` applied.

---

## P3-S4-BE-02 — Routing decision engine

**GATE 1 — CODE QUALITY**
Linter: zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 2 — TESTING**
Coverage: 18 tests in `src/lib/routing/__tests__/engine.test.ts`
Test run: 18 passed, 0 failed
Edge cases: step overrides (4), no policy fallback (1), risk-based (4), confidence threshold (2), policy modes (2), permissions (2), edge cases (3)

**GATE 3 — INTEGRATION CHECK**
Happy path: makeRoutingDecision returns correct route for hybrid mode + high confidence
Error case 1: no policy → human fallback
Error case 2: below-threshold confidence → human route
Contract match: YES

**GATE 5 — SECURITY BASELINE**
Input validation: confidence scores validated in range
Auth check: N/A (pure function, called from server-side engine)
PII in logs: N/A
Dependency scan: no new dependencies

**Summary:** Created `src/lib/routing/engine.ts` with 6-level decision priority: step override → no policy → risk map → confidence threshold → escalation chain → human_only fallback. All 18 test cases cover every routing path.

---

## P3-S4-BE-03 — Enrich workflow template schema for routing

**GATE 1 — CODE QUALITY**
Linter: zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 2 — TESTING**
Coverage: existing template-schema tests still pass + 3 new canvas round-trip tests
Test run: all passed
Edge cases: policy_default excluded from serialization, empty permissions array omitted

**GATE 5 — SECURITY BASELINE**
Input validation: Zod schema validates routing_mode enum, permissions array
Auth check: N/A (schema definition)

**Summary:** Added 3 optional fields to StepSchema in template-schema.ts: `routing_mode` (5-value enum), `instructions` (max 5000 chars), `required_permissions` (RBAC permission array). Schema is backward-compatible — all fields optional.

---

## P3-S4-BE-04 — Enhanced task card data model

**GATE 1 — CODE QUALITY**
Linter: zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 2 — TESTING**
Coverage: existing task API tests pass + enrichment covered in integration tests
Test run: all passed

**GATE 3 — INTEGRATION CHECK**
Happy path: PATCH /api/tasks/[id] accepts decision + actual_output
Error case 1: 400 on invalid decision enum
Error case 2: 404 on non-existent task ID
Contract match: YES

**GATE 5 — SECURITY BASELINE**
Input validation: Zod validation on PATCH body (decision enum + output object)
Auth check: withAuth middleware on all task endpoints
PII in logs: N/A

**Summary:** Enriched task_queue_item block type with 9 new metadata fields (ai_recommendation, confidence_score, routing_decision, routing_reason, input_data, expected_output_schema, actual_output, completed_by, decision). Created PATCH /api/tasks/[id] for decision submission. Created task-enrichment.ts utility. Migration `20260312000005_enhanced_task_cards.sql`.

---

## P3-S4-AI-01 — Confidence scoring for routing decisions

**GATE 1 — CODE QUALITY**
Linter: zero errors
TODOs scan: none found
Secrets scan: none found (API key via env var ANTHROPIC_API_KEY)

**GATE 2 — TESTING**
Coverage: 8 tests in `src/lib/ai/__tests__/confidence-scoring.test.ts`
Test run: 8 passed, 0 failed
Edge cases: clamped scores, API failure (0 fallback), unparseable response, markdown code blocks, caching, missing factors, output schema inclusion

**GATE 3 — INTEGRATION CHECK**
Happy path: evaluateConfidence returns parsed score + factors from Claude
Error case 1: API rate limited → returns score 0
Error case 2: non-JSON response → returns score 0
Contract match: YES

**GATE 5 — SECURITY BASELINE**
Input validation: scores clamped 0-1, JSON parsed safely
Auth check: N/A (server-side only, no user input)
PII in logs: N/A (only logs service/event fields)
Dependency scan: uses existing @anthropic-ai/sdk

**Summary:** Created `src/lib/ai/confidence-scoring.ts` with evaluateConfidence() using Claude claude-sonnet-4-6. Prompt versioned at `src/prompts/confidence-evaluation.v1.md`. In-memory cache (1hr TTL) prevents redundant API calls. Safe fallback: score 0 on any failure → routes to human.

---

## P3-S4-FE-01 — Routing config in workflow builder

**GATE 1 — CODE QUALITY**
Linter: zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 4 — FRONTEND QUALITY**
375px: PASS (config panel scrolls, fields wrap)
768px: PASS
1280px: PASS
1920px: PASS
States: loading [N/A] empty [N/A] error [N/A] (config panel, not standalone page)
Accessibility: label elements for all inputs, checkbox groups with labels

**GATE 5 — SECURITY BASELINE**
Input validation: Zod schema validates routing_mode enum + permissions array
Auth check: N/A (client-side config, validated on save via API)

**Summary:** Added routing config section to node-config-panel.tsx ActionConfig: routing mode dropdown (5 options), SOP textarea (5000 char limit), required permissions checkboxes (10 RBAC permissions). Updated canvas-layout.ts stepToConfig/configToStep for routing field round-trip. Added routing indicator badges to action-node.tsx (routing mode label, SOP icon, permission shield).

---

## P3-S4-FE-02 — Enhanced task card UI

**GATE 1 — CODE QUALITY**
Linter: zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 4 — FRONTEND QUALITY**
375px: PASS (cards stack, badges wrap, actions collapse)
768px: PASS
1280px: PASS
1920px: PASS
States: loading [inherited] empty [✓ — "No tasks yet"] error [✓ — red banner]
Accessibility: button titles, aria-labels on expand/collapse, role="alert" on errors

**GATE 5 — SECURITY BASELINE**
Input validation: decision enum validated server-side via Zod
Auth check: PATCH endpoint uses withAuth

**Summary:** Redesigned task-list-client.tsx with: routing indicator badges (Human/AI Agent/Approval Chain), confidence score badges (color-coded 0-100%), AI decision buttons (Approve/Reject/Edit), expandable detail section (routing reason, SOP instructions, AI recommendation JSON), decision status display. Extended TaskItem interface with 6 new fields from metadata. Dark mode compatible.

---

## P3-S4-QA-01 — Routing engine tests

**GATE 1 — CODE QUALITY**
Linter: zero errors
TODOs scan: none found
Secrets scan: none found

**GATE 2 — TESTING**
Coverage: 22 new tests across 2 files
- `src/lib/routing/__tests__/routing-integration.test.ts`: 19 tests (5 integration pipeline, 4 extractRoutingConfig, 4 buildTaskEnrichment, 6 decision matrix)
- `src/lib/workflow/__tests__/canvas-layout.test.ts`: 3 new routing round-trip tests
Test run: 760 total passed, 0 failed (up from 738)
Edge cases: null metadata, partial config, empty enrichment, policy_default exclusion, empty permissions

**GATE 5 — SECURITY BASELINE**
Input validation: N/A (test code)
Auth check: N/A
PII in logs: N/A

**Summary:** Comprehensive integration tests covering the full routing pipeline: policy resolution → routing decision → task enrichment → canvas serialization round-trip. 6-case decision matrix tests risk × confidence × routing mode. All 760 tests passing across 53 test files. Build clean.
