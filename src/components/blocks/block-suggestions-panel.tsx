'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lightbulb, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlockSuggestion {
  type: 'action' | 'insight' | 'risk' | 'next_step'
  title: string
  body: string
  actionType?: string | null
  priority: 'low' | 'medium' | 'high'
}

interface SuggestionsData {
  suggestions: BlockSuggestion[]
  generatedAt: string
  fromCache: boolean
}

interface BlockSuggestionsPanelProps {
  blockId: string
  blockType: string
}

const POLL_INTERVAL_MS = 60_000

const TYPE_CONFIG: Record<
  BlockSuggestion['type'],
  { icon: typeof Lightbulb; label: string; className: string }
> = {
  action: {
    icon: Sparkles,
    label: 'Action',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  insight: {
    icon: Lightbulb,
    label: 'Insight',
    className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800',
  },
  risk: {
    icon: AlertTriangle,
    label: 'Risk',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  next_step: {
    icon: ArrowRight,
    label: 'Next Step',
    className: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800',
  },
}

/**
 * BlockSuggestionsPanel — AI suggestions for any non-workflow block.
 * Polls /api/blocks/:id/suggestions every 60s.
 */
export function BlockSuggestionsPanel({ blockId, blockType }: BlockSuggestionsPanelProps) {
  const [data, setData] = useState<SuggestionsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await fetch(`/api/blocks/${blockId}/suggestions`)
      if (!res.ok) {
        if (res.status === 404 || res.status === 400) {
          setData(null)
          setLoading(false)
          return
        }
        throw new Error(`Failed to fetch suggestions: ${res.status}`)
      }
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions')
    } finally {
      setLoading(false)
    }
  }, [blockId])

  useEffect(() => {
    fetchSuggestions()
    const interval = setInterval(fetchSuggestions, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchSuggestions])

  if (loading) {
    return (
      <div className="rounded-md border border-border p-4 space-y-3 animate-pulse">
        <div className="h-4 bg-muted rounded w-28" />
        <div className="h-16 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-[13px] text-destructive">{error}</p>
      </div>
    )
  }

  if (!data || data.suggestions.length === 0) return null

  return (
    <div className="rounded-md border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-headline text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          AI Suggestions
        </h3>
        <span className="text-[11px] text-muted-foreground">
          {blockType.replace(/_/g, ' ')}
        </span>
      </div>

      <div className="space-y-2">
        {data.suggestions.map((suggestion, i) => {
          const config = TYPE_CONFIG[suggestion.type]
          const Icon = config.icon

          return (
            <div
              key={i}
              className={cn(
                'rounded-md border p-3 space-y-1',
                suggestion.priority === 'high' && 'ring-1 ring-primary/20'
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border',
                    config.className
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {config.label}
                </span>
                {suggestion.priority === 'high' && (
                  <span className="text-[10px] font-medium text-destructive uppercase tracking-wider">
                    High Priority
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-foreground">{suggestion.title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{suggestion.body}</p>
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-right">
        {data.fromCache ? 'Cached' : 'Fresh'} — {new Date(data.generatedAt).toLocaleTimeString()}
      </p>
    </div>
  )
}
