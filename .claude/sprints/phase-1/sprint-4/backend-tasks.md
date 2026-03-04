# Sprint 4 — Backend Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.

---

## P1-S4-BE-01: Sync Org Name from Clerk

**Complexity:** LOW | **Est:** 0.5d | **Blocked By:** none
**Applicable Gates:** 1 (Code Quality), 5 (Security Baseline)

**Description:** Currently `orgs.name` is null after Clerk sign-up. Add logic to populate it from Clerk org metadata. Options: Clerk webhook on org.created, or sync during resolveOrgId() when name is null.

**Acceptance Criteria:**
- [ ] When a user signs in and their org has `name = null`, the org name is populated from Clerk
- [ ] No extra API call if name is already set
- [ ] Works for both new and existing orgs

**Files likely modified:**
- `src/lib/auth/resolve-org.ts` (add name sync logic)
- OR create a Clerk webhook handler at `src/app/api/webhooks/clerk/route.ts`

---

## P2-S4-BE-02: block_type_definitions Table + CRUD API

**Complexity:** HIGH | **Est:** 2d | **Blocked By:** none
**Applicable Gates:** 1, 2, 3, 5

**Description:** Create the `block_type_definitions` table that stores custom block type schemas. Each definition has a `type_name` (unique per org), `field_schema` (JSON Schema for block metadata validation), `icon`, `color`, and lifecycle states. CRUD API at `/api/block-types`.

**Schema (from prd/04-data-models.md):**

```sql
CREATE TABLE block_type_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id),
  type_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  field_schema JSONB NOT NULL DEFAULT '{}',
  icon TEXT DEFAULT 'box',
  color TEXT DEFAULT 'gray',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, type_name)
);
```

**API endpoints:**
- `GET /api/block-types` — list all for org
- `POST /api/block-types` — create (ops-admin only)
- `PATCH /api/block-types/[id]` — update (ops-admin only)
- `DELETE /api/block-types/[id]` — delete (ops-admin only, not if blocks exist of this type)

**Acceptance Criteria:**
- [ ] Migration creates table with RLS (org_id scoping)
- [ ] CRUD API with auth + role checks
- [ ] field_schema validated as valid JSON Schema on create/update
- [ ] Cannot delete a type if blocks of that type exist
- [ ] Unit tests for all 4 endpoints

---

## P2-S4-BE-03: Workflow Template Block Schema + CRUD API

**Complexity:** HIGH | **Est:** 2d | **Blocked By:** P2-S4-BE-02
**Applicable Gates:** 1, 2, 3, 5

**Description:** Workflow definitions stored as Blocks with type `workflow_template`. The block's metadata contains the full workflow definition: triggers, steps (ordered), conditions, and edge references. CRUD API for creating and managing workflow templates.

**Template metadata shape:**
```json
{
  "applies_to_type": "client",
  "trigger": { "type": "manual" | "event", "event_pattern": "block.created" },
  "steps": [
    { "name": "request_documents", "type": "emit_event", "event_type": "document.requested" },
    { "name": "kyc_check", "type": "emit_event", "event_type": "kyc.check.started" }
  ]
}
```

**Acceptance Criteria:**
- [ ] Workflow template Blocks created with type `workflow_template`
- [ ] API validates template metadata shape on create/update
- [ ] List templates filtered by `applies_to_type`
- [ ] Unit tests for template CRUD
