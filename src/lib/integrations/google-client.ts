import { google } from 'googleapis'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
]

/**
 * Create an OAuth2 client for initiating the consent flow.
 */
export function createOAuth2Client() {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error('Missing Google OAuth environment variables')
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
}

/**
 * Generate the Google OAuth consent URL.
 */
export function getAuthUrl(state: string): string {
  const oauth2 = createOAuth2Client()
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  })
}

/**
 * Exchange an auth code for tokens.
 */
export async function exchangeCode(code: string) {
  const oauth2 = createOAuth2Client()
  const { tokens } = await oauth2.getToken(code)
  return tokens
}

/**
 * Get an authenticated Google OAuth2 client for a given connector.
 * Automatically refreshes the access token if expired.
 */
export async function getGoogleClient(connectorId: string, orgId: string) {
  const supabase = createServerClient()

  const { data: connector, error } = await supabase
    .from('integration_connectors')
    .select('id, config')
    .eq('id', connectorId)
    .eq('org_id', orgId)
    .single()

  if (error || !connector) {
    throw new Error(`Google connector not found: ${connectorId}`)
  }

  const config = connector.config as Record<string, unknown> | null
  const refreshToken = config?.refresh_token as string | undefined
  const accessToken = config?.access_token as string | undefined

  if (!refreshToken) {
    throw new Error('Google connector has no refresh token — re-authorize')
  }

  const oauth2 = createOAuth2Client()
  oauth2.setCredentials({
    refresh_token: refreshToken,
    access_token: accessToken,
  })

  // Listen for token refresh and persist new access token
  oauth2.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      const updatedConfig = { ...config, access_token: tokens.access_token }
      if (tokens.expiry_date) {
        (updatedConfig as Record<string, unknown>).token_expiry = tokens.expiry_date
      }
      await supabase
        .from('integration_connectors')
        .update({ config: updatedConfig, updated_at: new Date().toISOString() })
        .eq('id', connectorId)
        .eq('org_id', orgId)

      logger.info('google-client', 'token.refreshed', { connector_id: connectorId })
    }
  })

  return oauth2
}

/**
 * Get Google API service instances for a connector.
 */
export async function getGoogleServices(connectorId: string, orgId: string) {
  const auth = await getGoogleClient(connectorId, orgId)
  return {
    gmail: google.gmail({ version: 'v1', auth }),
    calendar: google.calendar({ version: 'v3', auth }),
    drive: google.drive({ version: 'v3', auth }),
    auth,
  }
}

export { SCOPES }
