import { z } from 'zod'
import type { ActionHandler, ActionResult } from '@/lib/actions/types'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getGoogleServices } from '@/lib/integrations/google-client'
import { logger } from '@/lib/logger'

const schema = z.object({
  connector_id: z.string().uuid('connector_id must be a valid UUID'),
  to: z.string().email('to must be a valid email'),
  subject: z.string().min(1, 'subject is required').max(500),
  body: z.string().min(1, 'body is required'),
  cc: z.string().email().optional(),
  bcc: z.string().email().optional(),
  block_id: z.string().uuid().optional(),
})

type Payload = z.infer<typeof schema>

/**
 * email.send — sends an email via Gmail API using a connected Google connector.
 */
async function execute(
  payload: Payload,
  ctx: AuthContext,
  supabase: SupabaseClient
): Promise<ActionResult> {
  const actionId = crypto.randomUUID()

  const { gmail } = await getGoogleServices(payload.connector_id, ctx.orgId)

  // Build RFC 2822 message
  const messageParts = [
    `To: ${payload.to}`,
    `Subject: ${payload.subject}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
  ]
  if (payload.cc) messageParts.push(`Cc: ${payload.cc}`)
  if (payload.bcc) messageParts.push(`Bcc: ${payload.bcc}`)
  messageParts.push('', payload.body)

  const rawMessage = messageParts.join('\r\n')
  const encodedMessage = Buffer.from(rawMessage).toString('base64url')

  try {
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    })

    logger.info('email-send', 'email.sent', {
      connector_id: payload.connector_id,
      message_id: response.data.id,
      to: payload.to,
    })

    // Record event
    const blockId = payload.block_id ?? null
    const { data: event } = await supabase
      .from('events')
      .insert({
        org_id: ctx.orgId,
        block_id: blockId,
        type: 'email.sent',
        actor_id: ctx.userId,
        actor_type: 'human',
        payload: {
          to: payload.to,
          subject: payload.subject,
          gmail_message_id: response.data.id,
          via: 'action/email.send',
        },
      })
      .select('id')
      .single()

    return {
      actionId,
      eventId: event?.id ?? null,
      status: 'completed',
    }
  } catch (err) {
    logger.error('email-send', 'email.send_failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    })
    throw new Error(`Gmail send failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

export const emailSendHandler: ActionHandler<Payload> = { schema, execute }
