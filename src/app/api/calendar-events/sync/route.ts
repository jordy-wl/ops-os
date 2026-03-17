import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { createServerClient } from '@/lib/supabase/server'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { logger } from '@/lib/logger'
import { getGoogleServices } from '@/lib/integrations/google-client'

const SyncSchema = z.object({
  connector_id: z.string().uuid(),
})

/**
 * POST /api/calendar-events/sync
 * Pulls events from Google Calendar (30-day window) and upserts into calendar_events.
 * One-way pull only (AD-7: no write-back to Google).
 */
export const POST = withAuth(async (req: NextRequest, ctx) => {
  const body = await req.json()
  const parsed = SyncSchema.safeParse(body)
  if (!parsed.success) return validationError(parsed.error.issues)

  const { connector_id } = parsed.data
  const supabase = createServerClient()

  // Verify connector belongs to this org
  const { data: connector, error: connError } = await supabase
    .from('integration_connectors')
    .select('id, provider')
    .eq('id', connector_id)
    .eq('org_id', ctx.orgId)
    .single()

  if (connError || !connector) {
    return apiError('Connector not found', 'db/not-found', 404)
  }

  if (connector.provider !== 'google') {
    return apiError('Connector is not a Google integration', 'validation/wrong-provider', 400)
  }

  try {
    const { calendar } = await getGoogleServices(connector_id, ctx.orgId)

    // 30-day rolling window (AD-4)
    const now = new Date()
    const timeMin = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) // 15 days back
    const timeMax = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000) // 15 days forward

    let allEvents: Array<Record<string, unknown>> = []
    let pageToken: string | undefined

    // Fetch up to 3 pages (7500 events max — R4 mitigation)
    for (let page = 0; page < 3; page++) {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        maxResults: 2500,
        orderBy: 'startTime',
        pageToken,
      })

      const items = (response.data.items ?? []) as Array<Record<string, unknown>>
      allEvents = [...allEvents, ...items]

      pageToken = response.data.nextPageToken ?? undefined
      if (!pageToken) break
    }

    // Upsert each event
    let synced = 0
    let errors = 0

    for (const gEvent of allEvents) {
      const externalId = gEvent.id as string
      if (!externalId) continue

      const start = gEvent.start as Record<string, string> | undefined
      const end = gEvent.end as Record<string, string> | undefined
      const isAllDay = !!start?.date && !start?.dateTime

      // Parse start/end times (R5: timezone handling)
      const startAt = isAllDay
        ? new Date(`${start!.date}T00:00:00Z`).toISOString()
        : start?.dateTime
          ? new Date(start.dateTime).toISOString()
          : null

      const endAt = isAllDay
        ? new Date(`${end!.date}T00:00:00Z`).toISOString()
        : end?.dateTime
          ? new Date(end.dateTime).toISOString()
          : null

      if (!startAt || !endAt) continue

      const eventData = {
        org_id: ctx.orgId,
        user_id: ctx.userId,
        title: (gEvent.summary as string) ?? 'Untitled',
        description: (gEvent.description as string) ?? '',
        start_at: startAt,
        end_at: endAt,
        all_day: isAllDay,
        source: 'google' as const,
        external_id: externalId,
        external_link: (gEvent.htmlLink as string) ?? null,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      // Upsert by external_id (dedup)
      const { error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(eventData, { onConflict: 'org_id,external_id' })

      if (upsertError) {
        errors++
      } else {
        synced++
      }
    }

    logger.info('api-calendar', 'sync.completed', {
      org_id: ctx.orgId,
      connector_id,
      fetched: allEvents.length,
      synced,
      errors,
    })

    return ok({
      fetched: allEvents.length,
      synced,
      errors,
      window: { from: timeMin.toISOString(), to: timeMax.toISOString() },
    })
  } catch (err) {
    logger.error('api-calendar', 'sync.failed', {
      connector_id,
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return apiError(
      'Failed to sync Google Calendar',
      'google/sync-failed',
      500
    )
  }
})
