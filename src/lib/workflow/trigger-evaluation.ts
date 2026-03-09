import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { WorkflowTemplate } from './template-schema'

interface WebhookTriggerConfig {
  connector_id: string
  event_type_mapping?: Record<string, string>  // external_type -> internal_type
}

/**
 * Evaluate event triggers — check if any workflow_template has an event trigger
 * matching the given event type for the given block type. If found, spawn a
 * workflow instance automatically.
 *
 * Called after event insertion (fire-and-forget). Failures are logged, not thrown.
 *
 * Anti-loop: skips events emitted by workflows (actor_type = 'workflow' or 'system').
 */
export async function evaluateEventTriggers(
  orgId: string,
  blockId: string,
  blockType: string,
  eventType: string,
  actorType: string
): Promise<void> {
  // Prevent infinite loops: skip events emitted by workflow steps or system
  if (actorType === 'workflow' || actorType === 'system') {
    return
  }

  const supabase = createServerClient()

  // Find all workflow_template blocks for this org that apply to this block type
  const { data: templates, error: queryError } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('org_id', orgId)
    .eq('type', 'workflow_template')

  if (queryError || !templates) {
    logger.error('trigger-eval', 'trigger.query_failed', { error_code: queryError?.code })
    return
  }

  for (const tmpl of templates) {
    const meta = tmpl.metadata as WorkflowTemplate
    if (!meta || !meta.trigger || !meta.applies_to_type || !meta.steps) continue

    // Check: applies to this block type?
    if (meta.applies_to_type !== blockType) continue

    // Check: event trigger with matching pattern?
    if (meta.trigger.type !== 'event') continue
    if (meta.trigger.event_pattern !== eventType) continue

    // Match found — spawn a workflow instance
    try {
      const now = new Date().toISOString()
      const instanceName = `Auto: ${tmpl.metadata?.description || 'Workflow'} — ${eventType}`

      const { data: instance, error: insertError } = await supabase
        .from('blocks')
        .insert({
          org_id: orgId,
          type: 'workflow_instance',
          name: instanceName.slice(0, 255),
          metadata: {
            template_id: tmpl.id,
            source_block_id: blockId,
            applies_to_type: blockType,
            status: 'pending',
            current_step_index: 0,
            step_results: [],
            started_at: null,
            completed_at: null,
          },
        })
        .select('id')
        .single()

      if (insertError || !instance) {
        logger.error('trigger-eval', 'trigger.spawn_failed', {
          template_id: tmpl.id,
          error_code: insertError?.code,
        })
        continue
      }

      // Create block edges: instance_of + processing
      await supabase.from('block_edges').insert([
        { org_id: orgId, from_block_id: instance.id, to_block_id: tmpl.id, edge_type: 'instance_of' },
        { org_id: orgId, from_block_id: instance.id, to_block_id: blockId, edge_type: 'processing' },
      ])

      // Emit spawned event
      await supabase.from('events').insert({
        org_id: orgId,
        block_id: instance.id,
        type: 'workflow.instance.spawned',
        actor_id: 'trigger-evaluator',
        actor_type: 'system',
        payload: {
          template_id: tmpl.id,
          source_block_id: blockId,
          trigger_type: 'event',
          trigger_event: eventType,
          spawned_at: now,
        },
      })

      logger.info('trigger-eval', 'trigger.auto_spawned', {
        template_id: tmpl.id,
        instance_id: instance.id,
        event_type: eventType,
      })
    } catch (err) {
      logger.error('trigger-eval', 'trigger.spawn_error', {
        template_id: tmpl.id,
        error: err instanceof Error ? err.message : 'Unknown',
      })
    }
  }
}

/**
 * Evaluate webhook triggers — check if any workflow_template has a webhook trigger
 * matching the given connector_id. If found, spawn workflow instances.
 *
 * Called after webhook receipt (fire-and-forget). Failures are logged, not thrown.
 *
 * Anti-loop: webhook-spawned workflows use actor_type='system' which is filtered
 * by evaluateEventTriggers, preventing cascade.
 *
 * @returns number of workflow instances spawned
 */
