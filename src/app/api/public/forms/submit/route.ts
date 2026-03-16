import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { validateShareToken } from '@/lib/shared-links'
import { logger } from '@/lib/logger'

const SubmitSchema = z.object({
  token: z.string().min(1),
  field_data: z.record(z.unknown()),
  respondent_name: z.string().max(200).optional(),
  respondent_email: z.string().email().max(200).optional(),
})

/**
 * POST /api/public/forms/submit — public form submission endpoint.
 * No Clerk auth required — validates via share token.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json(
      { data: null, error: { message: 'Invalid JSON body', code: 'validation/invalid-json' } },
      { status: 400 }
    )
  }

  const parsed = SubmitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        data: null,
        error: {
          message: 'Validation failed',
          code: 'validation/invalid-input',
          details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      },
      { status: 400 }
    )
  }

  const { token, field_data, respondent_name, respondent_email } = parsed.data

  // Validate share token
  const tokenResult = await validateShareToken(token)
  if (!tokenResult.valid) {
    return NextResponse.json(
      { data: null, error: { message: tokenResult.reason, code: 'shared-links/invalid-token' } },
      { status: 403 }
    )
  }

  const { link } = tokenResult

  // Only submit-type links can accept form submissions
  if (link.share_type !== 'submit') {
    return NextResponse.json(
      { data: null, error: { message: 'This link does not accept submissions', code: 'shared-links/wrong-type' } },
      { status: 403 }
    )
  }

  const supabase = createServerClient()

  // Extract IP for audit trail
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? null

  // Insert submission
  const { data: submission, error } = await supabase
    .from('form_submissions')
    .insert({
      org_id: link.org_id,
      shared_link_id: link.id,
      block_id: link.block_id,
      field_data,
      respondent_name: respondent_name ?? null,
      respondent_email: respondent_email ?? null,
      ip_address: ip,
    })
    .select('id, submitted_at')
    .single()

  if (error || !submission) {
    logger.error('public-forms', 'submission.insert_failed', {
      link_id: link.id,
      error_code: error?.code,
    })
    return NextResponse.json(
      { data: null, error: { message: 'Failed to save submission', code: 'forms/submit-failed' } },
      { status: 500 }
    )
  }

  // Log event for audit trail
  await supabase.from('events').insert({
    org_id: link.org_id,
    block_id: link.block_id,
    type: 'form.submitted',
    payload: {
      submission_id: submission.id,
      link_id: link.id,
      respondent_email: respondent_email ?? null,
      field_count: Object.keys(field_data).length,
    },
    actor_id: respondent_email ?? 'anonymous',
  })

  logger.info('public-forms', 'submission.created', {
    org_id: link.org_id,
    submission_id: submission.id,
    link_id: link.id,
  })

  return NextResponse.json(
    { data: { id: submission.id, submitted_at: submission.submitted_at }, error: null },
    { status: 201 }
  )
}
