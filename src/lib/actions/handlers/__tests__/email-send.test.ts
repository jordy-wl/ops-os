import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Google services ───────────────────────────────────────────────────

const mockSend = vi.fn()

vi.mock('@/lib/integrations/google-client', () => ({
  getGoogleServices: vi.fn().mockResolvedValue({
    gmail: {
      users: {
        messages: {
          send: (...args: unknown[]) => mockSend(...args),
        },
      },
    },
    calendar: {},
    drive: {},
    auth: {},
  }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { emailSendHandler } from '../email-send'
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

describe('emailSendHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('schema validates a correct payload', () => {
    const result = emailSendHandler.schema.safeParse({
      connector_id: CONNECTOR_ID,
      to: 'test@example.com',
      subject: 'Hello',
      body: '<p>Hi there</p>',
    })
    expect(result.success).toBe(true)
  })

  it('schema rejects missing required fields', () => {
    const result = emailSendHandler.schema.safeParse({
      connector_id: CONNECTOR_ID,
      // missing to, subject, body
    })
    expect(result.success).toBe(false)
  })

  it('schema rejects invalid email', () => {
    const result = emailSendHandler.schema.safeParse({
      connector_id: CONNECTOR_ID,
      to: 'not-an-email',
      subject: 'Hello',
      body: 'Body',
    })
    expect(result.success).toBe(false)
  })

  it('schema rejects invalid connector_id', () => {
    const result = emailSendHandler.schema.safeParse({
      connector_id: 'not-a-uuid',
      to: 'test@example.com',
      subject: 'Hello',
      body: 'Body',
    })
    expect(result.success).toBe(false)
  })

  it('execute sends email and records event', async () => {
    mockSend.mockResolvedValue({ data: { id: 'gmail-msg-1' } })
    const supabase = makeSupabase('evt-1')

    const result = await emailSendHandler.execute(
      {
        connector_id: CONNECTOR_ID,
        to: 'test@example.com',
        subject: 'Test Subject',
        body: '<p>Test body</p>',
      },
      CTX,
      supabase
    )

    expect(result.status).toBe('completed')
    expect(result.actionId).toBeTypeOf('string')
    expect(result.eventId).toBe('evt-1')
    expect(mockSend).toHaveBeenCalledOnce()

    // Verify Gmail API was called with correct structure
    const sendArgs = mockSend.mock.calls[0][0]
    expect(sendArgs.userId).toBe('me')
    expect(sendArgs.requestBody.raw).toBeTypeOf('string')
  })

  it('execute throws on Gmail API failure', async () => {
    mockSend.mockRejectedValue(new Error('Gmail quota exceeded'))
    const supabase = makeSupabase()

    await expect(
      emailSendHandler.execute(
        {
          connector_id: CONNECTOR_ID,
          to: 'test@example.com',
          subject: 'Test',
          body: 'Body',
        },
        CTX,
        supabase
      )
    ).rejects.toThrow('Gmail send failed: Gmail quota exceeded')
  })

  it('execute handles optional cc and bcc', async () => {
    mockSend.mockResolvedValue({ data: { id: 'gmail-msg-2' } })
    const supabase = makeSupabase('evt-2')

    const result = await emailSendHandler.execute(
      {
        connector_id: CONNECTOR_ID,
        to: 'test@example.com',
        subject: 'With CC',
        body: 'Body',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
      },
      CTX,
      supabase
    )

    expect(result.status).toBe('completed')

    // Verify the raw message includes Cc and Bcc headers
    const rawBase64 = mockSend.mock.calls[0][0].requestBody.raw
    const decoded = Buffer.from(rawBase64, 'base64url').toString()
    expect(decoded).toContain('Cc: cc@example.com')
    expect(decoded).toContain('Bcc: bcc@example.com')
  })
})
