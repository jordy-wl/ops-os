# Sprint 13 — QA Engineer Tasks

## P2-S13-QA-01 — Workflow System Tests (MED)

**Priority:** 3 (depends on BE-01 + FE-01)
**Estimated effort:** 2 days

### What to Build
Unit tests for update_block handler. Canvas layout conversion tests for new node type. Verify onboarding removal is clean.

### Files to Create
- `src/lib/workflow/step-handlers/__tests__/update-block.test.ts` — handler unit tests
- `src/lib/workflow/__tests__/canvas-layout-update-block.test.ts` — canvas conversion tests

### Test Cases

**update_block handler (unit):**
- Resolves literal block_id → fetches correct block
- Resolves `{{context.source_block_id}}` → uses instance source block
- Resolves `{{block.relation_field}}` → follows relation to target
- Validates field names against field_schema → rejects unknown field
- Applies PATCH → metadata merged correctly (shallow merge)
- Emits `block.updated` event with `actor_type: 'workflow'`
- Rejects cross-org block (different org_id) → step fails
- Rejects invalid template expression prefix → step fails
- Handles missing target block (deleted) → step fails with descriptive error
- Returns step result with updated_fields list

**Canvas layout conversion:**
- `stepTypeToNodeType('update_block')` returns `'action'`
- `stepToLabel({ type: 'update_block' })` returns "Update Block"
- `stepToConfig()` extracts block_id and fields from update_block step
- `configToStep()` reconstructs update_block step from canvas node data
- Round-trip: steps → canvas → steps preserves update_block config exactly

**Onboarding removal verification:**
- No file in `src/` imports from deleted onboarding files
- `REGISTRY` in actions/registry.ts has no 'onboarding.start' key
- `WORKFLOW_REGISTRY` in workflow/registry.ts has no 'onboarding' key
- Build succeeds with no dead import errors

### Gates
G1 (Code Quality), G2 (Testing), G5 (Security)
