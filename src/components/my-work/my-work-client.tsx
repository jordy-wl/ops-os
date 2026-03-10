'use client'

import Link from 'next/link'
import { ClipboardList, GitBranch, LayoutGrid, Activity, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MyWorkData, MyWorkTask, MyWorkWorkflow, MyWorkBlock, MyWorkEvent } from '@/app/(app)/my-work/page'

interface MyWorkClientProps {
  initialData: MyWorkData | null
  currentUserId: string
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-100 text-blue-800',
  claimed: 'bg-amber-100 text-amber-800',
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-800',
  done: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

// ─── Section Components ─────────────────────────────────────────────────────

function TasksSection({ tasks, currentUserId }: { tasks: MyWorkTask[]; currentUserId: string }) {
  const myTasks = tasks.filter((t) => t.assigned_to === currentUserId || t.status === 'open')

  if (myTasks.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No open tasks. You&apos;re all caught up!
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {myTasks.slice(0, 8).map((task) => (
        <Link
          key={task.id}
          href={`/tasks`}
          className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{task.name}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              {task.step_name && <span>{task.step_name}</span>}
              {task.workflow_instance_name && (
                <span className="truncate max-w-[140px]">{task.workflow_instance_name}</span>
              )}
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_STYLES[task.status] ?? STATUS_STYLES.open
            )}
          >
            {task.status}
          </span>
        </Link>
      ))}
      {myTasks.length > 8 && (
        <Link
          href="/tasks"
          className="flex items-center justify-center gap-1 py-2 text-xs text-gray-500 hover:text-gray-700"
        >
          View all {myTasks.length} tasks <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function WorkflowsSection({ workflows }: { workflows: MyWorkWorkflow[] }) {
  if (workflows.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No active workflows.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {workflows.slice(0, 6).map((wf) => (
        <Link
          key={wf.id}
          href={`/blocks/${wf.id}`}
          className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{wf.name}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              {wf.template_name && (
                <span className="truncate max-w-[160px]">{wf.template_name}</span>
              )}
              <span>{formatRelative(wf.updated_at)}</span>
            </div>
          </div>
          <span
            className={cn(
              'shrink-0 ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
              STATUS_STYLES[wf.status] ?? STATUS_STYLES.pending
            )}
          >
            {wf.status}
          </span>
        </Link>
      ))}
      {workflows.length > 6 && (
        <Link
          href="/workflows"
          className="flex items-center justify-center gap-1 py-2 text-xs text-gray-500 hover:text-gray-700"
        >
          View all {workflows.length} workflows <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function RecentBlocksSection({ blocks }: { blocks: MyWorkBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No blocks yet.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {blocks.map((block) => (
        <Link
          key={block.id}
          href={`/blocks/${block.id}`}
          className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{block.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{block.type}</p>
          </div>
          <span className="shrink-0 ml-2 text-xs text-gray-400">
            {formatRelative(block.updated_at)}
          </span>
        </Link>
      ))}
    </div>
  )
}

function ActivityFeed({ events }: { events: MyWorkEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-gray-400">
        No recent activity.
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-3 rounded-md px-3 py-2 text-xs"
        >
          <span
            className={cn(
              'shrink-0 h-1.5 w-1.5 rounded-full',
              event.type.startsWith('block.') ? 'bg-blue-400' :
              event.type.startsWith('workflow.') ? 'bg-purple-400' :
              event.type.startsWith('email.') ? 'bg-green-400' :
              event.type.startsWith('document.') ? 'bg-amber-400' :
              event.type.startsWith('meeting.') ? 'bg-teal-400' :
              'bg-gray-300'
            )}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <span className="font-medium text-gray-700">{event.type}</span>
            {event.block_name && (
              <span className="text-gray-400">
                {' '}on{' '}
                <Link href={`/blocks/${event.block_id}`} className="text-gray-600 hover:underline">
                  {event.block_name}
                </Link>
              </span>
            )}
          </div>
          <span className="shrink-0 text-gray-400">{formatRelative(event.occurred_at)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Icon className="h-4 w-4 text-gray-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

export function MyWorkClient({ initialData, currentUserId }: MyWorkClientProps) {
  if (!initialData) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">My Work</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center" role="alert">
          <p className="text-sm font-medium text-red-800">Failed to load data.</p>
          <p className="mt-1 text-sm text-red-600">Refresh the page to try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">My Work</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Tasks — top left */}
        <SectionCard title="Tasks" icon={ClipboardList}>
          <TasksSection tasks={initialData.tasks} currentUserId={currentUserId} />
        </SectionCard>

        {/* Active Workflows — top right */}
        <SectionCard title="Active Workflows" icon={GitBranch}>
          <WorkflowsSection workflows={initialData.workflows} />
        </SectionCard>

        {/* Recent Blocks — bottom left */}
        <SectionCard title="Recent Blocks" icon={LayoutGrid}>
          <RecentBlocksSection blocks={initialData.recentBlocks} />
        </SectionCard>

        {/* Activity Feed — bottom right */}
        <SectionCard title="Recent Activity" icon={Activity}>
          <ActivityFeed events={initialData.recentEvents} />
        </SectionCard>
      </div>
    </div>
  )
}
