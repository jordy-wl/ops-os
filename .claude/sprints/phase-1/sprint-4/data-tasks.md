# Sprint 4 — Data Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.

---

## P2-S4-DE-01: Seed System Block Types

**Complexity:** LOW | **Est:** 0.5d | **Blocked By:** P2-S4-BE-02
**Applicable Gates:** 1 (Code Quality), 3 (Integration Check), 5 (Security Baseline)

**Description:** Once the `block_type_definitions` table exists (BE-02), seed the 5 canonical system block types that every org gets by default. These are `is_system = true` and cannot be deleted by users.

**System types to seed:**

| type_name | display_name | icon | color | field_schema highlights |
|-----------|-------------|------|-------|------------------------|
| client | Client | building | blue | jurisdiction (select), entity_type (select), incorporation_date (text) |
| deal | Deal | handshake | green | deal_value (number), stage (select), expected_close (text) |
| project | Project | folder | purple | status (select), priority (select), due_date (text) |
| contact | Contact | user | gray | role (text), email (text), phone (text) |
| contract | Contract | file-text | amber | contract_type (select), effective_date (text), expiry_date (text), value (number) |

**Acceptance Criteria:**
- [ ] Seed script creates 5 system block types per org
- [ ] Each type has a valid JSON Schema `field_schema` with appropriate constraints
- [ ] `is_system = true` on all seeded types
- [ ] Idempotent — running seed twice does not create duplicates
- [ ] Tested with a real Supabase request (integration check)

**Files likely modified:**
- `scripts/seed-block-types.ts` (new)
- OR `supabase/migrations/XXXXXX_seed_system_block_types.sql`
