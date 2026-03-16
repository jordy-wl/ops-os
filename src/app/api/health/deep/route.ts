import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const checks: Record<string, string> = {}

  // Check Supabase connectivity
  try {
    const supabase = createServerClient()
    const { error } = await supabase.from('orgs').select('id').limit(1)
    checks.database = error ? `error: ${error.message}` : 'ok'
  } catch (e) {
    checks.database = `error: ${(e as Error).message}`
  }

  // Check env var presence (not values)
  checks.clerk = process.env.CLERK_SECRET_KEY ? 'configured' : 'missing'
  checks.anthropic = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing'
  checks.openai = process.env.OPENAI_API_KEY ? 'configured' : 'missing'

  const allOk = Object.values(checks).every(
    (v) => v === 'ok' || v === 'configured'
  )

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  )
}
