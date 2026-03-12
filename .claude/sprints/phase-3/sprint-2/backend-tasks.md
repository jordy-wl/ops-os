# Sprint 2 — Backend Tasks

## P3-S2-BE-01 — Define 5 New System Block Types

**Complexity:** MEDIUM
**Priority:** 1 (start immediately -- on critical path)
**Dependencies:** None
**Applicable Gates:** G1, G2, G5
**Assigned Role:** Backend Engineer
**Estimate:** 2 days

### Description

Add 5 new system block types to the type definitions: Solution, Product, Service, Team Member, and Policy. Each type needs a complete field schema defining its properties, validation rules, and display metadata.

### What to Build

Define field schemas in `src/lib/blocks/system-types.ts` (or equivalent) for each new type:

1. **Solution** -- field_schema: name, description, status (active/draft/archived), category, target_industry, key_features (array), pricing_model
2. **Product** -- field_schema: name, description, version, status, sku, category, unit_price, currency, availability_date
3. **Service** -- field_schema: name, description, service_type, delivery_model (onsite/remote/hybrid), sla_tier, hourly_rate, currency, engagement_type (retainer/project/adhoc)
4. **Team Member** -- field_schema: name, email, role_title, department, reporting_to (block reference), start_date, status (active/on_leave/offboarded), clerk_user_id (optional link)
5. **Policy** -- field_schema: name, description, policy_type (operational/compliance/approval), effective_date, review_date, status (draft/active/under_review/archived), approval_required (boolean), jurisdiction

### Files to Create/Modify

- `src/lib/blocks/system-types.ts` (extend with new type definitions)

### Acceptance Criteria

- [ ] All 5 block types defined with complete field schemas
- [ ] Each field has: name, type, required flag, validation constraints, display label
- [ ] Field schemas are valid JSON Schema compatible structures
- [ ] Type definitions exported and available for use by migration and validation code
- [ ] Unit tests validate each type's field schema structure

---

## P3-S2-BE-02 — Enrich Contact Block Type

**Complexity:** LOW
**Priority:** 1 (independent, start immediately)
**Dependencies:** None
**Applicable Gates:** G1, G2, G5
**Assigned Role:** Backend Engineer
**Estimate:** 1 day

### Description

Add additional fields to the existing Contact block type to support operational workflows. These fields enable SLA tracking, communication preferences, and contact management.

### What to Add

New fields on the Contact block type field_schema:
- `response_time_sla` -- enum: 1h / 4h / 8h / 24h / 48h
- `communication_preference` -- enum: email / phone / slack / teams
- `signature_template` -- text (HTML or markdown signature block)
- `preferred_contact_method` -- enum: email / phone / in_person / video_call
- `timezone` -- string (IANA timezone, e.g. "Australia/Sydney")
- `notes` -- text (free-form notes)

### Files to Modify

- `src/lib/blocks/system-types.ts` (Contact type definition)

### Acceptance Criteria

- [ ] All 6 new fields added to Contact block type field_schema
- [ ] Each field has validation constraints (enum values, max lengths)
- [ ] Existing Contact fields remain unchanged (backward compatible)
- [ ] Unit test validates enriched Contact schema
- [ ] Migration or seed script updates existing Contact type definition in database

---

## P3-S2-BE-03 — Sub-Org Hierarchy Data Model

**Complexity:** MEDIUM
**Priority:** 1 (independent, start immediately)
**Dependencies:** None
**Applicable Gates:** G1, G2, G3, G5
**Assigned Role:** Backend Engineer
**Estimate:** 2 days

### Description

Add hierarchical organization structure support. Organizations can have sub-organizations up to 4 levels deep: org --> suborg --> department --> team. This is the foundation for Sprint 3 RBAC and team management.

### What to Build

1. **Database migration:**
   - Add `parent_org_id` FK column to existing orgs table (nullable, self-referencing)
   - Add `org_level` enum column: `org`, `suborg`, `department`, `team`
   - Add constraint: max depth of 4 levels (enforced via check or trigger)
   - Add index on `parent_org_id` for tree traversal queries
   - RLS policies: users can only see orgs in their hierarchy

