import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { TaskListClient } from '@/components/tasks/task-list-client'
import { logger } from '@/lib/logger'

export interface TaskFormField {
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox'
  name: string
  label: string
  required?: boolean
  options?: string[]
  max_length?: number
  source?: string
}

export interface TaskFormAction {
  label: string
  value: string
  style?: 'primary' | 'destructive' | 'outline' | 'secondary'
}

export interface TaskFormSchema {
  title?: string
  fields?: TaskFormField[]
  actions?: TaskFormAction[]
}

export interface TaskItem {
  id: string
  name: string
  status: 'open' | 'claimed' | 'completed'
  assigned_to: string | null
  workflow_instance_id: string | null
  workflow_instance_name: string | null
  step_name: string | null
  created_at: string
  updated_at: string
  // Enhanced task card fields (Sprint 4)
  instructions: string | null
  ai_recommendation: Record<string, unknown> | null
  confidence_score: number | null
  routing_decision: 'human' | 'agent' | 'approval_chain' | null
  routing_reason: string | null
  decision: 'approved' | 'rejected' | 'modified' | null
  // Task form schema (Phase 4)
  task_form_schema: TaskFormSchema | null
  priority: 'low' | 'medium' | 'high' | 'urgent' | null
}

export default async function TasksPage() {
  const { userId, orgId } = await auth()

  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)

  const supabase = createServerClient()

  // Fetch task_queue_item blocks for this org
  const { data: taskBlocks, error } = await supabase
    .from('blocks')
    .select('id, name, metadata, created_at, updated_at')
    .eq('org_id', internalOrgId)
    .eq('type', 'task_queue_item')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    logger.error('tasks-page', 'db.query_failed', {
      error_code: error.code,
      org_id: internalOrgId,
    })
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <h1 className="text-2xl font-semibold text-foreground mb-6">My Tasks</h1>
        <TaskListClient initialTasks={null} currentUserId={userId} />
      </div>
    )
  }

  // Resolve workflow instance names for display
  const instanceIds = [
    ...new Set(
      (taskBlocks ?? [])
        .map((b) => {
          const meta = b.metadata as Record<string, unknown> | null
          return meta?.workflow_instance_id as string | undefined
        })
        .filter((id): id is string => typeof id === 'string')
    ),
  ]

  const instanceNameMap = new Map<string, string>()
  if (instanceIds.length > 0) {
    const { data: instances } = await supabase
      .from('blocks')
      .select('id, name')
      .in('id', instanceIds)
      .eq('org_id', internalOrgId)
    for (const inst of instances ?? []) instanceNameMap.set(inst.id, inst.name)
  }

  const initialTasks: TaskItem[] = (taskBlocks ?? []).map((b) => {
    const meta = (b.metadata ?? {}) as Record<string, unknown>
    const instanceId = (meta.workflow_instance_id as string) ?? null
    return {
      id: b.id,
      name: b.name,
      status: (meta.status as TaskItem['status']) ?? 'open',
      assigned_to: (meta.assigned_to as string) ?? null,
      workflow_instance_id: instanceId,
      workflow_instance_name: instanceId ? (instanceNameMap.get(instanceId) ?? null) : null,
      step_name: (meta.step_name as string) ?? null,
      created_at: b.created_at,
      updated_at: b.updated_at,
      instructions: (meta.instructions as string) ?? null,
      ai_recommendation: (meta.ai_recommendation as Record<string, unknown>) ?? null,
      confidence_score: typeof meta.confidence_score === 'number' ? meta.confidence_score : null,
      routing_decision: (meta.routing_decision as TaskItem['routing_decision']) ?? null,
      routing_reason: (meta.routing_reason as string) ?? null,
      decision: (meta.decision as TaskItem['decision']) ?? null,
      task_form_schema: (meta.task_form_schema as TaskFormSchema) ?? null,
      priority: (meta.priority as TaskItem['priority']) ?? null,
    }
  })

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-semibold text-foreground mb-6">My Tasks</h1>
      <TaskListClient initialTasks={initialTasks} currentUserId={userId} />
    </div>
  )
}
