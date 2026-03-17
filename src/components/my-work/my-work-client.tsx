'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ClipboardList, GitBranch, LayoutGrid, Activity, ArrowRight, Circle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PriorityBadge } from './priority-badge'
import { DeadlineCountdown } from './deadline-countdown'
import { ConfidenceScore } from './confidence-score'
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
  open: 'bg-primary/10 text-primary',
  claimed: 'bg-warning/10 text-warning',
  completed: 'bg-success/10 text-success',
  pending: 'bg-muted text-muted-foreground',
  running: 'bg-primary/10 text-primary',
  done: 'bg-success/10 text-success',
  failed: 'bg-destructive/10 text-destructive',
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

type TabId = 'tasks' | 'workflows' | 'blocks' | 'activity'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'tasks', label: 'Assigned to me', icon: ClipboardList },
  { id: 'workflows', label: 'Active Workflows', icon: GitBranch },
  { id: 'blocks', label: 'Recent Blocks', icon: LayoutGrid },
  { id: 'activity', label: 'Activity', icon: Activity },
]

// ─── Flat Row Components ─────────────────────────────────────────────────────

function TaskRows({ tasks, currentUserId }: { tasks: MyWorkTask[]; currentUserId: string }) {
  const myTasks = tasks.filter((t) => t.assigned_to === currentUserId || t.status === 'open')

  // Sort by priority (urgent first), then by deadline (earliest first)
  const sortedTasks = [...myTasks].sort((a, b) => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }
    const aPri = priorityOrder[(a as unknown as Record<string, unknown>).priority as string] ?? 2
    const bPri = priorityOrder[(b as unknown as Record<string, unknown>).priority as string] ?? 2
    if (aPri !== bPri) return aPri - bPri
    // Then by deadline
    const aDl = (a as unknown as Record<string, unknown>).deadline as string | undefined
    const bDl = (b as unknown as Record<string, unknown>).deadline as string | undefined
    if (aDl && bDl) return new Date(aDl).getTime() - new Date(bDl).getTime()
    if (aDl) return -1
    if (bDl) return 1
    return 0
  })

  if (sortedTasks.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-muted-foreground">
        No open tasks. You&apos;re all caught up!
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {sortedTasks.slice(0, 12).map((task) => {
        const taskExtra = task as unknown as Record<string, unknown>
        const priority = taskExtra.priority as string | undefined
        const deadline = taskExtra.deadline as string | undefined
        const confidence = taskExtra.ai_confidence as number | undefined
        const aiSuggestion = taskExtra.ai_suggestion as string | undefined

        return (
          <Link
            key={task.id}
            href="/tasks"
            className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-foreground truncate">
                  {task.name}
                </span>
                {priority && <PriorityBadge priority={priority} />}
              </div>
              {aiSuggestion && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Sparkles className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-[11px] text-muted-foreground truncate">{aiSuggestion}</span>
                </div>
              )}
            </div>
            {deadline && <DeadlineCountdown deadline={deadline} />}
            {confidence != null && <ConfidenceScore score={confidence} />}
            <span
              className={cn(
                'shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
                STATUS_STYLES[task.status] ?? STATUS_STYLES.open
              )}
            >
              {task.status}
            </span>
            {task.workflow_instance_name && (
              <span className="shrink-0 text-[12px] text-muted-foreground truncate max-w-[120px] hidden sm:inline">
                {task.workflow_instance_name}
              </span>
            )}
            <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
              {formatRelative(task.created_at)}
            </span>
          </Link>
        )
      })}
      {sortedTasks.length > 12 && (
        <Link
          href="/tasks"
          className="flex items-center justify-center gap-1 py-2.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          View all {sortedTasks.length} tasks <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function WorkflowRows({ workflows }: { workflows: MyWorkWorkflow[] }) {
  if (workflows.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-muted-foreground">
        No active workflows.
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {workflows.slice(0, 10).map((wf) => (
        <Link
          key={wf.id}
          href={`/blocks/${wf.id}`}
          className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-medium text-foreground truncate flex-1 min-w-0">
            {wf.name}
          </span>
          <span
            className={cn(
              'shrink-0 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium capitalize',
              STATUS_STYLES[wf.status] ?? STATUS_STYLES.pending
            )}
          >
            {wf.status}
          </span>
          {wf.template_name && (
            <span className="shrink-0 text-[12px] text-muted-foreground truncate max-w-[120px] hidden sm:inline">
              {wf.template_name}
            </span>
          )}
          <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
            {formatRelative(wf.updated_at)}
          </span>
        </Link>
      ))}
      {workflows.length > 10 && (
        <Link
          href="/workflows"
          className="flex items-center justify-center gap-1 py-2.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          View all {workflows.length} workflows <ArrowRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

function BlockRows({ blocks }: { blocks: MyWorkBlock[] }) {
  if (blocks.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-muted-foreground">
        No blocks yet.
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {blocks.map((block) => (
        <Link
          key={block.id}
          href={`/blocks/${block.id}`}
          className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <LayoutGrid className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-medium text-foreground truncate flex-1 min-w-0">
            {block.name}
          </span>
          <span className="shrink-0 inline-flex rounded-full bg-muted text-foreground px-2 py-0.5 text-[11px] font-medium capitalize">
            {block.type.replace(/_/g, ' ')}
          </span>
          <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">
            {formatRelative(block.updated_at)}
          </span>
        </Link>
      ))}
    </div>
  )
}

function ActivityRows({ events }: { events: MyWorkEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-10 text-[13px] text-muted-foreground">
        No recent activity.
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {events.map((event) => (
        <div
          key={event.id}
          className="flex items-center gap-3 px-3 py-2.5"
        >
          <Circle className="h-2 w-2 fill-muted-foreground text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-[13px] font-medium text-foreground shrink-0">{event.type}</span>
          {event.block_name && (
            <span className="text-[13px] text-muted-foreground min-w-0 truncate">
              on{' '}
              <Link href={`/blocks/${event.block_id}`} className="hover:underline">
                {event.block_name}
              </Link>
            </span>
          )}
          <span className="shrink-0 ml-auto text-[12px] text-muted-foreground tabular-nums">
            {formatRelative(event.occurred_at)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function MyWorkClient({ initialData, currentUserId }: MyWorkClientProps) {
  const [activeTab, setActiveTab] = useState<TabId>('tasks')

  if (!initialData) {
    return (
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <h1 className="text-page font-semibold text-foreground mb-6">My Work</h1>
        <div className="rounded-md border border-destructive/20 bg-destructive/5 p-6 text-center" role="alert">
          <p className="text-[13px] font-medium text-destructive">Failed to load data.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">Refresh the page to try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <h1 className="text-page font-semibold text-foreground mb-6">My Work</h1>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border mb-0" role="tablist" aria-label="My Work sections">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors -mb-px border-b-2',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="rounded-b-md border border-t-0 border-border bg-card" role="tabpanel">
        {activeTab === 'tasks' && (
          <TaskRows tasks={initialData.tasks} currentUserId={currentUserId} />
        )}
        {activeTab === 'workflows' && (
          <WorkflowRows workflows={initialData.workflows} />
        )}
        {activeTab === 'blocks' && (
          <BlockRows blocks={initialData.recentBlocks} />
        )}
        {activeTab === 'activity' && (
          <ActivityRows events={initialData.recentEvents} />
        )}
      </div>
    </div>
  )
}
