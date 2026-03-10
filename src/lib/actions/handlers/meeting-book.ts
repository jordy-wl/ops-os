import { z } from 'zod'
import type { ActionHandler, ActionResult } from '@/lib/actions/types'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getGoogleServices } from '@/lib/integrations/google-client'
import { logger } from '@/lib/logger'

const schema = z.object({
  connector_id: z.string().uuid('connector_id must be a valid UUID'),
  title: z.string().min(1, 'title is required').max(500),
  start: z.string().datetime({ message: 'start must be an ISO datetime string' }),
  end: z.string().datetime({ message: 'end must be an ISO datetime string' }),
  attendees: z.array(z.string().email()).optional().default([]),
  description: z.string().max(5000).optional(),
  block_id: z.string().uuid().optional(),
})

type Payload = z.infer<typeof schema>

/**
 * meeting.book — creates a Google Calendar event with Google Meet link.
 */
async function execute(
  payload: Payload,
  ctx: AuthContext,
  supabase: SupabaseClient
): Promise<ActionResult> {
  const actionId = crypto.randomUUID()

  const { calendar } = await getGoogleServices(payload.connector_id, ctx.orgId)

  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: payload.title,
        description: payload.description,
        start: { dateTime: payload.start, timeZone: 'UTC' },
        end: { dateTime: payload.end, timeZone: 'UTC' },
        attendees: payload.attendees.map((email) => ({ email })),
        conferenceData: {
          createRequest: {
            requestId: actionId,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    })

    const meetLink = response.data.hangoutLink ?? response.data.conferenceData?.entryPoints?.[0]?.uri ?? null

    logger.info('meeting-book', 'meeting.booked', {
      connector_id: payload.connector_id,
      event_id: response.data.id,
      meet_link: meetLink,
    })

    // Record event
    const blockId = payload.block_id ?? null
    const { data: event } = await supabase
      .from('events')
      .insert({
        org_id: ctx.orgId,
        block_id: blockId,
        type: 'meeting.booked',
        actor_id: ctx.userId,
        actor_type: 'human',
        payload: {
          title: payload.title,
          start: payload.start,
          end: payload.end,
          attendees: payload.attendees,
          calendar_event_id: response.data.id,
          meet_link: meetLink,
          via: 'action/meeting.book',
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
    logger.error('meeting-book', 'meeting.book_failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    })
    throw new Error(`Calendar booking failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
  }
}

export const meetingBookHandler: ActionHandler<Payload> = { schema, execute }
