import { PERMISSIONS } from '@/lib/rbac/types'
import type { AuthContext } from '@/lib/auth/withAuth'
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

  const stepAny = step as Record<string, unknown>
  const emailPayload = {
    connector_id: step.connector_id,
    to: (stepAny.to as string) ?? '',
    subject: (stepAny.subject as string) ?? step.name,
    body: (stepAny.body as string) ?? '',
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
