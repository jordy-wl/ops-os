import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { runProcessingCycle } from '@/lib/workflow/engine'
import { logger } from '@/lib/logger'

/**
 * Verifies the x-workflow-engine-secret header (fail-closed).
 * If WORKFLOW_ENGINE_SECRET is not set, all callers are rejected.
 */
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.WORKFLOW_ENGINE_SECRET
  if (!secret) return false
  return req.headers.get('x-workflow-engine-secret') === secret
}

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
 * Protected by x-workflow-engine-secret header (fail-closed).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
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
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    logger.warn('api-workflow-engine', 'engine.unauthorized_trigger')
    return NextResponse.json(
      { data: null, error: { message: 'Unauthorized', code: 'auth/unauthenticated' } },
      { status: 401 }
    )
  }
  return handleCycle()
}
