import { PERMISSIONS } from '@/lib/rbac/types'
import type { AuthContext } from '@/lib/auth/withAuth'
import { interpolateTemplate, buildStepVariables } from '../step-engine'
import type { StepHandler } from './types'

const SYSTEM_CTX: AuthContext = {
  userId: 'system', clerkOrgId: '', orgId: '', role: 'ops-admin',
  roleId: '', permissions: new Set(PERMISSIONS),
}

const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()

  if (!step.connector_id) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing connector_id', executed_at: now }
  }

  const { REGISTRY } = await import('@/lib/actions/registry')
  const actionHandler = REGISTRY['email.send']
  if (!actionHandler) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'email.send handler not registered', executed_at: now }
  }

  // Fetch source block for template variable interpolation
  const { data: sourceBlock } = await supabase
    .from('blocks')
    .select('id, name, type, metadata')
    .eq('id', meta.source_block_id)
    .single()

  const blockVars: Record<string, unknown> = sourceBlock
    ? { id: sourceBlock.id, name: sourceBlock.name, type: sourceBlock.type, ...(sourceBlock.metadata as Record<string, unknown> ?? {}) }
    : { id: meta.source_block_id }

  const contextVars: Record<string, unknown> = {
    template_id: meta.template_id,
    source_block_id: meta.source_block_id,
    applies_to_type: meta.applies_to_type,
  }

  const stepVars = buildStepVariables(meta.step_results)
  const vars = { block: blockVars, context: contextVars, steps: stepVars }

  const stepAny = step as Record<string, unknown>
  const rawTo = (stepAny.to as string) ?? ''
  const rawSubject = (stepAny.subject as string) ?? step.name
  const rawBody = (stepAny.body as string) ?? ''

  const emailPayload = {
    connector_id: step.connector_id,
    to: interpolateTemplate(rawTo, vars),
    subject: interpolateTemplate(rawSubject, vars),
    body: interpolateTemplate(rawBody, vars),
    block_id: meta.source_block_id,
  }

  const emailResult = await actionHandler.execute(emailPayload, { ...SYSTEM_CTX, orgId }, supabase)
  return {
    step_name: step.name,
    step_type: step.type,
    status: emailResult.status === 'completed' ? 'completed' : 'failed',
    output: { action_id: emailResult.actionId, event_id: emailResult.eventId },
    executed_at: now,
  }
}

export default handler
