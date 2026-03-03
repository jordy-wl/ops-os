import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { runProcessingCycle } from '@/lib/workflow/engine'
import { logger } from '@/lib/logger'

async function handleCycle(): Promise<NextResponse> {
  const supabase = createServerClient()
  try {
    const processed = await runProcessingCycle(supabase)
    return NextResponse.json({ data: { processed }, error: null })
  } catch (err) {
    logger.error('api-workflow-engine', 'cycle.failed', {
      error: (err as Error).message?.slice(0, 200),
    })
    return NextResponse.json(
      { data: null, error: { message: 'Processing cycle failed', code: 'engine/cycle-failed' } },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workflow-engine/process
 *
 * Called by Vercel Cron (production) — Vercel Cron always sends GET requests.
 * Schedule configured in vercel.json: every 60 seconds.
 *
 * Protected by Vercel's built-in CRON_SECRET mechanism: set CRON_SECRET in
 * Vercel environment variables and Vercel automatically injects
 * "Authorization: Bearer <CRON_SECRET>" into every cron request.
 * Fail-closed: rejects if CRON_SECRET is not set or header doesn't match.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    logger.warn('api-workflow-engine', 'engine.unauthorized_trigger')
    return NextResponse.json(
      { data: null, error: { message: 'Unauthorized', code: 'auth/unauthenticated' } },
      { status: 401 }
    )
  }
  return handleCycle()
}

/**
 * POST /api/workflow-engine/process
 *
 * Called by the internal polling loop in development (src/instrumentation.ts).
 * Protected by x-workflow-engine-secret header (fail-closed).
 * Set WORKFLOW_ENGINE_SECRET in .env.local for local dev use.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.WORKFLOW_ENGINE_SECRET
  if (!secret || req.headers.get('x-workflow-engine-secret') !== secret) {
    logger.warn('api-workflow-engine', 'engine.unauthorized_trigger')
    return NextResponse.json(
      { data: null, error: { message: 'Unauthorized', code: 'auth/unauthenticated' } },
      { status: 401 }
    )
  }
  return handleCycle()
}
