# Sprint 1 — Backend Tasks

## P3-S1-BE-01 — Fix Workflow Creation 400 Error

**Complexity:** LOW
**Priority:** 1 (start immediately)
**Dependencies:** None
**Applicable Gates:** G1, G2, G5
**Assigned Role:** Backend Engineer
**Estimate:** 1 day

### Description

Workflow creation returns a 400 error because the Zod schema requires at least 1 step on creation, but users creating workflows from the canvas start with 0 steps. Additionally, the block type validation in the blocks API uses a hardcoded enum instead of querying the `block_type_definitions` table, which will break as new types are added in Sprint 2.

### What to Change

1. **`src/lib/workflow/template-schema.ts` (line ~48):** Change `steps.min(1)` to `steps.min(0)` to allow empty workflow templates on creation
2. **`src/app/api/blocks/route.ts` (lines ~10-16):** Replace hardcoded `BLOCK_TYPES` enum with a dynamic query to the `block_type_definitions` table. Cache the result for the request lifetime.

### Files to Modify

- `src/lib/workflow/template-schema.ts`
- `src/app/api/blocks/route.ts`

### Acceptance Criteria

- [ ] Workflow creation succeeds with 0 steps (canvas-first flow)
- [ ] Workflow creation still succeeds with 1+ steps (existing flow)
- [ ] Block creation validates type against `block_type_definitions` table, not hardcoded enum
- [ ] Existing block creation for all current types still works
- [ ] Unit tests cover both the 0-step and N-step workflow creation paths
- [ ] Unit test covers dynamic block type validation against the database
