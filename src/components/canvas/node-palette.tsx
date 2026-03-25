'use client'

import { useState, useEffect } from 'react'
import {
  Zap,
  Play,
  GitBranch,
  Clock,
  Globe,
  Mail,
  FileText,
  Calendar,
  Pencil,
  ArrowDownToLine,
  ArrowUpFromLine,
  Webhook,
  Timer,
  Split,
  ChevronDown,
  Info,
  Search,
  ClipboardCheck,
  Workflow,
  // Phase 5: Data Operations
  PlusCircle,
  RefreshCw,
  Link,
  Filter,
  // Phase 5: Human Interaction
  UserCheck,
  Bell,
  Share2,
  // Phase 5 Sprint 16: AI + External
  Brain,
  Tags,
  FileBarChart,
  ShieldAlert,
  Upload,
  Repeat,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaletteItem {
  nodeType: 'trigger' | 'action' | 'condition' | 'wait' | 'input' | 'output' | 'task' | 'route' | 'foreach'
  stepType?: string
  label: string
  icon: React.ElementType
  color: string
  description?: string
  /** For custom actions: pre-filled config */
  customActionConfig?: Record<string, unknown>
}

const PALETTE_ITEMS: { category: string; items: PaletteItem[] }[] = [
  {
    category: 'Triggers',
    items: [
      { nodeType: 'trigger', label: 'Manual Start', icon: Zap, color: 'text-primary bg-primary/10', description: 'Run this workflow by clicking a button on a block' },
      { nodeType: 'trigger', label: 'When Event Occurs', icon: Zap, color: 'text-primary bg-primary/10', description: 'Automatically start when a specific activity happens (e.g. block created, status changed)' },
      { nodeType: 'trigger', label: 'Webhook', icon: Webhook, color: 'text-primary bg-primary/10', description: 'Start when an external system sends data to your endpoint' },
      { nodeType: 'trigger', label: 'Schedule', icon: Timer, color: 'text-primary bg-primary/10', description: 'Run on a recurring schedule (daily, weekly, etc.)' },
      { nodeType: 'trigger', label: 'Portal Submission', icon: Globe, color: 'text-primary bg-primary/10', description: 'Start when a client submits a form or request through their portal', customActionConfig: { event_pattern: 'portal.form.submitted' } },
    ],
  },
  {
    category: 'Actions',
    items: [
      { nodeType: 'action', stepType: 'emit_event', label: 'Log Event', icon: Play, color: 'text-success bg-success/10', description: 'Record an activity on the timeline for tracking and audit' },
      { nodeType: 'action', stepType: 'call_api', label: 'External Action', icon: Globe, color: 'text-success bg-success/10', description: 'Send a request to an external service via a configured integration' },
      { nodeType: 'action', stepType: 'send_email', label: 'Send Email', icon: Mail, color: 'text-success bg-success/10', description: 'Send an email via your connected email integration' },
      { nodeType: 'action', stepType: 'generate_document', label: 'Generate Document', icon: FileText, color: 'text-success bg-success/10', description: 'Create a document from a template or AI prompt' },
      { nodeType: 'action', stepType: 'book_meeting', label: 'Book Meeting', icon: Calendar, color: 'text-success bg-success/10', description: 'Schedule a calendar event via your connected calendar' },
      { nodeType: 'action', stepType: 'update_block', label: 'Update Record', icon: Pencil, color: 'text-success bg-success/10', description: 'Change fields on a block (e.g. update status, assign owner)' },
      { nodeType: 'task', stepType: 'generate_task', label: 'Create Task', icon: ClipboardCheck, color: 'text-violet-500 bg-violet-500/10', description: 'Generate a human task with a custom form — appears in My Work for review/approval' },
    ],
  },
  {
    category: 'Data Operations',
    items: [
      { nodeType: 'action', stepType: 'run_action', label: 'Create Record', icon: PlusCircle, color: 'text-cyan-500 bg-cyan-500/10', description: 'Create a new block record of any type' },
      { nodeType: 'action', stepType: 'update_block', label: 'Change Status', icon: RefreshCw, color: 'text-cyan-500 bg-cyan-500/10', description: 'Update the status field on a block' },
      { nodeType: 'action', stepType: 'create_edge', label: 'Link Records', icon: Link, color: 'text-cyan-500 bg-cyan-500/10', description: 'Link two records together with a relationship' },
      { nodeType: 'action', stepType: 'search_blocks', label: 'Search / Filter', icon: Filter, color: 'text-cyan-500 bg-cyan-500/10', description: 'Find blocks by type, name, or metadata criteria' },
    ],
  },
  {
    category: 'Human Interaction',
    items: [
      { nodeType: 'task', stepType: 'generate_task', label: 'Approval Request', icon: UserCheck, color: 'text-violet-500 bg-violet-500/10', description: 'Create an approval task that pauses the workflow until reviewed' },
      { nodeType: 'action', stepType: 'send_notification', label: 'Send Notification', icon: Bell, color: 'text-violet-500 bg-violet-500/10', description: 'Push a notification to specific users or the whole org' },
      { nodeType: 'action', stepType: 'create_shared_link', label: 'Share Link', icon: Share2, color: 'text-violet-500 bg-violet-500/10', description: 'Generate a secure shared link for external client access' },
      { nodeType: 'action', stepType: 'provision_portal', label: 'Provision Portal', icon: Globe, color: 'text-violet-500 bg-violet-500/10', description: 'Create a client portal from a template' },
    ],
  },
  {
    category: 'AI & Analysis',
    items: [
      { nodeType: 'action', stepType: 'ai_analysis', label: 'AI Analysis', icon: Brain, color: 'text-emerald-500 bg-emerald-500/10', description: 'Run structured AI analysis on block data using Claude' },
      { nodeType: 'action', stepType: 'ai_classify', label: 'Classify / Route', icon: Tags, color: 'text-emerald-500 bg-emerald-500/10', description: 'Classify a block into categories with confidence scoring' },
      { nodeType: 'action', stepType: 'ai_summarize', label: 'Summarize', icon: FileBarChart, color: 'text-emerald-500 bg-emerald-500/10', description: 'Generate an executive summary of block data and events' },
      { nodeType: 'action', stepType: 'ai_risk_assessment', label: 'Risk Assessment', icon: ShieldAlert, color: 'text-emerald-500 bg-emerald-500/10', description: 'Perform policy-aware risk scoring with mitigations' },
    ],
  },
  {
    category: 'External',
    items: [
      { nodeType: 'action', stepType: 'call_api', label: 'External Action', icon: Globe, color: 'text-rose-500 bg-rose-500/10', description: 'Send data to an external service via a connector (Xero, HubSpot, webhooks, etc.)' },
      { nodeType: 'action', stepType: 'store_file', label: 'Store File', icon: Upload, color: 'text-rose-500 bg-rose-500/10', description: 'Upload a file to cloud storage' },
    ],
  },
  {
    category: 'Conditions',
    items: [
      { nodeType: 'condition', label: 'If / Else', icon: GitBranch, color: 'text-warning bg-warning/10', description: 'Branch the workflow based on a true/false condition' },
      { nodeType: 'route', label: 'Route', icon: Split, color: 'text-orange-500 bg-orange-500/10', description: 'Branch into multiple paths based on a field value (e.g. AI classification, record status)' },
    ],
  },
  {
    category: 'Flow',
    items: [
      { nodeType: 'wait', label: 'Wait / Delay', icon: Clock, color: 'text-muted-foreground bg-muted', description: 'Pause the workflow for a set amount of time' },
      { nodeType: 'action', stepType: 'run_sub_workflow', label: 'Run Sub-Workflow', icon: Workflow, color: 'text-blue-500 bg-blue-500/10', description: 'Trigger another workflow and optionally wait for it to complete' },
      { nodeType: 'foreach', label: 'For Each', icon: Repeat, color: 'text-teal-500 bg-teal-500/10', description: 'Iterate over a list and run steps for each item' },
      { nodeType: 'input', label: 'Data Input', icon: ArrowDownToLine, color: 'text-foreground bg-muted', description: 'Define what data this workflow receives when it starts' },
      { nodeType: 'output', label: 'Data Output', icon: ArrowUpFromLine, color: 'text-foreground bg-muted', description: 'Define what data this workflow sends out when it completes' },
    ],
  },
]

interface NodePaletteProps {
  onAddNode: (item: PaletteItem) => void
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [customActions, setCustomActions] = useState<PaletteItem[]>([])

  // Fetch custom actions for this org
  useEffect(() => {
    fetch('/api/custom-actions')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.data)) {
          const items: PaletteItem[] = data.data.map((a: Record<string, unknown>) => {
            const meta = a.metadata as Record<string, unknown> | undefined
            return {
              nodeType: 'action' as const,
              stepType: 'call_api',
              label: a.name as string,
              icon: Globe,
              color: 'text-orange-500 bg-orange-500/10',
              description: (meta?.description as string) || 'Custom saved action',
              customActionConfig: {
                connector_id: meta?.connector_id,
                method: meta?.method,
                path: meta?.path,
                body_template: meta?.body_template,
                timeout_ms: meta?.timeout_ms,
                max_retries: meta?.max_retries,
              },
            }
          })
          setCustomActions(items)
        }
      })
      .catch(() => {})
  }, [])

  const allGroups = customActions.length > 0
    ? [...PALETTE_ITEMS, { category: 'Custom Actions', items: customActions }]
    : PALETTE_ITEMS

  const toggleCategory = (category: string) => {
    setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  const onDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData('application/ops-os-node', JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'move'
  }

  const query = search.trim().toLowerCase()
  const filteredGroups = query
    ? allGroups.map((g) => ({
        ...g,
        items: g.items.filter(
          (i) =>
            i.label.toLowerCase().includes(query) ||
            i.description?.toLowerCase().includes(query) ||
            i.stepType?.toLowerCase().includes(query)
        ),
      })).filter((g) => g.items.length > 0)
    : allGroups

  return (
    <div className="w-52 shrink-0 border-r bg-background overflow-y-auto">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Node Palette</h3>
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes…"
            className="w-full rounded-md border border-border bg-background pl-7 pr-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {filteredGroups.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No nodes match &ldquo;{search}&rdquo;</p>
        )}
        {filteredGroups.map((group) => {
          const isCollapsed = !query && (collapsed[group.category] ?? false)
          return (
            <div key={group.category} className="mb-3">
              <button
                type="button"
                onClick={() => toggleCategory(group.category)}
                className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground mb-1.5 hover:text-foreground transition-colors"
              >
                <span>{group.category}</span>
                {!query && (
                  <ChevronDown
                    className={cn(
                      'h-3 w-3 transition-transform',
                      isCollapsed && '-rotate-90'
                    )}
                  />
                )}
              </button>
              {!isCollapsed && (
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={`${item.nodeType}-${item.stepType ?? item.label}`}
                        className="group/node relative"
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={(e) => onDragStart(e, item)}
                          onClick={() => onAddNode(item)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                            'hover:bg-muted active:bg-muted cursor-grab active:cursor-grabbing',
                            'transition-colors'
                          )}
                        >
                          <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded', item.color)}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-foreground text-xs font-medium truncate">{item.label}</span>
                          {item.description && (
                            <Info className="ml-auto h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover/node:opacity-100 transition-opacity" />
                          )}
                        </button>
                        {item.description && (
                          <div className="absolute left-full top-0 z-50 ml-2 hidden group-hover/node:block w-56 rounded-md border bg-popover p-2.5 text-xs text-popover-foreground shadow-md">
                            <p className="font-medium mb-0.5">{item.label}</p>
                            <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export type { PaletteItem }
