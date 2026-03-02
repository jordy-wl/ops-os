import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E configuration.
 *
 * To run: npm run test:e2e
 * Prerequisites:
 *   1. Local dev server: npm run dev (or it starts automatically via webServer)
 *   2. Seed data: npm run db:reset && npm run db:seed
 *   3. Clerk test credentials in .env.local:
 *      E2E_CLERK_EMAIL=<test user email>
 *      E2E_CLERK_PASSWORD=<test user password>
 *
 * Tests are skipped automatically when E2E_CLERK_EMAIL is not set.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run sequentially — share auth state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  outputDir: 'test-results/',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
