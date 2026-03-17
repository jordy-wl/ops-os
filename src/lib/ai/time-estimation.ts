/**
 * AI Time Estimation — estimates task duration based on similar completed tasks.
 *
 * Looks up completed tasks in the same org with similar block types and titles,
 * joins against time_entries to find actual durations, and computes an average.
 *
 * Returns null when there's insufficient data (< 5 similar entries).
 */

import { logger } from '@/lib/logger'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface TimeEstimate {
  /** Estimated duration in seconds */
  estimated_seconds: number
  /** Number of similar tasks used for the estimate */
  sample_size: number
  /** Confidence level based on sample size */
  confidence: 'low' | 'medium' | 'high'
  /** Human-readable formatted estimate */
  formatted: string
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Estimate how long a task will take based on historical data.
 *
 * @param supabase - Supabase client
 * @param orgId - Organization ID
 * @param taskName - Name/title of the task
 * @param blockType - Block type (default: 'task_queue_item')
 * @returns TimeEstimate or null if insufficient data
 */
export async function estimateTaskDuration(
  supabase: SupabaseClient,
  orgId: string,
  taskName: string,
  blockType = 'task_queue_item'
): Promise<TimeEstimate | null> {
  try {
    // Find completed tasks of the same type with time entries
    // First, get completed task IDs
    const { data: completedTasks } = await supabase
      .from('blocks')
      .select('id, name')
      .eq('org_id', orgId)
      .eq('type', blockType)
      .limit(100)

    if (!completedTasks || completedTasks.length === 0) return null

    // Filter to tasks whose metadata indicates completion
    const taskIds = completedTasks.map((t) => t.id)

    // Get time entries for these tasks
    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select('block_id, duration_seconds')
      .eq('org_id', orgId)
      .in('block_id', taskIds)
      .not('duration_seconds', 'is', null)
      .gt('duration_seconds', 0)

    if (!timeEntries || timeEntries.length < 5) {
      logger.info('time-estimation', 'ai.insufficient_data', {
        org_id: orgId,
        task_name: taskName,
        entries_found: timeEntries?.length ?? 0,
      })
      return null
    }

    // Compute total duration per task (sum multiple entries for same block)
    const taskDurations = new Map<string, number>()
    for (const entry of timeEntries) {
      if (!entry.block_id) continue
      const prev = taskDurations.get(entry.block_id) ?? 0
      taskDurations.set(entry.block_id, prev + entry.duration_seconds)
    }

    const durations = Array.from(taskDurations.values())

    if (durations.length < 5) return null

    // Simple keyword matching to weight similar tasks higher
    const words = taskName.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    const taskNameMap = new Map(completedTasks.map((t) => [t.id, t.name.toLowerCase()]))

    // Score each task by title similarity
    const scored = Array.from(taskDurations.entries()).map(([taskId, totalSec]) => {
      const name = taskNameMap.get(taskId) ?? ''
      const matchCount = words.filter((w) => name.includes(w)).length
      return { taskId, totalSec, score: matchCount }
    })

    // Sort by similarity score (highest first), use top entries
    scored.sort((a, b) => b.score - a.score)

    // Take top-scoring entries (at least 5, up to 20)
    const topEntries = scored.slice(0, Math.max(5, Math.min(20, scored.length)))
    const avgDuration = Math.round(
      topEntries.reduce((sum, e) => sum + e.totalSec, 0) / topEntries.length
    )

    // Confidence based on sample size and similarity
    const avgScore = topEntries.reduce((s, e) => s + e.score, 0) / topEntries.length
    let confidence: 'low' | 'medium' | 'high' = 'low'
    if (topEntries.length >= 10 && avgScore >= 1) confidence = 'high'
    else if (topEntries.length >= 5) confidence = 'medium'

    logger.info('time-estimation', 'ai.estimate_computed', {
      org_id: orgId,
      task_name: taskName,
      sample_size: topEntries.length,
      estimated_seconds: avgDuration,
      confidence,
    })

    return {
      estimated_seconds: avgDuration,
      sample_size: topEntries.length,
      confidence,
      formatted: formatDuration(avgDuration),
    }
  } catch (err) {
    logger.error('time-estimation', 'ai.estimation_failed', {
      error: err instanceof Error ? err.message : 'Unknown error',
    })
    return null
  }
}
