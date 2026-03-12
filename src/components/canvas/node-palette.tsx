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
      { nodeType: 'trigger', label: 'Manual Start', icon: Zap, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/40' },
      { nodeType: 'trigger', label: 'Event Trigger', icon: Zap, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/40' },
      { nodeType: 'trigger', label: 'Webhook', icon: Webhook, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/40' },
      { nodeType: 'trigger', label: 'Schedule', icon: Timer, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/40' },
    ],
  },
  {
    category: 'Actions',
    items: [
      { nodeType: 'action', stepType: 'emit_event', label: 'Emit Event', icon: Play, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/40' },
      { nodeType: 'action', stepType: 'run_action', label: 'Run Action', icon: Play, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/40' },
      { nodeType: 'action', stepType: 'call_api', label: 'Call API', icon: Globe, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/40' },
      { nodeType: 'action', stepType: 'send_email', label: 'Send Email', icon: Mail, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/40' },
      { nodeType: 'action', stepType: 'generate_document', label: 'Generate Doc', icon: FileText, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/40' },
      { nodeType: 'action', stepType: 'book_meeting', label: 'Book Meeting', icon: Calendar, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/40' },
      { nodeType: 'action', stepType: 'update_block', label: 'Update Block', icon: Pencil, color: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/40' },
    ],
  },
  {
    category: 'Conditions',
    items: [
      { nodeType: 'condition', label: 'If / Else', icon: GitBranch, color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/40' },
      { nodeType: 'condition', stepType: 'switch', label: 'Switch', icon: Split, color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/40' },
    ],
  },
  {
    category: 'Flow',
    items: [
      { nodeType: 'wait', label: 'Wait / Delay', icon: Clock, color: 'text-gray-600 bg-gray-200 dark:text-gray-400 dark:bg-gray-800' },
      { nodeType: 'input', label: 'Input', icon: ArrowDownToLine, color: 'text-indigo-600 bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-900/40' },
      { nodeType: 'output', label: 'Output', icon: ArrowUpFromLine, color: 'text-teal-600 bg-teal-100 dark:text-teal-400 dark:bg-teal-900/40' },
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
