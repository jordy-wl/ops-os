import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { resolveOrgId } from '@/lib/auth/resolve-org'
import { MyWorkClient } from '@/components/my-work/my-work-client'
import { logger } from '@/lib/logger'

export interface MyWorkData {
  tasks: MyWorkTask[]
  workflows: MyWorkWorkflow[]
  recentBlocks: MyWorkBlock[]
  recentEvents: MyWorkEvent[]
}

export interface MyWorkTask {
  id: string
  name: string
  status: 'open' | 'claimed' | 'completed'
  assigned_to: string | null
  step_name: string | null
  workflow_instance_name: string | null
  created_at: string
}

export interface MyWorkWorkflow {
  id: string
  name: string
  status: string
  template_name: string | null
  started_at: string | null
  updated_at: string
}

export interface MyWorkBlock {
  id: string
  name: string
  type: string
  updated_at: string
}

export interface MyWorkEvent {
  id: string
  type: string
  block_id: string | null
  block_name: string | null
  occurred_at: string
  actor_type: string
}

export default async function MyWorkPage() {
  const { userId, orgId } = await auth()

  if (!userId) redirect('/sign-in')
  if (!orgId) redirect('/org-setup')

  const internalOrgId = await resolveOrgId(orgId)

  if (!internalOrgId) {
    return <MyWorkClient initialData={null} currentUserId={userId} />
  }

  const supabase = createServerClient()

  // Fetch all data in parallel
  const [tasksRes, workflowsRes, blocksRes, eventsRes] = await Promise.all([
    // Open + claimed tasks (not completed)
    supabase
      .from('blocks')
      .select('id, name, metadata, created_at')
      .eq('org_id', internalOrgId)
      .eq('type', 'task_queue_item')
      .order('created_at', { ascending: false })
      .limit(50),

    // Active workflow instances
    supabase
      .from('blocks')
      .select('id, name, metadata, updated_at')
      .eq('org_id', internalOrgId)
      .eq('type', 'workflow_instance')
      .order('updated_at', { ascending: false })
      .limit(20),

    // Recently modified blocks (excluding system types)
    supabase
      .from('blocks')
      .select('id, name, type, updated_at')
      .eq('org_id', internalOrgId)
      .not('type', 'in', '("task_queue_item","workflow_instance","workflow_template")')
      .order('updated_at', { ascending: false })
      .limit(10),

    // Recent events
    supabase
      .from('events')
      .select('id, type, block_id, occurred_at, actor_type')
      .eq('org_id', internalOrgId)
      .order('occurred_at', { ascending: false })
      .limit(15),
  ])

  const queryError = tasksRes.error ?? workflowsRes.error ?? blocksRes.error ?? eventsRes.error
  if (queryError) {
    logger.error('my-work-page', 'db.query_failed', { error_code: queryError.code })
    return <MyWorkClient initialData={null} currentUserId={userId} />
  }

  // Resolve template names for workflow instances
  const templateIds = [
    ...new Set(
      (workflowsRes.data ?? [])
        .map((b) => (b.metadata as Record<string, unknown> | null)?.template_id as string | undefined)
        .filter((id): id is string => typeof id === 'string')
    ),
  ]

  const templateNameMap = new Map<string, string>()
  if (templateIds.length > 0) {
    const { data: templates } = await supabase
      .from('blocks')
      .select('id, name')
      .in('id', templateIds)
      .eq('org_id', internalOrgId)
    for (const t of templates ?? []) templateNameMap.set(t.id, t.name)
  }

  // Resolve workflow instance names for tasks
  const instanceIds = [
    ...new Set(
      (tasksRes.data ?? [])
        .map((b) => (b.metadata as Record<string, unknown> | null)?.workflow_instance_id as string | undefined)
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

  // Resolve block names for events
  const blockIds = [
    ...new Set(
      (eventsRes.data ?? [])
        .map((e) => e.block_id)
        .filter((id): id is string => typeof id === 'string')
    ),
  ]

  const blockNameMap = new Map<string, string>()
  if (blockIds.length > 0) {
    const { data: blocks } = await supabase
      .from('blocks')
      .select('id, name')
      .in('id', blockIds)
      .eq('org_id', internalOrgId)
    for (const b of blocks ?? []) blockNameMap.set(b.id, b.name)
  }

  // Map tasks — filter to non-completed
  const tasks: MyWorkTask[] = (tasksRes.data ?? [])
    .map((b) => {
      const meta = (b.metadata ?? {}) as Record<string, unknown>
      const instanceId = meta.workflow_instance_id as string | undefined
      return {
        id: b.id,
        name: b.name,
        status: (meta.status as MyWorkTask['status']) ?? 'open',
        assigned_to: (meta.assigned_to as string) ?? null,
        step_name: (meta.step_name as string) ?? null,
        workflow_instance_name: instanceId ? (instanceNameMap.get(instanceId) ?? null) : null,
        created_at: b.created_at,
      }
    })
    .filter((t) => t.status !== 'completed')

  // Map workflows — filter to active only
  const workflows: MyWorkWorkflow[] = (workflowsRes.data ?? [])
    .map((b) => {
      const meta = (b.metadata ?? {}) as Record<string, unknown>
      const templateId = meta.template_id as string | undefined
      return {
        id: b.id,
        name: b.name,
        status: (meta.status as string) ?? 'pending',
        template_name: templateId ? (templateNameMap.get(templateId) ?? null) : null,
        started_at: (meta.started_at as string) ?? null,
        updated_at: b.updated_at,
      }
    })
    .filter((w) => w.status !== 'done' && w.status !== 'failed')

  const initialData: MyWorkData = {
    tasks,
    workflows,
    recentBlocks: (blocksRes.data ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      type: b.type,
      updated_at: b.updated_at,
    })),
    recentEvents: (eventsRes.data ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      block_id: e.block_id ?? null,
      block_name: e.block_id ? (blockNameMap.get(e.block_id) ?? null) : null,
      occurred_at: e.occurred_at,
      actor_type: e.actor_type,
    })),
  }

  return <MyWorkClient initialData={initialData} currentUserId={userId} />
}
