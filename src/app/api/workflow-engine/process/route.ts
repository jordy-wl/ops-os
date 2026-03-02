import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { runProcessingCycle } from '@/lib/workflow/engine'
import { logger } from '@/lib/logger'

/**
 * POST /api/workflow-engine/process
 *
 * Triggers one workflow processing cycle. Called by:
 *   - Vercel Cron (production) — configure schedule in vercel.json (DevOps task)
 *   - Internal polling loop (development) — started via src/instrumentation.ts
 *
 * PRD-03 specifies production cron interval: 60 seconds.
 * Dev polling interval: 5 seconds (see instrumentation.ts).
 *
 * Protected by WORKFLOW_ENGINE_SECRET header when the env var is set.
 * Set WORKFLOW_ENGINE_SECRET in Vercel environment variables before production deploy.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.WORKFLOW_ENGINE_SECRET
  if (secret) {
    const provided = req.headers.get('x-workflow-engine-secret')
    if (provided !== secret) {
      logger.warn('api-workflow-engine', 'engine.unauthorized_trigger')
      return NextResponse.json(
        { data: null, error: { message: 'Unauthorized', code: 'auth/unauthenticated' } },
        { status: 401 }
      )
    }
  }

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
