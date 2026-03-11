import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { TaskListClient } from '@/components/tasks/task-list-client'
import { logger } from '@/lib/logger'

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
      <div className="p-6 lg:p-8">
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
    }
  })

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-foreground mb-6">My Tasks</h1>
      <TaskListClient initialTasks={initialTasks} currentUserId={userId} />
    </div>
  )
}
