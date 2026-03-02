---
paths:
  - "src/pipelines/**"
  - "src/etl/**"
  - "db/**"
  - "src/analytics/**"
  - "migrations/**"
  - "schema/**"
---

# Data Engineering Rules

> Path-scoped — loads when working in data and database files.
> Full standards: `.claude/standards/data-standards.md`

---

## Schema Changes — Migration Files Only
- NEVER make direct schema edits — all changes go through migration files
- Every migration must be reversible (include `up` and `down` methods)
- Test migrations on a copy of the production schema before applying
- Migration files: `db/migrations/YYYYMMDD-HHMMSS-description.sql`
- Never edit an existing migration file — create a new one

## PII Tagging — Always
Every column containing PII must be tagged in schema comments:
```sql
-- @pii: email — GDPR Article 4(1) personal data
user_email VARCHAR(255) NOT NULL,
```
PII classification levels:
- **Level 1 — Direct identifier**: name, email, phone, government ID → encrypt at rest, mask in logs
- **Level 2 — Indirect identifier**: IP address, device ID, location → pseudonymise, retention limits
- **Level 3 — Sensitive**: health, financial, biometric → encrypt + access controls + audit log

## Pipeline Testing Requirements
Every data pipeline must be tested with:
1. **Happy path** — normal input, expected output
2. **Malformed input** — invalid schema, missing required fields, wrong types
3. **Volume test** — pipeline handles 10x expected load without OOM or timeout
4. **Idempotency test** — running the pipeline twice produces the same result

## Data Lineage Documentation
Every pipeline must document in `prd/09-data-pipeline.md`:
- **Source**: where data comes from (system, table, API, event)
- **Transforms**: what changes happen to the data and why
- **Destination**: where it lands (table, file, downstream system)

## Data Contracts
Pipelines that produce data for other systems must define a contract:
- Schema (field names, types, nullable)
- Update frequency
- Retention period
- Contact for schema changes

## Query Performance
- Run `EXPLAIN ANALYZE` on all analytics queries before shipping
- No query should take more than 2 seconds on current dataset size
- Index columns used in `WHERE`, `JOIN ON`, and `ORDER BY` on large tables
- Avoid `SELECT *` — always name the columns you need

## Retention Policies
Every table must have a retention policy tagged in the schema:
```sql
-- @retention: 90 days — delete user events older than 90 days
-- @retention: indefinite — audit logs kept forever
```
Implement automated cleanup for retention policies before going to production.
