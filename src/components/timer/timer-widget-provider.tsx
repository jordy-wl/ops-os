'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TimerState {
  /** Whether a timer is currently running */
  isRunning: boolean
  /** Timestamp (ms) when the timer started — used for elapsed calculation */
  startedAt: number | null
  /** Block ID the timer is associated with (nullable) */
  blockId: string | null
  /** Block name for display */
  blockName: string | null
  /** Timer description */
  description: string
  /** Whether the entry is billable */
  isBillable: boolean
  /** Timebox target in seconds (null = no timebox) */
  timeboxSeconds: number | null
  /** Server-side entry ID (set after POST to /api/time-entries) */
  entryId: string | null
}

export interface TimerActions {
  /** Start a new timer */
  start: (opts?: {
    blockId?: string | null
    blockName?: string | null
    description?: string
    isBillable?: boolean
    timeboxSeconds?: number | null
  }) => Promise<void>
  /** Stop the running timer */
  stop: () => Promise<void>
  /** Update description or billable flag mid-timer */
  update: (updates: { description?: string; isBillable?: boolean; blockId?: string | null; blockName?: string | null }) => void
  /** Current elapsed time in seconds (re-renders every second) */
  elapsedSeconds: number
}

type TimerContextValue = TimerState & TimerActions

const TimerContext = createContext<TimerContextValue | null>(null)

const STORAGE_KEY = 'ops-os-timer-state'

// ─── Provider ───────────────────────────────────────────────────────────────

export function TimerWidgetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TimerState>({
    isRunning: false,
    startedAt: null,
    blockId: null,
    blockName: null,
    description: '',
    isBillable: false,
    timeboxSeconds: null,
    entryId: null,
  })
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Restore state from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as TimerState
        if (parsed.isRunning && parsed.startedAt) {
          setState(parsed)
        }
      }
    } catch {
      // Corrupt localStorage — ignore
    }
  }, [])

  // Persist state to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  // Tick: compute elapsed from timestamp (AD-3: no drift)
  useEffect(() => {
    if (state.isRunning && state.startedAt) {
      const tick = () => {
        setElapsedSeconds(Math.floor((Date.now() - state.startedAt!) / 1000))
      }
      tick() // immediate
      intervalRef.current = setInterval(tick, 1000)
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    } else {
      setElapsedSeconds(0)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [state.isRunning, state.startedAt])

  // Also sync with server on mount — check if there's an active timer
  useEffect(() => {
    async function syncActive() {
      try {
        const res = await fetch('/api/time-entries/active')
        if (!res.ok) return
        const { data } = await res.json()
        if (data && !data.ended_at) {
          setState({
            isRunning: true,
            startedAt: new Date(data.started_at).getTime(),
            blockId: data.block_id,
            blockName: null,
            description: data.description ?? '',
            isBillable: data.is_billable ?? false,
            timeboxSeconds: null,
            entryId: data.id,
          })
        }
      } catch {
        // Non-critical — local state takes precedence
      }
    }
    syncActive()
  }, [])

  const start = useCallback(async (opts?: {
    blockId?: string | null
    blockName?: string | null
    description?: string
    isBillable?: boolean
    timeboxSeconds?: number | null
  }) => {
    const now = new Date()

    // POST to server first
    try {
      const res = await fetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block_id: opts?.blockId ?? null,
          description: opts?.description ?? '',
          started_at: now.toISOString(),
          is_billable: opts?.isBillable ?? false,
        }),
      })
      const { data } = await res.json()

      setState({
        isRunning: true,
        startedAt: now.getTime(),
        blockId: opts?.blockId ?? null,
        blockName: opts?.blockName ?? null,
        description: opts?.description ?? '',
        isBillable: opts?.isBillable ?? false,
        timeboxSeconds: opts?.timeboxSeconds ?? null,
        entryId: data?.id ?? null,
      })
    } catch {
      // Start locally even if server fails — we'll sync later
      setState({
        isRunning: true,
        startedAt: now.getTime(),
        blockId: opts?.blockId ?? null,
        blockName: opts?.blockName ?? null,
        description: opts?.description ?? '',
        isBillable: opts?.isBillable ?? false,
        timeboxSeconds: opts?.timeboxSeconds ?? null,
        entryId: null,
      })
    }
  }, [])

  const stop = useCallback(async () => {
    if (!state.isRunning) return

    // Stop the server timer
    if (state.entryId) {
      try {
        await fetch('/api/time-entries/active', { method: 'PATCH' })
      } catch {
        // Best-effort — timer is stopped locally regardless
      }
    }

    setState({
      isRunning: false,
      startedAt: null,
      blockId: null,
      blockName: null,
      description: '',
      isBillable: false,
      timeboxSeconds: null,
      entryId: null,
    })
    localStorage.removeItem(STORAGE_KEY)
  }, [state.isRunning, state.entryId])

  const update = useCallback((updates: {
    description?: string
    isBillable?: boolean
    blockId?: string | null
    blockName?: string | null
  }) => {
    setState((prev) => ({ ...prev, ...updates }))
  }, [])

  return (
    <TimerContext.Provider value={{ ...state, elapsedSeconds, start, stop, update }}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimer() {
  const ctx = useContext(TimerContext)
  if (!ctx) throw new Error('useTimer must be used within TimerWidgetProvider')
  return ctx
}
