'use client'

import { History, X, MessageCircle, PanelRightOpen, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ModeSelector } from './mode-selector'
import type { ChatMode, ChatLayout } from './chat-widget-provider'

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatHeaderProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  layout: ChatLayout
  onLayoutChange: (layout: ChatLayout) => void
  showHistory: boolean
  onToggleHistory: () => void
  onClose: () => void
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ChatHeader({
  mode,
  onModeChange,
  layout,
  onLayoutChange,
  showHistory,
  onToggleHistory,
  onClose,
}: ChatHeaderProps) {
  const layoutOptions: Array<{ value: ChatLayout; icon: React.ReactNode; label: string }> = [
    { value: 'float', icon: <MessageCircle className="h-3.5 w-3.5" />, label: 'Float' },
    { value: 'panel', icon: <PanelRightOpen className="h-3.5 w-3.5" />, label: 'Panel' },
    { value: 'expanded', icon: <Maximize2 className="h-3.5 w-3.5" />, label: 'Expanded' },
  ]

  return (
    <div className="flex items-center justify-between gap-2 border-b px-3 py-2 shrink-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleHistory}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            showHistory
              ? 'text-foreground bg-muted'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          aria-label="Toggle chat history"
        >
          <History className="h-4 w-4" />
        </button>
        <ModeSelector mode={mode} onModeChange={onModeChange} />
      </div>
      <div className="flex items-center gap-0.5">
        {/* 3-state layout toggle */}
        <div className="hidden md:flex items-center rounded-md border border-border p-0.5 gap-0.5">
          {layoutOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onLayoutChange(opt.value)}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-sm transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                layout === opt.value
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
              aria-label={`Switch to ${opt.label} layout`}
              title={opt.label}
            >
              {opt.icon}
            </button>
          ))}
        </div>
        {/* Mobile: simple float/panel toggle */}
        <button
          type="button"
          onClick={() => onLayoutChange(layout === 'panel' ? 'float' : 'panel')}
          className="flex md:hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Toggle layout"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