2. **Utility functions:**
   - `getOrgHierarchy(orgId)` -- returns tree from root to leaves
   - `getOrgAncestors(orgId)` -- returns path from org to root
   - `validateOrgDepth(parentOrgId)` -- ensures max 4 levels

### Files to Create/Modify

- `supabase/migrations/[timestamp]_sub_org_hierarchy.sql` (new migration)
- `src/lib/orgs/hierarchy.ts` (new utility module)

### Acceptance Criteria

- [ ] Migration adds `parent_org_id` and `org_level` to orgs table
- [ ] Max depth of 4 levels enforced (attempt to create level 5 returns error)
- [ ] `getOrgHierarchy()` returns correct tree structure
- [ ] `getOrgAncestors()` returns correct ancestor chain
- [ ] RLS policies allow users to query only their own org hierarchy
- [ ] Integration test with real Supabase validates hierarchy CRUD

---

## P3-S2-BE-04 — Seed Migration for New Block Types

**Complexity:** LOW
**Priority:** 2 (after BE-01)
**Dependencies:** P3-S2-BE-01
**Applicable Gates:** G1, G2, G5
**Assigned Role:** Backend Engineer
**Estimate:** 0.5 days

### Description

Create an idempotent SQL migration that inserts the 5 new block types (Solution, Product, Service, Team Member, Policy) into the `block_type_definitions` table. Must not fail if types already exist.

### What to Build

SQL migration using `INSERT ... ON CONFLICT DO NOTHING` (or `DO UPDATE` for field_schema changes) to add each new type with:
- `name` (slug): solution, product, service, team_member, policy
- `display_name`: Solution, Product, Service, Team Member, Policy
- `icon`: appropriate Lucide icon name for each
- `color`: distinct hex color for each type
- `field_schema`: full JSON field schema from BE-01
- `is_system`: true

### Files to Create

- `supabase/migrations/[timestamp]_seed_new_block_types.sql`

### Acceptance Criteria

- [ ] Migration inserts all 5 new block types
- [ ] Migration is idempotent (running twice does not error or duplicate)
- [ ] Field schemas match the definitions from BE-01
- [ ] Existing block types are not modified
- [ ] Migration runs successfully against both local and production Supabase

---

## P3-S2-BE-05 — Dynamic Block Type Validation API

**Complexity:** MEDIUM
**Priority:** 3 (after BE-04)
**Dependencies:** P3-S2-BE-04
**Applicable Gates:** G1, G2, G3, G5
**Assigned Role:** Backend Engineer
**Estimate:** 1.5 days

### Description

Refactor `POST /api/blocks` to validate the `type` field dynamically against the `block_type_definitions` table instead of a hardcoded enum. This builds on the groundwork from S1-BE-01 and ensures all new types are automatically recognized.

### What to Build

1. **Block type validation service:**
   - `getValidBlockTypes()` -- queries `block_type_definitions`, returns set of valid type slugs
   - Cache valid types per-request (avoid repeated DB queries in a single request)
   - `validateBlockFields(type, fields)` -- validates field values against the type's field_schema

2. **Refactor POST /api/blocks:**
   - Replace any remaining hardcoded type checks with `getValidBlockTypes()`
   - Add field-level validation: if the block type has a field_schema, validate submitted fields against it
   - Return descriptive 400 error if type is invalid or fields fail validation

3. **Refactor GET /api/blocks:**
   - Include new types in any type-based filtering

### Files to Modify

- `src/app/api/blocks/route.ts`
- `src/lib/blocks/validation.ts` (new or extend existing)

### Acceptance Criteria

- [ ] Block creation with any type in `block_type_definitions` succeeds
- [ ] Block creation with an unknown type returns 400 with descriptive error
- [ ] Field validation runs against the type's field_schema
- [ ] Invalid fields return 400 with field-level error messages
- [ ] All existing block creation flows still work (backward compatible)
- [ ] Integration test: create a block of each new type with valid and invalid fields
