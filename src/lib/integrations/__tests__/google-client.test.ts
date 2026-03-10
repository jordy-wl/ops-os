import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Set env vars FIRST via vi.hoisted (runs before vi.mock and imports) ────

vi.hoisted(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/auth/google/callback'
})

// ─── Mock googleapis ────────────────────────────────────────────────────────

const mockGenerateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?test=1')
const mockGetToken = vi.fn().mockResolvedValue({ tokens: { refresh_token: 'rt_123', access_token: 'at_123' } })
const mockSetCredentials = vi.fn()
const mockOn = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn().mockImplementation(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        setCredentials: mockSetCredentials,
        on: mockOn,
      })),
    },
    gmail: vi.fn().mockReturnValue({ users: { messages: { send: vi.fn() } } }),
    calendar: vi.fn().mockReturnValue({ events: { insert: vi.fn() } }),
    drive: vi.fn().mockReturnValue({ files: { create: vi.fn() } }),
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { createOAuth2Client, getAuthUrl, exchangeCode, getGoogleServices } from '../google-client'
import { createServerClient } from '@/lib/supabase/server'

describe('google-client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createOAuth2Client', () => {
    it('creates an OAuth2 client with env vars', () => {
      const client = createOAuth2Client()
      expect(client).toBeDefined()
    })
  })

  describe('getAuthUrl', () => {
    it('generates a consent URL with state parameter', () => {
      const url = getAuthUrl('some-state')
      expect(url).toBeTypeOf('string')
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          prompt: 'consent',
          state: 'some-state',
        })
      )
    })
  })

  describe('exchangeCode', () => {
    it('exchanges auth code for tokens', async () => {
      const tokens = await exchangeCode('auth-code-123')
      expect(tokens).toEqual({ refresh_token: 'rt_123', access_token: 'at_123' })
      expect(mockGetToken).toHaveBeenCalledWith('auth-code-123')
    })
  })

  describe('getGoogleServices', () => {
    it('returns gmail, calendar, drive API instances', async () => {
      const connectorId = '00000000-0000-0000-0000-000000000001'
      const orgId = 'org-1'

      const singleFn = vi.fn().mockResolvedValue({
        data: {
          id: connectorId,
          config: { refresh_token: 'rt_stored', access_token: 'at_stored' },
        },
        error: null,
      })
      const chain = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: singleFn,
      }
      vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)

      const services = await getGoogleServices(connectorId, orgId)

      expect(services.gmail).toBeDefined()
      expect(services.calendar).toBeDefined()
      expect(services.drive).toBeDefined()
      expect(services.auth).toBeDefined()
      expect(mockSetCredentials).toHaveBeenCalledWith({
        refresh_token: 'rt_stored',
        access_token: 'at_stored',
      })
    })

    it('throws when connector not found', async () => {
      const singleFn = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      const chain = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: singleFn,
      }
      vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)

      await expect(getGoogleServices('bad-id', 'org-1')).rejects.toThrow('Google connector not found')
    })

    it('throws when no refresh token', async () => {
      const singleFn = vi.fn().mockResolvedValue({
        data: { id: 'conn-1', config: {} },
        error: null,
      })
      const chain = {
        from: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: singleFn,
      }
      vi.mocked(createServerClient).mockReturnValue(chain as unknown as ReturnType<typeof createServerClient>)

      await expect(getGoogleServices('conn-1', 'org-1')).rejects.toThrow('no refresh token')
    })
  })
})
