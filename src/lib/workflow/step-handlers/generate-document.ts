import { PERMISSIONS } from '@/lib/rbac/types'
import type { AuthContext } from '@/lib/auth/withAuth'
import type { StepHandler } from './types'

const SYSTEM_CTX: AuthContext = {
  userId: 'system', clerkOrgId: '', orgId: '', role: 'ops-admin',
  roleId: '', permissions: new Set(PERMISSIONS),
}

const handler: StepHandler = async (step, meta, orgId, supabase) => {
  const now = new Date().toISOString()

  const { REGISTRY } = await import('@/lib/actions/registry')
  const actionHandler = REGISTRY['document.generate']
  if (!actionHandler) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'document.generate handler not registered', executed_at: now }
  }

  const stepAny = step as Record<string, unknown>
  const docPayload = {
    source_block_id: meta.source_block_id,
    template_id: stepAny.template_id as string | undefined,
    prompt: stepAny.prompt as string | undefined,
    output_format: (stepAny.output_format as string) ?? 'html',
  }

  const docResult = await actionHandler.execute(docPayload, { ...SYSTEM_CTX, orgId }, supabase)
  return {
    step_name: step.name,
    step_type: step.type,
    status: docResult.status === 'completed' ? 'completed' : 'failed',
    output: { action_id: docResult.actionId, event_id: docResult.eventId },
    executed_at: now,
  }
}

export default handler
