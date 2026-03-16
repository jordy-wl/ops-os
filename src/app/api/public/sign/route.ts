import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { validateShareToken } from '@/lib/shared-links'
import { logger } from '@/lib/logger'

const SignSchema = z.object({
  token: z.string().min(1),
  event_type: z.enum(['viewed', 'consented', 'signed', 'declined']),
  document_hash_sha256: z.string().min(64).max(64),
  signer_name: z.string().max(200).optional(),
  signer_email: z.string().email().max(200).optional(),
  consent_text: z.string().max(500).optional(),
})

/**
 * POST /api/public/sign — record a signature event (public, no auth).
 * Validates via share token. Appends to immutable signature_events table.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) {
    return NextResponse.json(
      { data: null, error: { message: 'Invalid JSON body', code: 'validation/invalid-json' } },
      { status: 400 }
    )
  }

  const parsed = SignSchema.safeParse(body)
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

  const { token, event_type, document_hash_sha256, signer_name, signer_email, consent_text } = parsed.data

  // Validate share token
  const tokenResult = await validateShareToken(token)
  if (!tokenResult.valid) {
    return NextResponse.json(
      { data: null, error: { message: tokenResult.reason, code: 'shared-links/invalid-token' } },
      { status: 403 }
    )
  }

  const { link } = tokenResult

  if (link.share_type !== 'sign') {
    return NextResponse.json(
      { data: null, error: { message: 'This link does not support signing', code: 'shared-links/wrong-type' } },
      { status: 403 }
    )
  }

  const supabase = createServerClient()

  // Extract request metadata for audit trail
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? null
  const userAgent = req.headers.get('user-agent') ?? null

  // Insert immutable signature event
  const { data: sigEvent, error } = await supabase
    .from('signature_events')
    .insert({
      org_id: link.org_id,
      document_id: link.block_id,
      shared_link_id: link.id,
      signer_email: signer_email ?? null,
      signer_name: signer_name ?? null,
      event_type,
      document_hash_sha256,
      consent_text: consent_text ?? null,
      ip_address: ip,
      user_agent: userAgent,
    })
    .select('id, occurred_at')
    .single()

  if (error || !sigEvent) {
    logger.error('public-sign', 'signature.insert_failed', {
      link_id: link.id,
      error_code: error?.code,
    })
    return NextResponse.json(
      { data: null, error: { message: 'Failed to record signature event', code: 'sign/insert-failed' } },
      { status: 500 }
    )
  }

  // Also log to events table for audit timeline
  await supabase.from('events').insert({
    org_id: link.org_id,
    block_id: link.block_id,
    type: `document.${event_type}`,
    payload: {
      signature_event_id: sigEvent.id,
      signer_email: signer_email ?? null,
      document_hash: document_hash_sha256.substring(0, 12) + '...',
    },
    actor_id: signer_email ?? 'anonymous',
  })

  logger.info('public-sign', 'signature.recorded', {
    org_id: link.org_id,
    event_type,
    signature_event_id: sigEvent.id,
  })

  return NextResponse.json(
    { data: { id: sigEvent.id, occurred_at: sigEvent.occurred_at }, error: null },
    { status: 201 }
  )
}
