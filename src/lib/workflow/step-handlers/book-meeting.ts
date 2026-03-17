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
  const actionHandler = REGISTRY['meeting.book']
  if (!actionHandler) {
    return { step_name: step.name, step_type: step.type, status: 'failed', error: 'meeting.book handler not registered', executed_at: now }
  }

  const stepAny = step as Record<string, unknown>
  const meetingPayload = {
    connector_id: step.connector_id,
    title: (stepAny.title as string) ?? step.name,
    start: (stepAny.start as string) ?? new Date().toISOString(),
    end: (stepAny.end as string) ?? new Date(Date.now() + 3600000).toISOString(),
    attendees: (stepAny.attendees as string[]) ?? [],
    block_id: meta.source_block_id,
  }

  const meetingResult = await actionHandler.execute(meetingPayload, { ...SYSTEM_CTX, orgId }, supabase)
  return {
    step_name: step.name,
    step_type: step.type,
    status: meetingResult.status === 'completed' ? 'completed' : 'failed',
    output: { action_id: meetingResult.actionId, event_id: meetingResult.eventId },
    executed_at: now,
  }
}

export default handler
