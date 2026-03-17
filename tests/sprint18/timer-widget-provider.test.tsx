/**
 * tests/sprint18/timer-widget-provider.test.tsx
 *
 * Unit tests for TimerWidgetProvider and useTimer hook.
 * Covers: initial state, start/stop/update actions, localStorage
 * persistence, and localStorage restore on mount.
 *
 * Uses vitest + @testing-library/react in jsdom environment.
 * Uses real timers (not fake) because the provider uses fetch which is async.
 */

// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { TimerWidgetProvider, useTimer } from '@/components/timer/timer-widget-provider'
import type { TimerState } from '@/components/timer/timer-widget-provider'

// ---- localStorage mock ------------------------------------------------------

const store: Record<string, string> = {}

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key]
  }),
  clear: vi.fn(() => {
    for (const key of Object.keys(store)) delete store[key]
  }),
})

// ---- Mock fetch for API calls -----------------------------------------------

const fetchSpy = vi.spyOn(global, 'fetch')

// ---- Test consumer component ------------------------------------------------

function TestConsumer() {
  const timer = useTimer()
  return (
    <div>
      <span data-testid="isRunning">{String(timer.isRunning)}</span>
      <span data-testid="startedAt">{String(timer.startedAt)}</span>
      <span data-testid="description">{timer.description}</span>
      <span data-testid="isBillable">{String(timer.isBillable)}</span>
      <span data-testid="elapsedSeconds">{timer.elapsedSeconds}</span>
      <span data-testid="blockId">{String(timer.blockId)}</span>
      <span data-testid="entryId">{String(timer.entryId)}</span>
      <span data-testid="timeboxSeconds">{String(timer.timeboxSeconds)}</span>
      <button data-testid="start" onClick={() => timer.start({
        description: 'Test task',
        isBillable: true,
        timeboxSeconds: 1500,
        blockId: 'block-123',
        blockName: 'My Block',
      })}>Start</button>
      <button data-testid="stop" onClick={() => timer.stop()}>Stop</button>
      <button data-testid="update" onClick={() => timer.update({
        description: 'Updated desc',
        isBillable: false,
      })}>Update</button>
    </div>
  )
}

function renderWithProvider() {
  return render(
    <TimerWidgetProvider>
      <TestConsumer />
    </TimerWidgetProvider>
  )
}

// ---- Default fetch mock that returns no active timer ------------------------

function mockFetchDefault() {
  fetchSpy.mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    if (url.includes('/api/time-entries/active')) {
      return new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // POST to /api/time-entries
    return new Response(
      JSON.stringify({ data: { id: 'server-entry-1' } }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )
  })
}

// ---- Tests -----------------------------------------------------------------

