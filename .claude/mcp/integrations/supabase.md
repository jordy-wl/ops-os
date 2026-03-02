# Supabase MCP Integration Guide

**Status:** See `mcp/server-registry.md`
**What it enables:** Run database migrations, query data, manage auth config, and monitor database health directly from agent workflows

---

## Primary Use Case

Backend and Data agents interact with Supabase (or equivalent managed Postgres) without leaving Claude Code. Primarily used for: running migrations during sprint task completion, seeding test data, and verifying schema state during Gate 3 integration checks.

**If your project uses a different database:** The patterns here apply to any managed Postgres service. Adjust connection details and CLI commands accordingly.

---

## What This Integration Enables

| Action | Who Uses It | When |
|--------|------------|------|
| Run database migration | Backend / Data | After migration file is written and reviewed |
| Check migration status | Backend / Orchestrator | During Gate 3 evidence collection |
| Seed test data | QA / Backend | Before integration test runs |
| Query row count / spot check | QA | During Gate 3 verification |
| Check auth configuration | Backend | During auth feature sprint tasks |
| Monitor database health | DevOps | On-call / health check |
| List tables and schema | Backend / Data | During `/next-task` session start |

---

## Migration Workflow

All migrations are managed as files in `db/migrations/` — never via Supabase dashboard SQL editor.

```
1. Write migration file: db/migrations/[timestamp]_[description].sql

2. Review migration file (Gate 1: linted, reversible where possible)

3. Apply to staging:
   /mcp-connect supabase run-migration
     file: db/migrations/[timestamp]_[description].sql
     environment: staging

4. Verify schema state:
   /mcp-connect supabase query
     sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
     environment: staging

5. Run integration tests against staging

6. Apply to production (only after staging pass + Gate 6 sign-off):
   /mcp-connect supabase run-migration
     file: db/migrations/[timestamp]_[description].sql
     environment: production

7. Log migration ID in gate-results.md
```

---

## Seed Data Workflow

```
/mcp-connect supabase seed
  file: tests/fixtures/[fixture-name].sql
  environment: staging

# Verify seed:
/mcp-connect supabase query
  sql: "SELECT COUNT(*) FROM [table]"
  environment: staging
```

**Seed data rules:**
- Fixtures must use generated fake data — never real user data
- Seed scripts must be idempotent (safe to run multiple times)
- Never seed to production

---

## Gate Evidence

Migration verification counts as Gate 3 (Integration Check) evidence:
```
GATE 3 — INTEGRATION CHECK
Migration: [timestamp]_[description].sql applied to staging
Schema check: [table] exists with expected columns
Row count post-seed: [N] rows
Auth config: [relevant check]
```

---

## Auth Configuration

Manage auth providers and settings via MCP — not via Supabase dashboard:
```
/mcp-connect supabase update-auth-config
  key: [config-key]
  value: [value]
  environment: staging
```

JWT secret and service role key must never appear in any file — read from secrets manager at runtime.

---

## Data Standards Compliance

When using this integration, apply data standards from `.claude/standards/data-standards.md`:
- All schema changes via migration files (never direct DDL in console)
- PII classification in column comments (`-- PII: email address`)
- Migrations are numbered sequentially and append-only
- Rollback migration file required for every forward migration that alters existing columns

---

## Setting Up

1. Create a Supabase project (or equivalent managed Postgres)
2. Generate a service role key: Project Settings → API
3. Note project URL and anon key (for client) + service role key (for server/MCP)
4. Configure MCP server with project URL and service role key
5. Test: `/mcp-connect supabase query sql:"SELECT version()"`
6. Mark active in `server-registry.md`

---

## Caution

Do not:
- Run raw DDL via the Supabase SQL editor — always use migration files
- Use the service role key in frontend code — it bypasses Row Level Security
- Query production database with untested SQL — test on staging first
- Store the service role key in `.env` files committed to git

---

## `.mcp.json` Configuration

Add this block to `.mcp.json` at the project root (already present as a template):

```json
"supabase": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "${SUPABASE_ACCESS_TOKEN}"]
}
```

**Required env var:** `SUPABASE_ACCESS_TOKEN` — from Supabase Dashboard → Account → Access Tokens (not the project service role key — this is a personal access token for the MCP server).

**To activate:**
1. Set `SUPABASE_ACCESS_TOKEN` in your shell profile
2. Add `"supabase"` to `enabledMcpjsonServers` in `.claude/settings.json`
3. Update registry status to `active`
