/**
 * Shared Links — generates token-authenticated URLs for public access.
 * Tokens are cryptographically random, stored in DB, and time-limited.
 */

import { randomBytes, createHash } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const TOKEN_BYTES = 32 // 32 bytes = 64 hex chars
const TOKEN_PREFIX = 'sl_'

export type ShareType = 'view' | 'submit' | 'sign' | 'portal'

export interface SharedLink {
  id: string
  org_id: string
  block_id: string
  token: string
  share_type: ShareType
  permissions: Record<string, unknown>
  form_schema: Record<string, unknown> | null
  expires_at: string
  created_by: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CreateSharedLinkInput {
  blockId: string
  shareType: ShareType
  expiresInHours?: number
  formSchema?: Record<string, unknown>
  permissions?: Record<string, unknown>
}

/**
 * Generates a cryptographically secure share token.
 */
export function generateShareToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('hex')}`
}

/**
 * Creates a shared link for a block.
 */
export async function createSharedLink(
  orgId: string,
  userId: string,
  input: CreateSharedLinkInput
): Promise<{ link: SharedLink } | { error: string; code: string }> {
  const supabase = createServerClient()
  const token = generateShareToken()
  const expiresAt = new Date(
    Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000
  ).toISOString()

  const { data: link, error } = await supabase
    .from('shared_links')
    .insert({
      org_id: orgId,
      block_id: input.blockId,
      token,
      share_type: input.shareType,
      permissions: input.permissions ?? {},
      form_schema: input.formSchema ?? null,
      expires_at: expiresAt,
      created_by: userId,
    })
    .select('*')
    .single()

  if (error || !link) {
    logger.error('shared-links', 'link.create_failed', {
      org_id: orgId,
      error_code: error?.code,
    })
    return { error: 'Failed to create shared link', code: 'shared-links/create-failed' }
  }

  // Audit event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: input.blockId,
    type: 'shared_link.created',
    payload: {
      link_id: link.id,
      share_type: input.shareType,
      expires_at: expiresAt,
    },
    actor_id: userId,
  })

  logger.info('shared-links', 'link.created', {
    org_id: orgId,
    link_id: link.id,
    share_type: input.shareType,
  })

  return { link: link as SharedLink }
}

/**
 * Validates a share token — checks existence, expiry, and active status.
 * Used by public routes to authenticate requests without Clerk.
 */
export async function validateShareToken(
  token: string
): Promise<
  | { valid: true; link: SharedLink }
  | { valid: false; reason: string }
> {
  const supabase = createServerClient()

  const { data: link, error } = await supabase
    .from('shared_links')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !link) {
    return { valid: false, reason: 'Link not found' }
  }

  if (!link.is_active) {
    return { valid: false, reason: 'Link has been deactivated' }
  }

  if (new Date(link.expires_at) < new Date()) {
    return { valid: false, reason: 'Link has expired' }
  }

  return { valid: true, link: link as SharedLink }
}

/**
 * Lists shared links for a block.
 */
export async function listSharedLinks(
  orgId: string,
  blockId?: string
): Promise<{ links: SharedLink[] } | { error: string; code: string }> {
  const supabase = createServerClient()

  let query = supabase
    .from('shared_links')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (blockId) {
    query = query.eq('block_id', blockId)
  }

  const { data: links, error } = await query

  if (error) {
    logger.error('shared-links', 'link.list_failed', {
      org_id: orgId,
      error_code: error.code,
    })
    return { error: 'Failed to list shared links', code: 'shared-links/list-failed' }
  }

  return { links: (links ?? []) as SharedLink[] }
}

/**
 * Deactivates a shared link (soft delete).
 */
export async function deactivateSharedLink(
  linkId: string,
  orgId: string,
  userId: string
): Promise<{ success: true } | { error: string; code: string; status: number }> {
  const supabase = createServerClient()

  const { data: link, error: fetchError } = await supabase
    .from('shared_links')
    .select('id, block_id, is_active')
    .eq('id', linkId)
    .eq('org_id', orgId)
    .single()

  if (fetchError || !link) {
    return { error: 'Shared link not found', code: 'shared-links/not-found', status: 404 }
  }

  if (!link.is_active) {
    return { error: 'Link is already deactivated', code: 'shared-links/already-inactive', status: 409 }
  }

  const { error: updateError } = await supabase
    .from('shared_links')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', linkId)

  if (updateError) {
    logger.error('shared-links', 'link.deactivate_failed', {
      org_id: orgId,
      link_id: linkId,
      error_code: updateError.code,
    })
    return { error: 'Failed to deactivate link', code: 'shared-links/deactivate-failed', status: 500 }
  }

  // Audit event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: link.block_id,
    type: 'shared_link.deactivated',
    payload: { link_id: linkId },
    actor_id: userId,
  })

  logger.info('shared-links', 'link.deactivated', {
    org_id: orgId,
    link_id: linkId,
  })

  return { success: true }
}
