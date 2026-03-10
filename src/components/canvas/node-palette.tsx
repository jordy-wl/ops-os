'use client'

import { Zap, Play, GitBranch, Clock, Globe, Mail, FileText, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaletteItem {
  nodeType: 'trigger' | 'action' | 'condition' | 'wait'
  stepType?: string
  label: string
  icon: React.ElementType
  color: string
}

const PALETTE_ITEMS: { category: string; items: PaletteItem[] }[] = [
  {
    category: 'Triggers',
    items: [
      { nodeType: 'trigger', label: 'Manual Start', icon: Zap, color: 'text-blue-600 bg-blue-100' },
      { nodeType: 'trigger', label: 'Event Trigger', icon: Zap, color: 'text-blue-600 bg-blue-100' },
    ],
  },
  {
    category: 'Actions',
    items: [
      { nodeType: 'action', stepType: 'emit_event', label: 'Emit Event', icon: Play, color: 'text-green-600 bg-green-100' },
      { nodeType: 'action', stepType: 'run_action', label: 'Run Action', icon: Play, color: 'text-green-600 bg-green-100' },
      { nodeType: 'action', stepType: 'call_api', label: 'Call API', icon: Globe, color: 'text-green-600 bg-green-100' },
      { nodeType: 'action', stepType: 'send_email', label: 'Send Email', icon: Mail, color: 'text-green-600 bg-green-100' },
      { nodeType: 'action', stepType: 'generate_document', label: 'Generate Doc', icon: FileText, color: 'text-green-600 bg-green-100' },
      { nodeType: 'action', stepType: 'book_meeting', label: 'Book Meeting', icon: Calendar, color: 'text-green-600 bg-green-100' },
    ],
  },
  {
    category: 'Flow Control',
    items: [
      { nodeType: 'condition', label: 'Condition', icon: GitBranch, color: 'text-amber-600 bg-amber-100' },
      { nodeType: 'wait', label: 'Wait / Delay', icon: Clock, color: 'text-gray-600 bg-gray-200' },
    ],
  },
]

interface NodePaletteProps {
  onAddNode: (item: PaletteItem) => void
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const onDragStart = (event: React.DragEvent, item: PaletteItem) => {
    event.dataTransfer.setData('application/ops-os-node', JSON.stringify(item))
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-52 shrink-0 border-r bg-white overflow-y-auto">
      <div className="p-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Node Palette</h3>
        {PALETTE_ITEMS.map((group) => (
          <div key={group.category} className="mb-4">
            <p className="text-xs font-medium text-gray-400 mb-1.5">{group.category}</p>
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
                      'hover:bg-gray-50 active:bg-gray-100 cursor-grab active:cursor-grabbing',
                      'transition-colors'
                    )}
                  >
                    <div className={cn('flex h-6 w-6 items-center justify-center rounded', item.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="text-gray-700 text-xs font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export type { PaletteItem }
