# Sprint 4 — QA Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.

---

## P2-S4-QA-01: Block Type Definitions — Unit + Contract Tests

**Complexity:** MEDIUM | **Est:** 1d | **Blocked By:** P2-S4-BE-02
**Applicable Gates:** 1 (Code Quality), 2 (Testing), 5 (Security Baseline)

**Description:** Write unit and contract tests for the block_type_definitions CRUD API. Cover all 4 endpoints, auth checks, validation edge cases, and the "cannot delete if blocks exist" guard.

**Test cases (minimum):**

### Unit Tests (mocked Supabase)
- [ ] GET /api/block-types — returns types for authed org only
- [ ] POST /api/block-types — creates with valid field_schema
- [ ] POST /api/block-types — rejects invalid JSON Schema
- [ ] POST /api/block-types — rejects duplicate type_name for same org
- [ ] PATCH /api/block-types/[id] — updates display_name and field_schema
- [ ] DELETE /api/block-types/[id] — succeeds when no blocks of type exist
- [ ] DELETE /api/block-types/[id] — returns 409 when blocks of type exist
- [ ] All endpoints — returns 401 for unauthenticated requests
- [ ] POST/PATCH/DELETE — returns 403 for non-admin roles

### Contract Tests (real Supabase, skip guard)
- [ ] Round-trip: create → list → update → delete
- [ ] Verify RLS: org A cannot see org B's types

**Files likely modified:**
- `tests/api/block-types.test.ts` (new)
- `tests/contract/block-types.contract.test.ts` (new, optional)
