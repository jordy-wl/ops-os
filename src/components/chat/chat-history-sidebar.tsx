'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Clock, Trash2, MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Conversation {
  id: string
  title: string
  mode: string
  updated_at: string
}

interface ChatHistorySidebarProps {
  activeConversationId: string | null
  onSelect: (conversationId: string) => void
  onNewChat: () => void
  visible: boolean
}

export function ChatHistorySidebar({
  activeConversationId,
  onSelect,
  onNewChat,
  visible,
}: ChatHistorySidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/conversations?limit=30')
      if (!res.ok) return
      const { data } = await res.json()
      if (Array.isArray(data)) setConversations(data)
    } catch {
      // non-critical
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (visible) fetchConversations()
  }, [visible, fetchConversations])

  const handleDelete = useCallback(async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' }).catch(() => {})
    setConversations((prev) => prev.filter((c) => c.id !== id))
  }, [])

  if (!visible) return null

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="flex flex-col h-full border-r border-border w-56 shrink-0 bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History</span>
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label="New conversation"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-4 space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-3 text-center">
            <Clock className="h-5 w-5 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
          </div>
        ) : (
          <div className="p-1.5 space-y-0.5">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelect(conv.id)}
                className={cn(
                  'group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left',
                  'hover:bg-muted transition-colors',
                  activeConversationId === conv.id && 'bg-muted'
                )}
              >
                <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{conv.title}</p>
                  <p className="text-[10px] text-muted-foreground">{timeAgo(conv.updated_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-destructive transition-all"
                  aria-label="Delete conversation"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
