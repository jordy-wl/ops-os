# Sprint 3 — QA Engineer Tasks

> Read this file after `shared-state.md` and `phases.md`.
> Claim a task by updating its status to IN_PROGRESS in `shared-state.md` before starting.

---

## Your Tasks This Sprint

| Task ID | Title | Status | Complexity | Est. Days | Blocked By |
|---------|-------|--------|-----------|-----------|-----------|
| P1-S3-QA-01 | E2E Test — Full Workflow Trigger to Completion | OPEN | MEDIUM | 2 | FE-01, BE-01 |

**Dependency note:** QA-01 cannot be run until P1-S3-FE-01 (trigger button) and P1-S3-BE-01 (cron config) are DONE and running in the local dev environment. You CAN write the test scaffold (assertions, page object helpers) before FE-01 is merged — just don't claim it as DONE until the test passes end-to-end.

---

## P1-S3-QA-01: E2E Test — Full Workflow Trigger to Completion

**Description:** Playwright E2E test covering the complete flow a design partner will execute: navigate to a client block → click "Start Client Onboarding" → wait for workflow to complete → verify events populated. This is the first E2E test that exercises the actual business flow (Sprint 1 E2E was auth smoke only).

---

### Test Flow

```
1. Navigate to /blocks (authenticated via E2E_CLERK_EMAIL)
2. Find a client-type block (or create one if none exists)
3. Navigate to /blocks/[id] — the block detail page
4. Assert: "Start Client Onboarding" button is visible
5. Click the button
6. Assert: toast "Onboarding workflow started" appears
7. Navigate to /workflows (either via redirect or manually)
8. Poll every 2s for up to 30s:
   - Assert: a workflow job for this block exists with status = 'done'
   - If timeout: fail with "Workflow job did not complete within 30s — check cron config"
9. Navigate back to /blocks/[id]
10. Assert: at least 3 new events visible:
    - document.requested
    - kyc.check.started
    - aml.check.started
```

---

### Implementation Notes

**File:** `tests/e2e/workflow-trigger.spec.ts`

**Skip guard:** Consistent with `smoke.spec.ts` — skip when `E2E_CLERK_EMAIL` not set:
```typescript
test.skip(!process.env.E2E_CLERK_EMAIL, 'E2E_CLERK_EMAIL not set — skipping')
```

**Block setup:** The test needs a client-type block to work with. Two options:
1. Create a new block via the API at the start of the test (preferred — deterministic)
2. Look for an existing client block in the blocks list (fragile — depends on seed data)

**Recommended approach:** POST `/api/blocks` with `{ type: 'client', name: 'E2E Test Client [timestamp]', metadata: { jurisdiction: 'AU' } }` at test start. Clean up (DELETE) in `afterAll` if the test creates it.

**Polling helper:**
```typescript
async function pollForJobCompletion(page: Page, blockId: string, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    await page.waitForTimeout(2000)
    await page.goto('/workflows')
    // Check if job for this blockId shows status 'done'
    const doneJob = page.locator(`tr:has-text("${blockId}") :has-text("done")`)
    if (await doneJob.count() > 0) return
  }
  throw new Error(`Workflow job for block ${blockId} did not reach 'done' within ${timeoutMs}ms`)
}
```

**Cron note:** In local dev, the engine runs via `src/instrumentation.ts` polling loop (every 5s). The test's 30s timeout accommodates: up to 5s for job creation + up to 5s for next poll cycle + processing time. If running against Vercel preview (cron at 1-minute interval), the timeout may need to be raised to 90s — add a note in the test.

---

**Acceptance Criteria:**
- [ ] `tests/e2e/workflow-trigger.spec.ts` exists and follows Playwright conventions
- [ ] Test uses `test.skip` guard when `E2E_CLERK_EMAIL` not set
- [ ] Test creates a deterministic client block (timestamp-named) at start
- [ ] Test asserts "Start Client Onboarding" button is visible on block detail
- [ ] Test asserts toast appears after clicking trigger
- [ ] Test polls `/workflows` until job status = 'done' (30s timeout, 2s interval)
- [ ] Test asserts ≥3 events (document.requested, kyc.check.started, aml.check.started) on block detail after completion
- [ ] Test cleans up created block in `afterAll`
- [ ] Test passes locally with live Supabase + dev server + E2E_CLERK_EMAIL set
- [ ] Lint zero errors on test file

**Applicable Gates:** 1, 2, 5
**Owner once claimed:** QA-ENGINEER

---

## Gate 6 Peer Review Responsibilities

**Sprint 3 HIGH tasks:** P1-S3-DE-01 (partner onboarding) is HIGH complexity. As QA, you are responsible for reviewing the partner notes and session quality when DE-01 is submitted for peer review.

**DE-01 Gate 6 review checklist:**
- [ ] design-partner-notes.md exists and contains real session notes (not a template)
- [ ] Notes are anonymised (no real contact names in repo)
- [ ] ≥5 events confirmed via Supabase query output
- [ ] Partner feedback captured (even if brief)
- [ ] Walkthrough matched the revised script (all 5 steps completed)

---

## Files You Will Touch

| File | Change |
|------|--------|
| `tests/e2e/workflow-trigger.spec.ts` | NEW — E2E test |
| `playwright.config.ts` | READ — understand existing config before writing test |
| `tests/e2e/smoke.spec.ts` | READ — use as reference for auth + skip guard pattern |

---

## Standards Reminder

- No feature code — QA writes tests only
- Use `test.skip` not `test.todo` for conditional skips (skip guard must check env var)
- Assertions should test behaviour, not DOM selectors (prefer `getByRole`, `getByText` over CSS selectors)
- Timeout must be explicit with a meaningful error message (never silent hang)
