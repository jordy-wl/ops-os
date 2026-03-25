import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * Spawn a workflow instance from a portal request submission.
 *
 * Creates the workflow_instance block, block_edges (instance_of + processing),
 * and an audit event. Follows the same spawn pattern as trigger-evaluation.ts
 * (evaluateEventTriggers / evaluateWebhookTriggers).
 *
 * Called from the portal requests POST handler when a request includes a
 * workflow_template_id. Failures return an error string rather than throwing.
 *
 * @param orgId            - The org that owns the portal
 * @param templateId       - The workflow_template block ID to instantiate
 * @param clientBlockId    - The client block this request is associated with
 * @param formSubmissionId - The form_submission row ID for audit trail
 * @param fieldData        - The submitted field data from the portal request
 * @returns instanceId on success, error string on failure
 */
export async function spawnPortalWorkflow(
  orgId: string,
  templateId: string,
  clientBlockId: string,
  formSubmissionId: string,
  fieldData: Record<string, unknown>
): Promise<{ instanceId: string } | { error: string }> {
  const supabase = createServerClient()

  // 1. Fetch the workflow_template block to get name and applies_to_type
  const { data: template, error: templateError } = await supabase
    .from('blocks')
    .select('id, name, metadata')
    .eq('id', templateId)
    .eq('type', 'workflow_template')
    .single()

  if (templateError || !template) {
    logger.error('portal-trigger', 'trigger.template_not_found', {
      template_id: templateId,
      org_id: orgId,
      error_code: templateError?.code,
    })
    return { error: 'Workflow template not found' }
  }

  const templateMeta = (template.metadata ?? {}) as Record<string, unknown>
  const appliesToType = (templateMeta.applies_to_type as string) ?? null

  // 2. Insert workflow_instance block
  const now = new Date().toISOString()
  const instanceName = `Portal Request: ${template.name ?? 'Workflow'}`.slice(0, 255)

  const { data: instance, error: insertError } = await supabase
    .from('blocks')
    .insert({
      org_id: orgId,
      type: 'workflow_instance',
      name: instanceName,
      metadata: {
        template_id: templateId,
        source_block_id: clientBlockId,
        applies_to_type: appliesToType,
        status: 'pending',
        current_step_index: 0,
        step_results: [],
        started_at: null,
        completed_at: null,
        trigger_context: {
          type: 'portal_request',
          form_submission_id: formSubmissionId,
          field_data: fieldData,
        },
      },
    })
    .select('id')
    .single()

  if (insertError || !instance) {
    logger.error('portal-trigger', 'trigger.instance_insert_failed', {
      template_id: templateId,
      org_id: orgId,
      error_code: insertError?.code,
    })
    return { error: 'Failed to create workflow instance' }
  }

  // 3. Create block_edges: instance_of + processing
  const { error: edgesError } = await supabase.from('block_edges').insert([
    { org_id: orgId, from_block_id: instance.id, to_block_id: templateId, edge_type: 'instance_of' },
    { org_id: orgId, from_block_id: instance.id, to_block_id: clientBlockId, edge_type: 'processing' },
  ])

  if (edgesError) {
    logger.warn('portal-trigger', 'trigger.edges_insert_failed', {
      instance_id: instance.id,
      error_code: edgesError.code,
    })
    // Non-fatal: the instance was created; edges are supplementary
  }

  // 4. Insert audit event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: instance.id,
    type: 'workflow.instance.spawned',
    actor_id: 'portal',
    actor_type: 'system',
    payload: {
      template_id: templateId,
      source_block_id: clientBlockId,
      trigger_type: 'portal_request',
      form_submission_id: formSubmissionId,
      spawned_at: now,
    },
  })

  logger.info('portal-trigger', 'trigger.portal_spawned', {
    template_id: templateId,
    instance_id: instance.id,
    form_submission_id: formSubmissionId,
    org_id: orgId,
  })

  return { instanceId: instance.id }
}
