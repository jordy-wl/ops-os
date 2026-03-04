# Sprint 3 — Backend Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.
> Claim a task by updating its status to IN_PROGRESS in `shared-state.md` before starting.

---

## Your Tasks This Sprint

| Task ID | Title | Status | Complexity | Est. Days | Blocked By |
|---------|-------|--------|-----------|-----------|-----------|
| P1-S3-BE-01 | Cron Config + Engine Hardening | OPEN | LOW | 1 | none |

**Day-1 recommendation:** Claim and complete BE-01 on Day 1. It's 3 targeted changes: vercel.json, one-line secret guard inversion, and error-check additions in markDone/markFailed. This unblocks DE-01 (partner onboarding) and QA-01.

---

## P1-S3-BE-01: Production Cron Config + Engine Hardening

**Description:** Three targeted changes to wire the workflow engine to Vercel's cron and fix the two Gate 6 non-blocking findings from P1-S2-BE-01 peer review. Without the cron, workflow jobs stay "pending" in production forever and the design partner walkthrough fails.

---

### Change 1 — vercel.json Cron Config

Create `vercel.json` in the project root with a 1-minute cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/workflow-engine/process",
      "schedule": "* * * * *"
    }
  ]
}
```

**Note:** Vercel's minimum cron interval is 1 minute. The current engine uses a dev polling loop in `src/instrumentation.ts` — in production, Vercel cron replaces this. Both can coexist safely (the dev loop is only active in `process.env.NODE_ENV !== 'production'`; verify this is true in the current instrumentation.ts before committing).

---

### Change 2 — Fail-Closed Secret Guard

**File:** `src/app/api/workflow-engine/process/route.ts`

**Current (fail-open — Gate 6 finding):**
```typescript
// line ~20
const secret = process.env.WORKFLOW_ENGINE_SECRET
if (secret) {
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
// If secret is undefined → all callers accepted
```

**Fix (fail-closed):**
```typescript
const secret = process.env.WORKFLOW_ENGINE_SECRET
const provided = req.headers.get('authorization')
if (!secret || provided !== `Bearer ${secret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**Note on Vercel cron:** Vercel sends cron requests with a `Authorization: Bearer {CRON_SECRET}` header where `CRON_SECRET` is a Vercel-managed secret. The `WORKFLOW_ENGINE_SECRET` env var must be set in Vercel's environment to the same value as `CRON_SECRET` (or set `WORKFLOW_ENGINE_SECRET=$CRON_SECRET` in Vercel env config). Document this in `.env.example`.

---

### Change 3 — markDone / markFailed Error Handling

**File:** `src/lib/workflow/engine.ts` — `markDone` and `markFailed` functions (lines ~112-136)

**Current issue (Gate 6 finding):** Neither function checks the Supabase `.update().eq()` return value. If Supabase returns a DB error, the function continues executing — logging success, emitting events — while the job row stays `running` (never retried by the RPC which only picks up `pending` jobs).

**Fix pattern:**
```typescript
async function markDone(supabase: SupabaseClient, jobId: string, orgId: string): Promise<void> {
  const { error: updateError } = await supabase
    .from('workflow_jobs')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', jobId)

  if (updateError) {
    logger.error('workflow-engine', 'engine.db_update_failed', {
      job_id: jobId,
      org_id: orgId,
      operation: 'markDone',
      error_code: updateError.code,
    })
    return  // Do NOT emit workflow.completed — job state is unknown
  }

  // ... rest of existing markDone logic (emit workflow.completed event)
}
```

Apply the same pattern to `markFailed`.

---

### .env.example Update

Add entry:
```
WORKFLOW_ENGINE_SECRET=your-cron-secret-here
# Used to authenticate Vercel cron requests to /api/workflow-engine/process.
# In Vercel: set this to the same value as your Vercel CRON_SECRET.
# Must be set — without it, the endpoint rejects all callers (fail-closed).
```

---

**Acceptance Criteria:**
- [ ] `vercel.json` created at project root with cron schedule for `/api/workflow-engine/process` at `* * * * *`
- [ ] `WORKFLOW_ENGINE_SECRET` documented in `.env.example` with description
- [ ] Secret guard in route.ts is fail-closed: absent env var → 401 for all callers
- [ ] `markDone` checks Supabase update return value; logs error and returns without emitting event on DB error
- [ ] `markFailed` checks Supabase update return value; logs error and returns without emitting event on DB error
- [ ] Unit tests updated: test absent WORKFLOW_ENGINE_SECRET → 401; test markDone DB error → no event emitted
- [ ] All 17 existing engine unit tests still pass
- [ ] Lint zero errors

**Applicable Gates:** 1, 2, 5
**Owner once claimed:** BACKEND-ENGINEER

---

## Files You Will Touch

| File | Change |
|------|--------|
| `vercel.json` | NEW — cron config |
| `.env.example` | ADD — WORKFLOW_ENGINE_SECRET entry |
| `src/app/api/workflow-engine/process/route.ts` | EDIT — fail-closed secret guard |
| `src/lib/workflow/engine.ts` | EDIT — markDone + markFailed error handling |
| `src/lib/workflow/__tests__/engine.test.ts` (or similar) | EDIT — 2 new test cases |

---

## Standards Reminder

- No new npm dependencies
- No `console.log` — use `logger` from `@/lib/logger`
- Run `npm run lint` before marking DONE
- Run `npx vitest run src/lib/workflow` to verify engine tests
- Verify `vercel.json` JSON is valid before committing
