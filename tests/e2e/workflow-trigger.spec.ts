/**
 * tests/e2e/workflow-trigger.spec.ts — Sprint 3 E2E Test (P1-S3-QA-01)
 *
 * Full workflow trigger lifecycle:
 *   Authenticated user → block detail → click "Start Client Onboarding"
 *   → toast confirmation → poll for job completion → verify events on block
 *
 * Prerequisites:
 *   1. npm run dev (or webServer in playwright.config.ts auto-starts it)
 *   2. supabase start + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   3. E2E_CLERK_EMAIL + E2E_CLERK_PASSWORD in .env.local (Clerk test user)
 *   4. P1-S3-FE-01 (trigger button) DONE and P1-S3-BE-01 (cron config) DONE
 *
 * SCAFFOLD STATUS: Written before FE-01 + BE-01 complete.
 * Tests skip cleanly in CI until E2E_CLERK_EMAIL is set.
 * Run locally against dev server once FE-01 + BE-01 are merged.
 *
 * Cleanup note: event immutability (RLS) prevents cascade deletes after workflow
 * events attach to the block. Test blocks persist in the dev DB by design.
 * To clear: npm run db:reset && npm run db:seed
 */

import { test, expect, type Page } from '@playwright/test'

// Guard: skip all tests when Clerk test credentials are not configured
const hasCredentials =
  !!process.env.E2E_CLERK_EMAIL &&
  !!process.env.E2E_CLERK_PASSWORD

// ─── Auth helper ──────────────────────────────────────────────────────────────
// Same pattern as smoke.spec.ts — signs in and waits for /dashboard redirect.

async function signIn(page: Page) {
  await page.goto('/sign-in')
  await page.waitForLoadState('networkidle')

  await page.getByLabel(/email/i).fill(process.env.E2E_CLERK_EMAIL!)
  await page.getByRole('button', { name: /continue/i }).click()

  await page.getByLabel(/password/i).fill(process.env.E2E_CLERK_PASSWORD!)
  await page.getByRole('button', { name: /sign in|continue/i }).click()

  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

// ─── Polling helper ───────────────────────────────────────────────────────────

/**
 * Navigates to /workflows every 2s until a row for blockName shows status 'done'.
 *
 * Timeout: 30s covers dev engine polling (every 5s via instrumentation.ts).
 * If running against a Vercel preview URL where the cron fires every 60s,
 * pass timeoutMs = 90_000 from the call site.
 */
async function pollForWorkflowCompletion(
  page: Page,
  blockName: string,
  timeoutMs = 30_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    await page.waitForTimeout(2_000)
    await page.goto('/workflows')
    await page.waitForLoadState('networkidle')

    // A row that contains both the block name AND the text 'done' (status badge)
    const doneRow = page
      .locator('tr')
      .filter({ hasText: blockName })
      .filter({ hasText: 'done' })

    if ((await doneRow.count()) > 0) return
  }

  throw new Error(
    `Workflow job for block "${blockName}" did not reach 'done' within ${timeoutMs}ms.\n` +
      `Checklist:\n` +
      `  • Is npm run dev running? (engine polls every 5s in dev)\n` +
      `  • Is P1-S3-BE-01 (cron + engine hardening) DONE?\n` +
      `  • Is there a workflow job visible in /workflows for this block?`
  )
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Workflow Trigger — Onboarding to Completion', () => {
  test.skip(!hasCredentials, 'E2E_CLERK_EMAIL / E2E_CLERK_PASSWORD not set — skipping E2E tests')

  // Unique name per test run — deterministic, avoids collisions with seed data
  const blockName = `E2E Test Client ${Date.now()}`
  let blockId = ''

  test('trigger onboarding from block detail → job completes → events visible', async ({ page }) => {
    // ── 1. Sign in ────────────────────────────────────────────────────────────
    await signIn(page)

    // ── 2. Create a test client block via authenticated browser fetch ─────────
    // Uses the page's Clerk session cookies — no separate auth needed.
    const createResult = await page.evaluate(async (name: string) => {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'client',
          name,
          metadata: { jurisdiction: 'AU' },
        }),
      })
      const body = await res.json() as Record<string, unknown>
      return { status: res.status, body }
    }, blockName)

    expect(createResult.status).toBe(201)

    // Handle both { data: { id } } and { id } response shapes defensively
    const bodyData = createResult.body.data as Record<string, unknown> | undefined
    blockId = (bodyData?.id ?? createResult.body.id) as string
    expect(blockId).toBeTruthy()

    // ── 3. Navigate to block detail page ──────────────────────────────────────
    await page.goto(`/blocks/${blockId}`)
    await page.waitForLoadState('networkidle')

    // ── 4. Assert "Start Client Onboarding" button is visible ─────────────────
    // FE-01 (P1-S3-FE-01) renders this button on client-type block detail pages.
    // If this assertion fails: confirm P1-S3-FE-01 is DONE and deployed.
    const triggerButton = page.getByRole('button', { name: /start.*onboarding/i })
    await expect(triggerButton).toBeVisible({ timeout: 10_000 })

    // ── 5. Click the trigger button ───────────────────────────────────────────
    await triggerButton.click()

    // ── 6. Assert success feedback ────────────────────────────────────────────
    // FE-01 must display a toast or inline message confirming the workflow started.
    // Exact text: "Onboarding workflow started" (case-insensitive).
    await expect(page.getByText(/onboarding workflow started/i)).toBeVisible({
      timeout: 5_000,
    })

    // ── 7 + 8. Poll /workflows until job status = 'done' ─────────────────────
    await pollForWorkflowCompletion(page, blockName)

    // ── 9. Navigate back to block detail ──────────────────────────────────────
    await page.goto(`/blocks/${blockId}`)
    await page.waitForLoadState('networkidle')

    // ── 10. Assert workflow events are visible on block event timeline ─────────
    // The onboarding handler (src/lib/workflow/handlers/onboarding.ts) emits
    // exactly these 3 event types in order. All 3 must appear after job completion.
    await expect(page.getByText('document.requested')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('kyc.check.started')).toBeVisible()
    await expect(page.getByText('aml.check.started')).toBeVisible()
  })
})