describe('TimerWidgetProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear store
    for (const key of Object.keys(store)) delete store[key]
    mockFetchDefault()
  })

  it('should have initial state of not running', async () => {
    renderWithProvider()

    // Wait for any useEffect to settle (syncActive fetch)
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    expect(screen.getByTestId('isRunning').textContent).toBe('false')
    expect(screen.getByTestId('startedAt').textContent).toBe('null')
    expect(screen.getByTestId('description').textContent).toBe('')
    expect(screen.getByTestId('isBillable').textContent).toBe('false')
    expect(screen.getByTestId('elapsedSeconds').textContent).toBe('0')
  })

  it('should set isRunning and startedAt when start() is called', async () => {
    renderWithProvider()

    await act(async () => {
      screen.getByTestId('start').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('true')
    })
    expect(screen.getByTestId('startedAt').textContent).not.toBe('null')
    expect(screen.getByTestId('description').textContent).toBe('Test task')
    expect(screen.getByTestId('isBillable').textContent).toBe('true')
    expect(screen.getByTestId('timeboxSeconds').textContent).toBe('1500')
    expect(screen.getByTestId('blockId').textContent).toBe('block-123')
  })

  it('should reset state when stop() is called', async () => {
    renderWithProvider()

    // Start first
    await act(async () => {
      screen.getByTestId('start').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('true')
    })

    // Now stop
    await act(async () => {
      screen.getByTestId('stop').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('false')
    })
    expect(screen.getByTestId('startedAt').textContent).toBe('null')
    expect(screen.getByTestId('description').textContent).toBe('')
    expect(screen.getByTestId('isBillable').textContent).toBe('false')
  })

  it('should update description and billable via update()', async () => {
    renderWithProvider()

    // Start
    await act(async () => {
      screen.getByTestId('start').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('description').textContent).toBe('Test task')
    })

    // Update
    await act(async () => {
      screen.getByTestId('update').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('description').textContent).toBe('Updated desc')
    })
    expect(screen.getByTestId('isBillable').textContent).toBe('false')
  })

  it('should persist state to localStorage on change', async () => {
    renderWithProvider()

    await act(async () => {
      screen.getByTestId('start').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('true')
    })

    // localStorage.setItem should have been called with the timer state
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'ops-os-timer-state',
      expect.any(String)
    )

    // Parse the stored value to verify
    const calls = (localStorage.setItem as ReturnType<typeof vi.fn>).mock.calls
    const lastCall = calls[calls.length - 1]
    const parsed = JSON.parse(lastCall[1]) as TimerState
    expect(parsed.isRunning).toBe(true)
    expect(parsed.description).toBe('Test task')
  })

  it('should restore state from localStorage on mount', async () => {
    // Pre-populate localStorage with a running timer
    const savedState: TimerState = {
      isRunning: true,
      startedAt: Date.now() - 60_000,
      blockId: null,
      blockName: null,
      description: 'Restored task',
      isBillable: true,
      timeboxSeconds: null,
      entryId: 'server-entry-saved',
    }
    store['ops-os-timer-state'] = JSON.stringify(savedState)

    renderWithProvider()

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('true')
    })
    expect(screen.getByTestId('description').textContent).toBe('Restored task')
    expect(screen.getByTestId('isBillable').textContent).toBe('true')
  })

  it('should NOT restore non-running state from localStorage', async () => {
    const savedState: TimerState = {
      isRunning: false,
      startedAt: null,
      blockId: null,
      blockName: null,
      description: 'Old task',
      isBillable: false,
      timeboxSeconds: null,
      entryId: null,
    }
    store['ops-os-timer-state'] = JSON.stringify(savedState)

    renderWithProvider()

    // Wait for effects to settle
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    expect(screen.getByTestId('isRunning').textContent).toBe('false')
    expect(screen.getByTestId('description').textContent).toBe('')
  })

  it('should remove localStorage on stop', async () => {
    renderWithProvider()

    // Start
    await act(async () => {
      screen.getByTestId('start').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('true')
    })

    // Stop
    await act(async () => {
      screen.getByTestId('stop').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('false')
    })

    expect(localStorage.removeItem).toHaveBeenCalledWith('ops-os-timer-state')
  })

  it('should handle corrupt localStorage gracefully', async () => {
    store['ops-os-timer-state'] = 'not valid json {'

    // Should not throw
    renderWithProvider()

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled()
    })

    expect(screen.getByTestId('isRunning').textContent).toBe('false')
  })

  it('should sync with server on mount when server has active timer', async () => {
    fetchSpy.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url.includes('/api/time-entries/active')) {
        return new Response(
          JSON.stringify({
            data: {
              id: 'server-active',
              started_at: new Date(Date.now() - 300_000).toISOString(),
              ended_at: null,
              block_id: null,
              description: 'Server task',
              is_billable: true,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }
      return new Response(JSON.stringify({ data: null }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    renderWithProvider()

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('true')
    })
    expect(screen.getByTestId('description').textContent).toBe('Server task')
    expect(screen.getByTestId('entryId').textContent).toBe('server-active')
  })

  it('should POST to /api/time-entries when starting timer', async () => {
    renderWithProvider()

    await act(async () => {
      screen.getByTestId('start').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('true')
    })

    // Verify the POST call
    const postCalls = fetchSpy.mock.calls.filter(([input]) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      return url.includes('/api/time-entries') && !url.includes('/active')
    })
    expect(postCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('should PATCH /api/time-entries/active when stopping timer', async () => {
    renderWithProvider()

    // Start
    await act(async () => {
      screen.getByTestId('start').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('true')
    })

    // Stop
    await act(async () => {
      screen.getByTestId('stop').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('isRunning').textContent).toBe('false')
    })

    // Verify the PATCH call to /active
    const patchCalls = fetchSpy.mock.calls.filter(([input, opts]) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      return url.includes('/api/time-entries/active') && (opts as RequestInit)?.method === 'PATCH'
    })
    expect(patchCalls.length).toBeGreaterThanOrEqual(1)
  })
})

describe('useTimer outside provider', () => {
  it('should throw when used outside TimerWidgetProvider', () => {
    function BadConsumer() {
      useTimer()
      return null
    }

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<BadConsumer />)).toThrow(
      'useTimer must be used within TimerWidgetProvider'
    )
    spy.mockRestore()
  })
})
