# Sprint 13 — Backend Engineer Tasks

## P2-S13-BE-01 — `update_block` Step Type (HIGH)

**Priority:** 1 (critical path — blocks FE-01 and QA-01)
**Estimated effort:** 3–4 days

### What to Build
Add `update_block` as a workflow step type. The handler resolves a target block, validates field updates against the block type's field_schema, applies a PATCH to metadata, and emits a `block.updated` event.

### Files to Modify
- `src/lib/workflow/template-schema.ts` — add `'update_block'` to step type enum (line 28)
- `src/lib/workflow/step-engine.ts` — add `case 'update_block'` in executeStep switch
- `src/lib/workflow/canvas-layout.ts` — add to stepTypeToNodeType, stepToLabel, stepToConfig, configToStep

### Files to Create
- `src/lib/workflow/step-handlers/update-block.ts` — handler implementation

### Implementation Details

**Step config schema:**
```typescript
{
  step_type: 'update_block',
  block_id: string,          // literal UUID, '{{context.source_block_id}}', or '{{block.relation_field}}'
  fields: Record<string, unknown>,  // field_name → value pairs to merge into metadata
}
```

**Handler logic:**
1. Resolve `block_id`:
   - If literal UUID → use directly
   - If `{{context.source_block_id}}` → get from workflow instance metadata
   - If `{{block.<field>}}` → fetch source block, read relation field value
2. Fetch target block → verify `org_id` matches
3. If block type has `field_schema`: validate each field name exists in schema
4. Merge `fields` into `block.metadata` (shallow merge, not deep)
5. UPDATE blocks SET metadata = merged, updated_at = now()
6. Emit `block.updated` event: `{ block_id, actor_type: 'workflow', actor_id: instance_id, metadata: { updated_fields: Object.keys(fields) } }`
7. Return step result: `{ block_id, updated_fields: Object.keys(fields) }`

**Security:**
- Template expression whitelist: only `{{context.*}}` and `{{block.*}}`
- Field names validated against field_schema if present
- org_id enforced on target block lookup
- `actor_type: 'workflow'` in event (not 'user') for audit trail

### Gates
G1 (Code Quality), G2 (Testing), G3 (Integration Check), G5 (Security), G6 (Peer Review — HIGH)

---

## P2-S13-BE-02 — Remove Hardcoded Onboarding (MED)

**Priority:** 2 (independent, can run parallel)
**Estimated effort:** 1 day

### What to Build
Remove all hardcoded onboarding code. Onboarding is now a user-created workflow template.

### Files to Delete
- `src/lib/actions/handlers/onboarding-start.ts`
- `src/lib/workflow/handlers/onboarding.ts`
- `src/components/blocks/start-onboarding-button.tsx`

### Files to Modify
- `src/lib/actions/registry.ts` — remove `'onboarding.start': onboardingStartHandler` + import
- `src/lib/workflow/registry.ts` — remove `onboarding: onboardingHandler` + import
- `src/app/(app)/blocks/[id]/page.tsx` — remove StartOnboardingButton import (line 10) + usage (lines 159-166)

### Pre-Deletion Checklist
- [ ] Search for all imports: `grep -r "onboarding" src/` — update/remove each reference
- [ ] Check test files: `grep -r "onboarding" tests/ src/**/__tests__/` — update/remove test cases
- [ ] If Supabase connected: `SELECT count(*) FROM workflow_jobs WHERE type = 'onboarding'` — verify no active jobs
- [ ] Verify `npm run build` succeeds after deletions

### Gates
G1 (Code Quality), G2 (Testing), G5 (Security)
