/**
 * tests/e2e/smoke.spec.ts — Sprint 1 E2E Smoke Test
 *
 * Critical path: sign in → dashboard → blocks list → block detail → event timeline
 *
 * Prerequisites:
 *   1. npm run db:reset && npm run db:seed  (Thornfield Capital Partners data)
 *   2. npm run dev                          (or webServer in playwright.config.ts starts it)
 *   3. E2E_CLERK_EMAIL + E2E_CLERK_PASSWORD in .env.local (Clerk test user)
 *
 * Tests skip automatically when credentials are not set.
 * Screenshot on failure saved to test-results/ (configured in playwright.config.ts).
 */

import { test, expect } from '@playwright/test'

// Guard: skip all tests when Clerk test credentials are not configured
const hasCredentials =
  !!process.env.E2E_CLERK_EMAIL &&
  !!process.env.E2E_CLERK_PASSWORD

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function signIn(page: import('@playwright/test').Page) {
  await page.goto('/sign-in')
  await page.waitForLoadState('networkidle')

  // Clerk sign-in form — fill email and continue
  await page.getByLabel(/email/i).fill(process.env.E2E_CLERK_EMAIL!)
  await page.getByRole('button', { name: /continue/i }).click()

  // Fill password
  await page.getByLabel(/password/i).fill(process.env.E2E_CLERK_PASSWORD!)
  await page.getByRole('button', { name: /sign in|continue/i }).click()

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
}

// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sprint 1 Smoke Test — Auth + Block + Event Flow', () => {
  test.skip(!hasCredentials, 'E2E_CLERK_EMAIL / E2E_CLERK_PASSWORD not set — skipping E2E tests')

  test('sign in redirects to /dashboard', async ({ page }) => {
    await signIn(page)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('navigation')).toBeVisible()
    // Nav should show Blocks link
    await expect(page.getByRole('link', { name: /blocks/i })).toBeVisible()
  })

  test('/blocks shows block list with Thornfield seed data', async ({ page }) => {
    await signIn(page)
    await page.goto('/blocks')
    await page.waitForLoadState('networkidle')

    // Block list should be visible
    await expect(page.getByRole('heading', { name: /blocks/i })).toBeVisible()

    // Seed data includes Thornfield Capital Partners
    await expect(page.getByText('Thornfield Capital Partners')).toBeVisible({ timeout: 10_000 })
  })

  test('/blocks — type filter updates list without page reload', async ({ page }) => {
    await signIn(page)
    await page.goto('/blocks')
    await page.waitForLoadState('networkidle')

    // Click "Client" filter
    await page.getByRole('button', { name: /client/i }).click()

    // All visible cards should be client type (badge text "client")
    const cards = page.locator('[data-testid="block-card"]')
    // If no testids, check that deal blocks are not visible
    await expect(page.getByText('Thornfield Q1 2026 Onboarding')).toBeHidden()
  })

  test('/blocks — search filters by name', async ({ page }) => {
    await signIn(page)
    await page.goto('/blocks')
    await page.waitForLoadState('networkidle')

    // Search for Thornfield
    const searchInput = page.getByPlaceholder(/search/i)
    await searchInput.fill('Thornfield Capital')

    await expect(page.getByText('Thornfield Capital Partners')).toBeVisible()
    await expect(page.getByText('KYC/AML Review')).toBeHidden()
  })

  test('clicking a block navigates to /blocks/:id', async ({ page }) => {
    await signIn(page)
    await page.goto('/blocks')
    await page.waitForLoadState('networkidle')

    // Click the Thornfield Capital Partners card
    await page.getByText('Thornfield Capital Partners').click()

    await page.waitForURL(/\/blocks\/[0-9a-f-]+/, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/blocks\/[0-9a-f-]+/)
  })

  test('/blocks/:id — shows block header, event timeline, connected blocks', async ({ page }) => {
    await signIn(page)
    await page.goto('/blocks')
    await page.waitForLoadState('networkidle')

    // Navigate to Thornfield block
    await page.getByText('Thornfield Capital Partners').click()
    await page.waitForURL(/\/blocks\/[0-9a-f-]+/, { timeout: 10_000 })
    await page.waitForLoadState('networkidle')

    // Block header: name visible
    await expect(page.getByRole('heading', { name: /Thornfield Capital Partners/i })).toBeVisible()

    // Event timeline: at least one event visible
    // The seed data has events like "onboarding.initiated", "client.created", etc.
    await expect(page.getByText(/onboarding/i)).toBeVisible({ timeout: 10_000 })

    // Connected blocks panel visible (Thornfield has deal + project + contacts connected)
    await expect(page.getByText(/connected/i)).toBeVisible()
  })

  test('/blocks/:id — event timeline shows relative timestamps', async ({ page }) => {
    await signIn(page)
    await page.goto('/blocks')
    await page.waitForLoadState('networkidle')
    await page.getByText('Thornfield Capital Partners').click()
    await page.waitForURL(/\/blocks\/[0-9a-f-]+/)
    await page.waitForLoadState('networkidle')

    // Relative timestamps: "ago" should appear in the timeline
    await expect(page.getByText(/ago/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('/blocks/:id — back navigation from 404 block returns to list', async ({ page }) => {
    await signIn(page)
    await page.goto('/blocks/00000000-0000-0000-0000-000000000000')
    await page.waitForLoadState('networkidle')

    // 404 page with back link
    await expect(page.getByText(/not found|404/i)).toBeVisible()
    await page.getByRole('link', { name: /back to blocks/i }).click()
    await expect(page).toHaveURL(/\/blocks$/)
  })
})