export async function evaluateWebhookTriggers(
  connectorId: string,
  webhookPayload: Record<string, unknown>,
  orgId: string
): Promise<number> {
  const supabase = createServerClient()
  let spawned = 0

  // Find all workflow_template blocks for this org
  const { data: templates, error: queryError } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('org_id', orgId)
    .eq('type', 'workflow_template')

  if (queryError || !templates) {
    logger.error('webhook-trigger', 'trigger.query_failed', { error_code: queryError?.code })
    return 0
  }

  for (const tmpl of templates) {
    const meta = tmpl.metadata as WorkflowTemplate & { trigger: { type: string; config?: WebhookTriggerConfig } }
    if (!meta || !meta.trigger || !meta.steps) continue

    // Check: webhook trigger type?
    if (meta.trigger.type !== 'webhook') continue

    // Check: connector_id matches?
    const triggerConfig = meta.trigger.config as WebhookTriggerConfig | undefined
    if (!triggerConfig?.connector_id || triggerConfig.connector_id !== connectorId) continue

    // Match found — resolve event type via mapping
    const externalType = (webhookPayload.type ?? webhookPayload.event ?? webhookPayload.action ?? 'webhook.received') as string
    const mapping = triggerConfig.event_type_mapping ?? {}
    const internalType = mapping[externalType] ?? externalType

    // Resolve block_id from payload or skip if none
    const blockId = webhookPayload.block_id as string | undefined
    if (!blockId) {
      logger.debug('webhook-trigger', 'trigger.no_block_id', {
        template_id: tmpl.id,
        connector_id: connectorId,
      })
      continue
    }

    try {
      const now = new Date().toISOString()
      const instanceName = `Webhook: ${internalType} — ${connectorId.slice(0, 8)}`

      const { data: instance, error: insertError } = await supabase
        .from('blocks')
        .insert({
          org_id: orgId,
          type: 'workflow_instance',
          name: instanceName.slice(0, 255),
          metadata: {
            template_id: tmpl.id,
            source_block_id: blockId,
            applies_to_type: meta.applies_to_type,
            status: 'pending',
            current_step_index: 0,
            step_results: [],
            started_at: null,
            completed_at: null,
            trigger_context: {
              type: 'webhook',
              connector_id: connectorId,
              external_event: externalType,
              mapped_event: internalType,
            },
          },
        })
        .select('id')
        .single()

      if (insertError || !instance) {
        logger.error('webhook-trigger', 'trigger.spawn_failed', {
          template_id: tmpl.id,
          error_code: insertError?.code,
        })
        continue
      }

      // Create block edges
      await supabase.from('block_edges').insert([
        { org_id: orgId, from_block_id: instance.id, to_block_id: tmpl.id, edge_type: 'instance_of' },
        { org_id: orgId, from_block_id: instance.id, to_block_id: blockId, edge_type: 'processing' },
      ])

      // Emit spawned event
      await supabase.from('events').insert({
        org_id: orgId,
        block_id: instance.id,
        type: 'workflow.instance.spawned',
        actor_id: 'webhook-trigger-evaluator',
        actor_type: 'system',
        payload: {
          template_id: tmpl.id,
          source_block_id: blockId,
          trigger_type: 'webhook',
          connector_id: connectorId,
          external_event: externalType,
          mapped_event: internalType,
          spawned_at: now,
        },
      })

      logger.info('webhook-trigger', 'trigger.auto_spawned', {
        template_id: tmpl.id,
        instance_id: instance.id,
        connector_id: connectorId,
      })
      spawned++
    } catch (err) {
      logger.error('webhook-trigger', 'trigger.spawn_error', {
        template_id: tmpl.id,
        error: err instanceof Error ? err.message : 'Unknown',
      })
    }
  }

  return spawned
}
