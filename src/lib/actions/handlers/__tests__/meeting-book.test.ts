import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Google services ───────────────────────────────────────────────────

const mockInsert = vi.fn()

vi.mock('@/lib/integrations/google-client', () => ({
  getGoogleServices: vi.fn().mockResolvedValue({
    gmail: {},
    calendar: {
      events: {
        insert: (...args: unknown[]) => mockInsert(...args),
      },
    },
    drive: {},
    auth: {},
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { meetingBookHandler } from '../meeting-book'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Mock Supabase ──────────────────────────────────────────────────────────

function makeSupabase(eventId: string | null = 'evt-1') {
  const singleFn = vi.fn().mockResolvedValue({ data: eventId ? { id: eventId } : null, error: null })
  const chain = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: singleFn,
  }
  return chain as unknown as SupabaseClient
}

const CTX: AuthContext = { userId: 'user_1', orgId: 'org_1', clerkOrgId: 'clerk_org_1', role: 'ops-admin' }
const CONNECTOR_ID = '00000000-0000-0000-0000-000000000001'

describe('meetingBookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('schema validates a correct payload', () => {
    const result = meetingBookHandler.schema.safeParse({
      connector_id: CONNECTOR_ID,
      title: 'Standup',
      start: '2026-03-15T09:00:00Z',
      end: '2026-03-15T09:30:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('schema defaults attendees to empty array', () => {
    const result = meetingBookHandler.schema.safeParse({
      connector_id: CONNECTOR_ID,
      title: 'Meeting',
      start: '2026-03-15T09:00:00Z',
      end: '2026-03-15T09:30:00Z',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.attendees).toEqual([])
    }
  })

  it('schema rejects non-ISO datetime', () => {
    const result = meetingBookHandler.schema.safeParse({
      connector_id: CONNECTOR_ID,
      title: 'Meeting',
      start: 'next tuesday',
      end: '2026-03-15T09:30:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('schema rejects missing title', () => {
    const result = meetingBookHandler.schema.safeParse({
      connector_id: CONNECTOR_ID,
      start: '2026-03-15T09:00:00Z',
      end: '2026-03-15T09:30:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('schema validates attendees as email array', () => {
    const result = meetingBookHandler.schema.safeParse({
      connector_id: CONNECTOR_ID,
      title: 'Meeting',
      start: '2026-03-15T09:00:00Z',
      end: '2026-03-15T09:30:00Z',
      attendees: ['a@b.com', 'c@d.com'],
    })
    expect(result.success).toBe(true)
  })

  it('schema rejects non-email attendees', () => {
    const result = meetingBookHandler.schema.safeParse({
      connector_id: CONNECTOR_ID,
      title: 'Meeting',
      start: '2026-03-15T09:00:00Z',
      end: '2026-03-15T09:30:00Z',
      attendees: ['not-an-email'],
    })
    expect(result.success).toBe(false)
  })

  it('execute creates calendar event with Meet link and records event', async () => {
    mockInsert.mockResolvedValue({
      data: {
        id: 'gcal-evt-1',
        hangoutLink: 'https://meet.google.com/abc-defg-hij',
      },
    })
    const supabase = makeSupabase('evt-1')

    const result = await meetingBookHandler.execute(
      {
        connector_id: CONNECTOR_ID,
        title: 'Team Standup',
        start: '2026-03-15T09:00:00Z',
        end: '2026-03-15T09:30:00Z',
        attendees: ['alice@example.com'],
      },
      CTX,
      supabase
    )

    expect(result.status).toBe('completed')
    expect(result.actionId).toBeTypeOf('string')
    expect(result.eventId).toBe('evt-1')
    expect(mockInsert).toHaveBeenCalledOnce()

    // Verify Calendar API called with correct structure
    const insertArgs = mockInsert.mock.calls[0][0]
    expect(insertArgs.calendarId).toBe('primary')
    expect(insertArgs.conferenceDataVersion).toBe(1)
    expect(insertArgs.requestBody.summary).toBe('Team Standup')
    expect(insertArgs.requestBody.attendees).toEqual([{ email: 'alice@example.com' }])
    expect(insertArgs.requestBody.conferenceData).toBeDefined()
  })

  it('execute throws on Calendar API failure', async () => {
    mockInsert.mockRejectedValue(new Error('Calendar API rate limit'))
    const supabase = makeSupabase()

    await expect(
      meetingBookHandler.execute(
        {
          connector_id: CONNECTOR_ID,
          title: 'Test',
          start: '2026-03-15T09:00:00Z',
          end: '2026-03-15T09:30:00Z',
          attendees: [],
        },
        CTX,
        supabase
      )
    ).rejects.toThrow('Calendar booking failed: Calendar API rate limit')
  })

  it('execute handles missing hangoutLink gracefully', async () => {
    mockInsert.mockResolvedValue({
      data: {
        id: 'gcal-evt-2',
        hangoutLink: null,
        conferenceData: {
          entryPoints: [{ uri: 'https://meet.google.com/fallback' }],
        },
      },
    })
    const supabase = makeSupabase('evt-2')

    const result = await meetingBookHandler.execute(
      {
        connector_id: CONNECTOR_ID,
        title: 'Meeting Without Link',
        start: '2026-03-15T10:00:00Z',
        end: '2026-03-15T10:30:00Z',
        attendees: [],
      },
      CTX,
      supabase
    )

    expect(result.status).toBe('completed')
  })
})
