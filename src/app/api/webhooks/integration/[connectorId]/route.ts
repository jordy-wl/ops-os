import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { verifyHmacSignature } from '@/lib/integrations/hmac'
import { sanitizePayload } from '@/lib/embeddings'

/**
 * POST /api/webhooks/integration/[connectorId]
 *
 * Public endpoint — no Clerk auth. Validates via connector_id + optional HMAC.
 * Receives external webhook payloads and records integration.webhook.received events.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ connectorId: string }> }
): Promise<NextResponse> {
  const { connectorId } = await context.params

  const supabase = createServerClient()

  // 1. Look up the connector
  const { data: connector, error: connectorError } = await supabase
    .from('integration_connectors')
    .select('id, org_id, status, provider, config, webhook_secret')
    .eq('id', connectorId)
    .single()

  if (connectorError?.code === 'PGRST116' || !connector) {
    return NextResponse.json(
      { error: { code: 'webhooks/connector-not-found', message: 'Connector not found' } },
      { status: 404 }
    )
  }
  if (connectorError) {
    logger.error('api-webhooks', 'db.connector_query_failed', { error_code: connectorError.code })
    return NextResponse.json(
      { error: { code: 'db/query-failed', message: 'Internal error' } },
      { status: 500 }
    )
  }

  // 2. Check connector is active
  if (connector.status !== 'active') {
    return NextResponse.json(
      { error: { code: 'webhooks/connector-inactive', message: 'Connector is not active' } },
      { status: 403 }
    )
  }

  // 3. Read the raw body
  const rawBody = await req.text()
  if (!rawBody) {
    return NextResponse.json(
      { error: { code: 'webhooks/empty-body', message: 'Request body is required' } },
      { status: 400 }
    )
  }

  // 4. HMAC verification (if configured)
  if (connector.webhook_secret) {
    const signature = req.headers.get('x-webhook-signature') ?? ''
    if (!signature || !verifyHmacSignature(rawBody, signature, connector.webhook_secret)) {
      logger.warn('api-webhooks', 'webhook.invalid_hmac', { connector_id: connectorId })
      return NextResponse.json(
        { error: { code: 'webhooks/invalid-signature', message: 'Invalid HMAC signature' } },
        { status: 400 }
      )
    }
  }

  // 5. Parse the payload
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json(
      { error: { code: 'webhooks/invalid-json', message: 'Invalid JSON body' } },
      { status: 400 }
    )
  }

  // 6. Sanitize PII from the payload before storing
  const sanitizedPayload = sanitizePayload(payload)

  // 7. Record integration.webhook.received event
  // Webhooks are connector-level, not block-level. We use a synthetic block_id approach:
  // find or determine the target block from the payload if possible, otherwise skip block_id.
  // For now, we store the event with the connector metadata and let trigger evaluation
  // handle block resolution.
  const eventPayload = {
    connector_id: connector.id,
    provider: connector.provider,
    received_at: new Date().toISOString(),
    external_payload: sanitizedPayload,
  }

  // Store the webhook event in the events table.
  // events.block_id is NOT NULL, so we need a block reference.
  // If payload includes block_id, use it. Otherwise skip event creation
  // (trigger evaluation in BE-03 will handle block resolution and event creation).
  const blockId = sanitizedPayload.block_id as string | undefined
  let event: { id: string } | null = null

  if (blockId) {
    // Verify the block exists in this org
    const { data: block } = await supabase
      .from('blocks')
      .select('id')
      .eq('id', blockId)
      .eq('org_id', connector.org_id)
      .single()

    if (block) {
      const { data: insertedEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          org_id: connector.org_id,
          block_id: block.id,
          type: 'integration.webhook.received',
          actor_id: `connector:${connector.id}`,
          actor_type: 'system',
          payload: eventPayload,
        })
        .select('id')
        .single()

      if (eventError) {
        logger.error('api-webhooks', 'webhook.event_insert_failed', {
          connector_id: connectorId,
          error_code: eventError.code,
        })
      } else {
        event = insertedEvent
      }
    }
  }

  // 8. Update last_sync_at on the connector
  await supabase
    .from('integration_connectors')
    .update({ last_sync_at: new Date().toISOString() })
    .eq('id', connectorId)

  logger.info('api-webhooks', 'webhook.received', {
    connector_id: connectorId,
    provider: connector.provider,
    event_id: event?.id,
  })

  return NextResponse.json({
    received: true,
    event_id: event?.id ?? null,
  })
}
