import { logger } from '@/lib/logger'
import { generateShareToken } from '@/lib/shared-links'
import type { StepHandler } from './types'

/**
 * create_shared_link handler — creates a shared link for a block (client portal access).
 *
 * Step config:
 * - link_block_id: target block ID (defaults to source block)
 * - link_type: 'view' | 'form' | 'sign' (default 'view')
 * - link_expires_hours: hours until expiry (default 168 = 7 days)
 */
const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()
  const stepAny = step as Record<string, unknown>

  const blockId = (stepAny.link_block_id as string) ?? meta.source_block_id
  const linkType = (stepAny.link_type as string) ?? 'view'
  const expiresHours = (stepAny.link_expires_hours as number) ?? 168

  // Generate a secure token (sl_ prefix for shared links)
  const token = generateShareToken()

  // Calculate expiry
  const expiresAt = new Date(Date.now() + expiresHours * 3600000).toISOString()

  const { data: link, error } = await supabase
    .from('shared_links')
    .insert({
      org_id: orgId,
      block_id: blockId,
      token,
      share_type: linkType,
      permissions: {},
      form_schema: null,
      expires_at: expiresAt,
      is_active: true,
      created_by: 'workflow',
    })
    .select('id, token')
    .single()

  if (error || !link) {
    logger.error('step-engine', 'step.create_shared_link_failed', { error_code: error?.code })
    return { step_name: step.name, step_type: step.type, status: 'failed', error: error?.message ?? 'Failed to create shared link', executed_at: now }
  }

  // Emit event on the target block
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: blockId,
    type: 'shared_link.created',
    actor_type: 'workflow',
    payload: {
      link_id: link.id,
      link_type: linkType,
      expires_at: expiresAt,
      step_name: step.name,
      workflow_instance_id: meta.template_id,
    },
  })

  logger.info('step-engine', 'step.create_shared_link_completed', {
    link_id: link.id,
    block_id: blockId,
    type: linkType,
  })

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'completed',
    output: {
      link_id: link.id,
      token: link.token,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/shared/${link.token}`,
      block_id: blockId,
      type: linkType,
      expires_at: expiresAt,
    },
    executed_at: now,
  }
}

export default handler
