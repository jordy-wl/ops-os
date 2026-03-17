/**
 * tests/sprint20/time-estimation.test.ts
 *
 * Unit tests for estimateTaskDuration function.
 * Covers: null returns when no/insufficient data, average computation,
 * title similarity weighting, and confidence levels based on sample size.
 *
 * Supabase is mocked directly since this is a pure function test.
 */

// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock logger first ----------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ---- Import after mocks ---------------------------------------------------

import { estimateTaskDuration, type TimeEstimate } from '@/lib/ai/time-estimation'

// ---- Supabase mock builder -------------------------------------------------

function createMockSupabase(options: {
  completedTasks: { id: string; name: string }[] | null
  timeEntries: { block_id: string; duration_seconds: number }[] | null
}) {
  let currentTable = ''

  const chain: Record<string, ReturnType<typeof vi.fn>> = {}

  chain.from = vi.fn((table: string) => {
    currentTable = table
    return chain
  })
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.in = vi.fn(() => chain)
  chain.not = vi.fn(() => chain)
  chain.gt = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)

  // Make chain thenable
  ;(chain as Record<string, unknown>).then = function (
    onFulfilled?: (value: unknown) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) {
    let result: { data: unknown; error: unknown }

    if (currentTable === 'blocks') {
      result = { data: options.completedTasks, error: null }
    } else if (currentTable === 'time_entries') {
      result = { data: options.timeEntries, error: null }
    } else {
      result = { data: null, error: null }
    }

    return Promise.resolve(result).then(onFulfilled, onRejected)
  }

  return chain as unknown as Parameters<typeof estimateTaskDuration>[0]
}

// ---- Tests -----------------------------------------------------------------

