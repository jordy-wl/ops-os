import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/integrations/google-client'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback. Exchanges code for tokens and stores them
 * in an integration_connectors row (upsert: one Google connector per org).
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    logger.warn('google-oauth', 'oauth.user_denied', { error: errorParam })
    return NextResponse.redirect(new URL('/integrations?google=denied', req.url))
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/integrations?google=error', req.url))
  }

  let orgId: string
  let userId: string

  try {
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64url').toString())
    orgId = decoded.orgId
    userId = decoded.userId
    if (!orgId || !userId) throw new Error('Invalid state')
  } catch {
    logger.error('google-oauth', 'oauth.invalid_state', {})
    return NextResponse.redirect(new URL('/integrations?google=error', req.url))
  }

  try {
    const tokens = await exchangeCode(code)

    if (!tokens.refresh_token) {
      logger.error('google-oauth', 'oauth.no_refresh_token', { org_id: orgId })
      return NextResponse.redirect(new URL('/integrations?google=no_refresh', req.url))
    }

    const supabase = createServerClient()

    // Check if a Google connector already exists for this org
    const { data: existing } = await supabase
      .from('integration_connectors')
      .select('id')
      .eq('org_id', orgId)
      .eq('provider', 'google')
      .neq('status', 'archived')
      .maybeSingle()

    // Parse granted scopes — since Jan 2026, users can selectively deny scopes
    const grantedScopes = tokens.scope ? tokens.scope.split(' ') : []
    const connectorConfig = {
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? null,
      token_expiry: tokens.expiry_date ?? null,
      scope: tokens.scope ?? null,
      granted_scopes: grantedScopes,
      has_gmail_send: grantedScopes.includes('https://www.googleapis.com/auth/gmail.send'),
      has_calendar: grantedScopes.includes('https://www.googleapis.com/auth/calendar.events'),
      has_drive: grantedScopes.includes('https://www.googleapis.com/auth/drive.file'),
      connected_by: userId,
      connected_at: new Date().toISOString(),
    }

    if (existing) {
      // Update existing connector
      const { error: updateError } = await supabase
        .from('integration_connectors')
        .update({
          config: connectorConfig,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)

      if (updateError) {
        logger.error('google-oauth', 'oauth.update_failed', {
          connector_id: existing.id,
          error_code: updateError.code,
        })
        return NextResponse.redirect(new URL('/integrations?google=error', req.url))
      }

      logger.info('google-oauth', 'oauth.reconnected', {
        connector_id: existing.id,
        org_id: orgId,
      })
    } else {
      // Create new connector
      const { error: insertError } = await supabase
        .from('integration_connectors')
        .insert({
          org_id: orgId,
          provider: 'google',
          name: 'Google Workspace',
          direction: 'bidirectional',
          config: connectorConfig,
          status: 'active',
          created_by: userId,
        })

      if (insertError) {
        logger.error('google-oauth', 'oauth.insert_failed', { error_code: insertError.code })
        return NextResponse.redirect(new URL('/integrations?google=error', req.url))
      }

      logger.info('google-oauth', 'oauth.connected', { org_id: orgId })
    }

    return NextResponse.redirect(new URL('/integrations?google=connected', req.url))
  } catch (err) {
    logger.error('google-oauth', 'oauth.exchange_failed', {
      error: err instanceof Error ? err.message : 'Unknown',
    })
    return NextResponse.redirect(new URL('/integrations?google=error', req.url))
  }
}
