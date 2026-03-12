import { randomBytes, createHash } from 'crypto'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const KEY_PREFIX_TAG = 'ops_'
const KEY_RANDOM_BYTES = 16 // 16 bytes = 32 hex chars
const DISPLAY_PREFIX_LENGTH = 8 // first 8 chars of the full key for identification

/**
 * Hashes an API key using SHA-256.
 * Deterministic: same input always produces the same hash.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/**
 * Generates a new API key with the format `ops_` + 32 random hex chars.
 * Returns the full key (shown once), the display prefix, and the SHA-256 hash.
 */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const randomHex = randomBytes(KEY_RANDOM_BYTES).toString('hex')
  const key = `${KEY_PREFIX_TAG}${randomHex}`
  const prefix = key.substring(0, DISPLAY_PREFIX_LENGTH)
  const hash = hashApiKey(key)

  return { key, prefix, hash }
}

/**
 * Creates an API key for an org: generates, stores hash + prefix, logs event.
 * Returns the full key (shown once to the user) plus metadata.
 */
export async function createApiKey(
  orgId: string,
  userId: string,
  name: string
): Promise<{ key: string; keyId: string; prefix: string } | { error: string; code: string }> {
  const supabase = createServerClient()
  const { key, prefix, hash } = generateApiKey()

  // Insert the key record (hash only, never the full key)
  const { data: keyRow, error: insertError } = await supabase
    .from('api_keys')
    .insert({
      org_id: orgId,
      name,
      key_prefix: prefix,
      key_hash: hash,
      created_by: userId,
    })
    .select('id')
    .single()

  if (insertError || !keyRow) {
    logger.error('api-keys', 'api_key.create_failed', {
      org_id: orgId,
      error_code: insertError?.code,
    })
    return { error: 'Failed to create API key', code: 'api-keys/create-failed' }
  }

  // Log audit event — never include the full key
  const { error: eventError } = await supabase.from('events').insert({
    org_id: orgId,
    block_id: null,
    type: 'api_key.created',
    payload: { key_id: keyRow.id, key_prefix: prefix, name },
    actor_id: userId,
  })

  if (eventError) {
    logger.warn('api-keys', 'api_key.event_log_failed', {
      org_id: orgId,
      key_id: keyRow.id,
      error_code: eventError.code,
    })
  }

  logger.info('api-keys', 'api_key.created', {
    org_id: orgId,
    key_id: keyRow.id,
    key_prefix: prefix,
  })

  return { key, keyId: keyRow.id, prefix }
}

/**
 * Validates an API key: hashes it, looks up in api_keys table,
 * checks it is not revoked, and updates last_used_at.
 */
export async function validateApiKey(
  key: string,
  orgId: string
): Promise<{ valid: true; keyId: string } | { valid: false; reason: string }> {
  const supabase = createServerClient()
  const hash = hashApiKey(key)

  const { data: keyRow, error } = await supabase
    .from('api_keys')
    .select('id, revoked_at')
    .eq('key_hash', hash)
    .eq('org_id', orgId)
    .single()

  if (error || !keyRow) {
    return { valid: false, reason: 'Key not found' }
  }

  if (keyRow.revoked_at) {
    return { valid: false, reason: 'Key has been revoked' }
  }

  // Update last_used_at (fire-and-forget — don't block validation)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id)
    .then(() => {
      // intentionally empty — fire and forget
    })

  return { valid: true, keyId: keyRow.id }
}

/**
 * Revokes an API key by setting revoked_at. Logs audit event.
 */
export async function revokeApiKey(
  keyId: string,
  orgId: string,
  userId: string
): Promise<{ success: true } | { error: string; code: string; status: number }> {
  const supabase = createServerClient()

  // Verify key exists and belongs to org
  const { data: keyRow, error: fetchError } = await supabase
    .from('api_keys')
    .select('id, key_prefix, revoked_at')
    .eq('id', keyId)
    .eq('org_id', orgId)
    .single()

  if (fetchError || !keyRow) {
    return { error: 'API key not found', code: 'api-keys/not-found', status: 404 }
  }

  if (keyRow.revoked_at) {
    return { error: 'API key is already revoked', code: 'api-keys/already-revoked', status: 409 }
  }

  // Set revoked_at
  const { error: updateError } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)

  if (updateError) {
    logger.error('api-keys', 'api_key.revoke_failed', {
      org_id: orgId,
      key_id: keyId,
      error_code: updateError.code,
    })
    return { error: 'Failed to revoke API key', code: 'api-keys/revoke-failed', status: 500 }
  }

  // Log audit event
  const { error: eventError } = await supabase.from('events').insert({
    org_id: orgId,
    block_id: null,
    type: 'api_key.revoked',
    payload: { key_id: keyId, key_prefix: keyRow.key_prefix },
    actor_id: userId,
  })

  if (eventError) {
    logger.warn('api-keys', 'api_key.revoke_event_log_failed', {
      org_id: orgId,
      key_id: keyId,
      error_code: eventError.code,
    })
  }

  logger.info('api-keys', 'api_key.revoked', {
    org_id: orgId,
    key_id: keyId,
    key_prefix: keyRow.key_prefix,
  })

  return { success: true }
}

/**
 * Lists API keys for an org with masked display.
 * Returns prefix + "****" for each key — never the full key.
 */
export async function listApiKeys(orgId: string): Promise<
  | {
      keys: Array<{
        id: string
        name: string
        display_key: string
        created_by: string
        created_at: string
        revoked_at: string | null
        last_used_at: string | null
        rate_limit: number
      }>
    }
  | { error: string; code: string }
> {
  const supabase = createServerClient()

  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, created_by, created_at, revoked_at, last_used_at, rate_limit')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('api-keys', 'api_key.list_failed', {
      org_id: orgId,
      error_code: error.code,
    })
    return { error: 'Failed to list API keys', code: 'api-keys/list-failed' }
  }

  return {
    keys: (keys ?? []).map((k) => ({
      id: k.id,
      name: k.name,
      display_key: `${k.key_prefix}****`,
      created_by: k.created_by,
      created_at: k.created_at,
      revoked_at: k.revoked_at,
      last_used_at: k.last_used_at,
      rate_limit: k.rate_limit,
    })),
  }
}