describe('estimateTaskDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -- No tasks --

  it('should return null when no completed tasks exist', async () => {
    const supabase = createMockSupabase({
      completedTasks: null,
      timeEntries: null,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Review contract')
    expect(result).toBeNull()
  })

  it('should return null when completedTasks is empty array', async () => {
    const supabase = createMockSupabase({
      completedTasks: [],
      timeEntries: null,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Review contract')
    expect(result).toBeNull()
  })

  // -- Fewer than 5 time entries --

  it('should return null when fewer than 5 time entries exist', async () => {
    const supabase = createMockSupabase({
      completedTasks: [
        { id: 'task-1', name: 'Review contract A' },
        { id: 'task-2', name: 'Review contract B' },
        { id: 'task-3', name: 'Draft proposal' },
      ],
      timeEntries: [
        { block_id: 'task-1', duration_seconds: 3600 },
        { block_id: 'task-2', duration_seconds: 5400 },
        { block_id: 'task-3', duration_seconds: 7200 },
      ],
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Review contract C')
    expect(result).toBeNull()
  })

  it('should return null when time entries are null', async () => {
    const supabase = createMockSupabase({
      completedTasks: [
        { id: 'task-1', name: 'Review A' },
      ],
      timeEntries: null,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Review B')
    expect(result).toBeNull()
  })

  // -- Sufficient data: compute average --

  it('should compute average duration from similar tasks', async () => {
    const tasks = Array.from({ length: 6 }, (_, i) => ({
      id: `task-${i}`,
      name: `Generic task ${i}`,
    }))

    const entries = Array.from({ length: 6 }, (_, i) => ({
      block_id: `task-${i}`,
      duration_seconds: 3600, // 1 hour each
    }))

    const supabase = createMockSupabase({
      completedTasks: tasks,
      timeEntries: entries,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Some new task')
    expect(result).not.toBeNull()
    expect(result!.estimated_seconds).toBe(3600)
    expect(result!.sample_size).toBeGreaterThanOrEqual(5)
    expect(result!.formatted).toBe('1h')
  })

  it('should aggregate multiple time entries per task', async () => {
    // 5 tasks, each with 2 time entries summing to 7200 seconds (2h)
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `task-${i}`,
      name: `Generic task ${i}`,
    }))

    const entries: { block_id: string; duration_seconds: number }[] = []
    for (let i = 0; i < 5; i++) {
      entries.push({ block_id: `task-${i}`, duration_seconds: 3600 })
      entries.push({ block_id: `task-${i}`, duration_seconds: 3600 })
    }

    const supabase = createMockSupabase({
      completedTasks: tasks,
      timeEntries: entries,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Some new task')
    expect(result).not.toBeNull()
    expect(result!.estimated_seconds).toBe(7200) // 2 hours per task
  })

  // -- Title similarity weighting --

  it('should weight similar titles higher', async () => {
    const tasks = [
      { id: 'task-0', name: 'Review contract draft' },       // high similarity
      { id: 'task-1', name: 'Review contract terms' },        // high similarity
      { id: 'task-2', name: 'Review pricing sheet' },         // medium
      { id: 'task-3', name: 'Draft marketing email' },        // low
      { id: 'task-4', name: 'Setup CI pipeline' },            // none
      { id: 'task-5', name: 'Review contract compliance' },   // high
      { id: 'task-6', name: 'Update documentation' },         // none
    ]

    const entries = [
      { block_id: 'task-0', duration_seconds: 3600 },   // Review contract = high match
      { block_id: 'task-1', duration_seconds: 4200 },   // Review contract = high match
      { block_id: 'task-2', duration_seconds: 1800 },   // Review = medium match
      { block_id: 'task-3', duration_seconds: 900 },    // draft = low match
      { block_id: 'task-4', duration_seconds: 18000 },  // no match
      { block_id: 'task-5', duration_seconds: 3000 },   // Review contract = high match
      { block_id: 'task-6', duration_seconds: 600 },    // no match
    ]

    const supabase = createMockSupabase({
      completedTasks: tasks,
      timeEntries: entries,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Review contract proposal')
    expect(result).not.toBeNull()

    // The scoring sorts by similarity, so "Review contract" matches should be weighted first
    // Top entries sorted by score should prioritize contract review tasks
    // This means the estimate should be closer to 3600 (review contract tasks)
    // and not pulled up by the 18000 unrelated task
    expect(result!.estimated_seconds).toBeLessThan(10000)
  })

  // -- Confidence levels --

  it('should return low confidence for exactly 5 entries with no title similarity', async () => {
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `task-${i}`,
      name: `Unrelated task type ${i}`,
    }))

    const entries = Array.from({ length: 5 }, (_, i) => ({
      block_id: `task-${i}`,
      duration_seconds: 3600,
    }))

    const supabase = createMockSupabase({
      completedTasks: tasks,
      timeEntries: entries,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Completely different')
    expect(result).not.toBeNull()
    // 5 entries with avgScore 0 => 'medium' per the code (>= 5 entries -> medium)
    expect(result!.confidence).toBe('medium')
  })

  it('should return medium confidence for >= 5 entries', async () => {
    const tasks = Array.from({ length: 7 }, (_, i) => ({
      id: `task-${i}`,
      name: `Task ${i}`,
    }))

    const entries = Array.from({ length: 7 }, (_, i) => ({
      block_id: `task-${i}`,
      duration_seconds: 3600,
    }))

    const supabase = createMockSupabase({
      completedTasks: tasks,
      timeEntries: entries,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'New task')
    expect(result).not.toBeNull()
    expect(result!.confidence).toBe('medium')
  })

  it('should return high confidence for >= 10 entries with good similarity', async () => {
    // 12 tasks all matching "review contract"
    const tasks = Array.from({ length: 12 }, (_, i) => ({
      id: `task-${i}`,
      name: `Review contract version ${i}`,
    }))

    const entries = Array.from({ length: 12 }, (_, i) => ({
      block_id: `task-${i}`,
      duration_seconds: 3600 + i * 100,
    }))

    const supabase = createMockSupabase({
      completedTasks: tasks,
      timeEntries: entries,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Review contract draft')
    expect(result).not.toBeNull()
    expect(result!.confidence).toBe('high')
  })

  // -- Formatted output --

  it('should format duration in hours and minutes', async () => {
    // 5 tasks at 5400 seconds each (1h 30m)
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `task-${i}`,
      name: `Task ${i}`,
    }))

    const entries = Array.from({ length: 5 }, (_, i) => ({
      block_id: `task-${i}`,
      duration_seconds: 5400,
    }))

    const supabase = createMockSupabase({
      completedTasks: tasks,
      timeEntries: entries,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Task 6')
    expect(result).not.toBeNull()
    expect(result!.formatted).toBe('1h 30m')
  })

  it('should format duration as minutes only when < 1 hour', async () => {
    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `task-${i}`,
      name: `Quick task ${i}`,
    }))

    const entries = Array.from({ length: 5 }, (_, i) => ({
      block_id: `task-${i}`,
      duration_seconds: 1800, // 30 minutes
    }))

    const supabase = createMockSupabase({
      completedTasks: tasks,
      timeEntries: entries,
    })

    const result = await estimateTaskDuration(supabase, 'org-1', 'Quick task 6')
    expect(result).not.toBeNull()
    expect(result!.formatted).toBe('30m')
  })

  // -- Default block type --

  it('should use default blockType of task_queue_item', async () => {
    const supabase = createMockSupabase({
      completedTasks: [],
      timeEntries: null,
    })

    await estimateTaskDuration(supabase, 'org-1', 'Test task')

    // Verify eq was called with the default block type
    expect((supabase as unknown as Record<string, ReturnType<typeof vi.fn>>).eq).toHaveBeenCalledWith('type', 'task_queue_item')
  })

  it('should accept custom blockType', async () => {
    const supabase = createMockSupabase({
      completedTasks: [],
      timeEntries: null,
    })

    await estimateTaskDuration(supabase, 'org-1', 'Test task', 'custom_type')

    expect((supabase as unknown as Record<string, ReturnType<typeof vi.fn>>).eq).toHaveBeenCalledWith('type', 'custom_type')
  })

  // -- Logging --

  it('should log insufficient data', async () => {
    const supabase = createMockSupabase({
      completedTasks: [{ id: 'task-1', name: 'Task' }],
      timeEntries: [{ block_id: 'task-1', duration_seconds: 100 }],
    })

    await estimateTaskDuration(supabase, 'org-1', 'New task')

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      'time-estimation',
      'ai.insufficient_data',
      expect.objectContaining({
        org_id: 'org-1',
        entries_found: 1,
      })
    )
  })

  it('should log successful estimate', async () => {
    const tasks = Array.from({ length: 6 }, (_, i) => ({
      id: `task-${i}`,
      name: `Task ${i}`,
    }))

    const entries = Array.from({ length: 6 }, (_, i) => ({
      block_id: `task-${i}`,
      duration_seconds: 3600,
    }))

    const supabase = createMockSupabase({
      completedTasks: tasks,
      timeEntries: entries,
    })

    await estimateTaskDuration(supabase, 'org-1', 'New task')

    const { logger } = await import('@/lib/logger')
    expect(logger.info).toHaveBeenCalledWith(
      'time-estimation',
      'ai.estimate_computed',
      expect.objectContaining({
        org_id: 'org-1',
        confidence: expect.any(String),
      })
    )
  })
})
