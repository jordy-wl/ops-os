# Data Engineering Standards — Reference

> **Reading guide:** At session start, skim section headers only — do not read in full.
> Full file: load only when actively implementing a task that requires these standards.
> Auto-load: `/focus-context [task-id]` reads this file when your task's role or gate requires it.
> Skipping at session start saves significant context tokens.

Stack placeholders: `[DATABASE]`, `[PIPELINE_TOOL]`, `[ANALYTICS_STORE]`
Confirmed stack recorded in `prd/03-system-architecture.md`.

---

## Schema Evolution Rules

### Additive Changes (safe, no migration required for live systems)
- Adding a nullable column
- Adding a new table
- Adding an index (non-blocking in most databases)
- Adding an enum value

### Breaking Changes (require versioned migration with rollback)
- Dropping a column
- Renaming a column or table
- Changing a column type
- Adding a NOT NULL constraint to an existing column
- Removing an enum value

---

## Migration File Rules

**Non-negotiable:**
- NEVER edit an existing migration file — create a new one to correct it
- Every migration has both `up` (apply) and `down` (rollback) operations
- Test rollback (`down`) before marking a task as DONE
- Test migration on a copy of the production schema before applying to staging

### Naming Convention
```
db/migrations/YYYYMMDD-HHMMSS-short-description-of-change.sql
```
Examples:
```
20240101-120000-create-users-table.sql
20240115-093000-add-verified-at-to-users.sql
20240120-140500-create-posts-table.sql
```

### Migration File Template
```sql
-- Migration: 20240101-120000-create-users-table
-- Author: DATA-ENGINEER
-- Description: Create the users table with core identity fields
-- Reversible: YES

-- ==== UP ====
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- @pii: level-1 | gdpr: article 4(1) | handling: never log, encrypt at rest
  email       VARCHAR(255) NOT NULL UNIQUE,
  -- @pii: level-1 | gdpr: article 4(1) | handling: never log
  name        VARCHAR(255) NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- @retention: indefinite | reason: audit trail
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ==== DOWN ====
DROP TABLE IF EXISTS users;
```

---

## PII Classification and Handling

Every column containing PII must be tagged in a schema comment before the column definition.

### Classification Levels

**Level 1 — Direct Identifier**
Uniquely identifies a person: name, email, phone, national ID, passport, SSN
```sql
-- @pii: level-1 | gdpr: article 4(1) | handling: encrypt at rest, mask in all logs and exports
```
Handling: encrypt at rest, never log, never export unmasked, delete on user request

**Level 2 — Indirect Identifier**
Can identify a person in combination: IP address, device ID, precise location, user agent
```sql
-- @pii: level-2 | handling: pseudonymise, enforce 90-day retention limit
```
Handling: pseudonymise before analytics, enforce retention, right to erasure applies

**Level 3 — Sensitive Data**
Health, financial, biometric, political/religious beliefs
```sql
-- @pii: level-3 | handling: encrypt + access control + full audit log required
```
Handling: all Level 1 handling PLUS: access control list, every read logged in audit table

---

## Pipeline Testing Requirements

Every data pipeline must be tested before production with all four scenarios:

### 1. Happy Path
```
Input:  [N] records, valid schema, expected data types
Process: pipeline runs to completion
Output: [expected record count], [expected schema], [expected aggregate values]
Assert: zero records dropped, zero schema violations in output
```

### 2. Malformed Input
```
Input:  records with invalid schema (missing required fields, wrong types, null primary keys)
Process: pipeline handles errors gracefully
Output: malformed records routed to dead-letter queue / error log
Assert: pipeline does not crash, valid records still processed
```

### 3. Idempotency
```
Input:  same batch run twice with same data
Output: same result both times (no duplicates, same aggregates)
Assert: idempotent — safe to re-run on failure
```

### 4. Volume Test
```
Input:  10× expected production record count
Process: pipeline runs to completion within acceptable time window
Assert: no OOM errors, no timeouts, performance within spec
```

---

## Data Lineage Documentation

Every pipeline must document in `prd/09-data-pipeline.md`:

```markdown
## Pipeline: [Pipeline Name]

**Source:**
- System: [database / API / event stream / file]
- Table/Endpoint: [name]
- Schema: [link to schema definition]
- Update frequency: [real-time / every N minutes / daily]

**Transforms:**
- [Step 1]: [what changes and why]
- [Step 2]: [what changes and why]

**Destination:**
- System: [database / data warehouse / downstream service]
- Table: [name]
- Schema: [link to schema definition]

**PII in transit:** [YES — describe handling / NO]
**Failure behaviour:** [what happens when pipeline fails — retry, dead letter, alert]
**Lineage owner:** DATA-ENGINEER
```

---

## Data Contracts

Pipelines that produce data consumed by other services must publish a contract:

```markdown
## Data Contract: [Dataset Name]

**Producer:** [service or pipeline]
**Consumer(s):** [analytics service, ML pipeline, etc.]

**Schema:**
| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| id | UUID | NO | Primary identifier |
| created_at | TIMESTAMPTZ | NO | Record creation time |

**Update frequency:** [real-time / batch every N minutes / daily at HH:MM UTC]
**Retention:** [N days / indefinite]
**Contact for schema changes:** DATA-ENGINEER via shared-state.md signal
**Breaking change policy:** 30-day notice, versioned migration, parallel run period
```

---

## Query Performance Requirements

| Query type | Target | Action if exceeded |
|------------|--------|-------------------|
| OLTP (API endpoints) | < 100ms p95 | Index, optimise, or denormalise |
| Analytics (dashboards) | < 2s p95 | Move to analytics store, materialise views |
| Reports (batch) | < 5 minutes | Async job + notify on completion |

Run `EXPLAIN ANALYZE` on all queries joining 3+ tables. Paste output in `gate-results.md` as Gate 3 evidence.

---

## Retention Policies

Every table must have a retention comment before going to production:
```sql
-- @retention: 90 days | reason: user events, GDPR recital 26 proportionality
-- @retention: 7 years | reason: financial records, tax compliance requirement
-- @retention: indefinite | reason: audit log, contractual obligation
```
Implement automated cleanup jobs before production. Document cleanup schedule in `prd/10-security-compliance.md`.
