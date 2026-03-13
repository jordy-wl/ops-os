'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaletteItem {
  nodeType: 'trigger' | 'action' | 'condition' | 'wait' | 'input' | 'output'
  stepType?: string
  label: string
  icon: React.ElementType
  color: string
}

const PALETTE_ITEMS: { category: string; items: PaletteItem[] }[] = [
  {
    category: 'Triggers',
    items: [
      { nodeType: 'trigger', label: 'Manual Start', icon: Zap, color: 'text-primary bg-primary/10' },
      { nodeType: 'trigger', label: 'Event Trigger', icon: Zap, color: 'text-primary bg-primary/10' },
      { nodeType: 'trigger', label: 'Webhook', icon: Webhook, color: 'text-primary bg-primary/10' },
      { nodeType: 'trigger', label: 'Schedule', icon: Timer, color: 'text-primary bg-primary/10' },
    ],
  },
  {
    category: 'Actions',
    items: [
      { nodeType: 'action', stepType: 'emit_event', label: 'Emit Event', icon: Play, color: 'text-success bg-success/10' },
      { nodeType: 'action', stepType: 'run_action', label: 'Run Action', icon: Play, color: 'text-success bg-success/10' },
      { nodeType: 'action', stepType: 'call_api', label: 'Call API', icon: Globe, color: 'text-success bg-success/10' },
      { nodeType: 'action', stepType: 'send_email', label: 'Send Email', icon: Mail, color: 'text-success bg-success/10' },
      { nodeType: 'action', stepType: 'generate_document', label: 'Generate Doc', icon: FileText, color: 'text-success bg-success/10' },
      { nodeType: 'action', stepType: 'book_meeting', label: 'Book Meeting', icon: Calendar, color: 'text-success bg-success/10' },
      { nodeType: 'action', stepType: 'update_block', label: 'Update Block', icon: Pencil, color: 'text-success bg-success/10' },
    ],
  },
  {
    category: 'Conditions',
    items: [
      { nodeType: 'condition', label: 'If / Else', icon: GitBranch, color: 'text-warning bg-warning/10' },
      { nodeType: 'condition', stepType: 'switch', label: 'Switch', icon: Split, color: 'text-warning bg-warning/10' },
    ],
  },
  {
    category: 'Flow',
    items: [
      { nodeType: 'wait', label: 'Wait / Delay', icon: Clock, color: 'text-muted-foreground bg-muted' },
      { nodeType: 'input', label: 'Input', icon: ArrowDownToLine, color: 'text-foreground bg-muted' },
      { nodeType: 'output', label: 'Output', icon: ArrowUpFromLine, color: 'text-foreground bg-muted' },
    ],
  },
]

interface NodePaletteProps {
  onAddNode: (item: PaletteItem) => void
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const toggleCategory = (category: string) => {
    setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }))
  }

  const onDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData('application/ops-os-node', JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-52 shrink-0 border-r bg-background overflow-y-auto">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Node Palette</h3>
        {PALETTE_ITEMS.map((group) => {
          const isCollapsed = collapsed[group.category] ?? false
          return (
            <div key={group.category} className="mb-3">
              <button
                type="button"
                onClick={() => toggleCategory(group.category)}
                className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground mb-1.5 hover:text-foreground transition-colors"
              >
                <span>{group.category}</span>
                <ChevronDown
                  className={cn(
                    'h-3 w-3 transition-transform',
                    isCollapsed && '-rotate-90'
                  )}
                />
              </button>
              {!isCollapsed && (
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <button
                        key={`${item.nodeType}-${item.stepType ?? item.label}`}
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
                        <div className={cn('flex h-6 w-6 items-center justify-center rounded', item.color)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-foreground text-xs font-medium">{item.label}</span>
                      </button>
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
