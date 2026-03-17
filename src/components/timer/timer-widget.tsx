'use client'

import { useState } from 'react'
import { Play, Square, Clock, DollarSign, Target, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTimer } from './timer-widget-provider'

/** Format seconds as Xh Ym Zs */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`
  return `${s}s`
}

export function TimerWidget() {
  const timer = useTimer()
  const [isExpanded, setIsExpanded] = useState(false)
  const [description, setDescription] = useState('')
  const [isBillable, setIsBillable] = useState(false)
  const [timeboxMinutes, setTimeboxMinutes] = useState<number | null>(null)

  // Timebox progress (0-1)
  const timeboxProgress = timer.timeboxSeconds
    ? Math.min(timer.elapsedSeconds / timer.timeboxSeconds, 1)
    : null
  const isTimeboxComplete = timeboxProgress !== null && timeboxProgress >= 1

  // If not running and not expanded, show compact start button
  if (!timer.isRunning && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={cn(
          'fixed bottom-16 left-4 z-[45] md:bottom-4',
          'flex items-center gap-2 rounded-full bg-primary px-4 py-2.5',
          'text-primary-foreground shadow-lg hover:bg-primary/90',
          'transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        aria-label="Start timer"
      >
        <Clock className="h-4 w-4" />
        <span className="text-[13px] font-medium">Timer</span>
      </button>
    )
  }

  // Running or expanded state
  return (
    <div
      className={cn(
        'fixed bottom-16 left-4 z-[45] md:bottom-4',
        'w-72 rounded-lg border border-border bg-card shadow-xl',
        'transition-all'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-[13px] font-medium text-foreground flex-1">
          {timer.isRunning ? 'Timer Running' : 'Start Timer'}
        </span>
        {timer.isRunning && (
          <span className={cn(
            'text-[15px] font-mono font-semibold tabular-nums',
            isTimeboxComplete ? 'text-destructive animate-pulse' : 'text-foreground'
          )}>
            {formatElapsed(timer.elapsedSeconds)}
          </span>
        )}
        <button
          onClick={() => {
            if (!timer.isRunning) setIsExpanded(false)
          }}
          className="p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded && !timer.isRunning ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Timebox progress ring */}
      {timer.isRunning && timer.timeboxSeconds && (
        <div className="px-3 pt-2">
          <div className="flex items-center gap-2">
            <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000',
                  isTimeboxComplete ? 'bg-destructive' : 'bg-primary'
                )}
                style={{ width: `${(timeboxProgress ?? 0) * 100}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
              {formatElapsed(Math.max(0, timer.timeboxSeconds - timer.elapsedSeconds))}
            </span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="px-3 py-2 space-y-2">
        {/* Description */}
        <input
          type="text"
          placeholder="What are you working on?"
          value={timer.isRunning ? timer.description : description}
          onChange={(e) => {
            if (timer.isRunning) {
              timer.update({ description: e.target.value })
            } else {
              setDescription(e.target.value)
            }
          }}
          className={cn(
            'w-full rounded-md border border-border bg-background px-2.5 py-1.5',
            'text-[13px] text-foreground placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
          )}
          readOnly={false}
        />

        {/* Block + billable row */}
        <div className="flex items-center gap-2">
          {timer.isRunning && timer.blockName && (
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground truncate max-w-[140px]">
              {timer.blockName}
            </span>
          )}
          <button
            onClick={() => {
              if (timer.isRunning) {
                timer.update({ isBillable: !timer.isBillable })
              } else {
                setIsBillable(!isBillable)
              }
            }}
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
              (timer.isRunning ? timer.isBillable : isBillable)
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
            aria-label="Toggle billable"
          >
            <DollarSign className="h-3 w-3" />
            Billable
          </button>
        </div>
      </div>

      {/* Timebox selector (pre-start only) */}
      {!timer.isRunning && (
        <div className="px-3 pb-1">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground">Timebox:</span>
            {[null, 15, 25, 45, 60].map((mins) => (
              <button
                key={mins ?? 'none'}
                onClick={() => setTimeboxMinutes(mins)}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                  timeboxMinutes === mins
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {mins ? `${mins}m` : 'Off'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-3 pb-3">
        {timer.isRunning ? (
          <button
            onClick={() => timer.stop()}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-md px-3 py-2',
              'bg-destructive text-destructive-foreground text-[13px] font-medium',
              'hover:bg-destructive/90 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <Square className="h-3.5 w-3.5" />
            Stop
          </button>
        ) : (
          <button
            onClick={() => {
              timer.start({
                description,
                isBillable,
                timeboxSeconds: timeboxMinutes ? timeboxMinutes * 60 : null,
              })
              setDescription('')
              setIsBillable(false)
              setTimeboxMinutes(null)
            }}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-md px-3 py-2',
              'bg-primary text-primary-foreground text-[13px] font-medium',
              'hover:bg-primary/90 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
          >
            <Play className="h-3.5 w-3.5" />
            Start
          </button>
        )}
      </div>
    </div>
  )
}
