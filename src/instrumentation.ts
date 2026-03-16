/**
 * Next.js Instrumentation — runs once on server startup.
 *
 * In development: starts the workflow engine polling loop (5s interval).
 * In production (Vercel serverless): no-op — polling is handled by the
 *   Vercel Cron that calls POST /api/workflow-engine/process every 60s.
 *   Configure the cron schedule in vercel.json (DevOps task: P1-S2-OPS-01).
 */
export async function register() {
  // Only run in Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Validate environment variables on server startup (all environments)
  await import('@/lib/env')

  // Only poll in development — production uses Vercel Cron
  if (process.env.NODE_ENV !== 'development') return

  try {
    const { createServerClient } = await import('@/lib/supabase/server')
    const { startPollingLoop } = await import('@/lib/workflow/engine')
    const supabase = createServerClient()
    startPollingLoop(supabase, 5_000)
  } catch {
    // Don't crash app startup if the polling loop fails to start
    // (e.g. missing env vars in CI or test environments)
    process.stdout.write(
      JSON.stringify({
        level:   'warn',
        service: 'instrumentation',
        event:   'workflow_polling_start_failed',
      }) + '\n'
    )
  }
}
