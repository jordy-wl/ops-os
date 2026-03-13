'use client'

import { MessageSquare, ListChecks, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMode } from './chat-widget-provider'

interface ModeSelectorProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
}

const MODES: Array<{ value: ChatMode; label: string; icon: React.ElementType; color: string }> = [
  { value: 'discuss', label: 'Discuss', icon: MessageSquare, color: 'text-blue-600' },
  { value: 'plan', label: 'Plan', icon: ListChecks, color: 'text-amber-600' },
  { value: 'execute', label: 'Execute', icon: Zap, color: 'text-green-600' },
]

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="flex gap-0.5 rounded-lg bg-muted p-0.5" role="group" aria-label="Chat mode">
      {MODES.map((m) => {
        const Icon = m.icon
        const active = mode === m.value
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onModeChange(m.value)}
            className={cn(
              'flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-pressed={active}
          >
            <Icon className={cn('h-3 w-3', active ? m.color : 'text-muted-foreground')} />
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
