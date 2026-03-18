import type { StepHandler } from './types'

/**
 * For Each step handler — iterates over a collection and runs steps for each item.
 * Sprint 23 placeholder: marks step as completed with iteration metadata.
 * Actual iteration logic will be implemented in a future sprint.
 */
const handler: StepHandler = async (step) => {
  const now = new Date().toISOString()
  const source = (step as Record<string, unknown>).for_each_source as string | undefined
  const maxIterations = (step as Record<string, unknown>).for_each_max_iterations as number | undefined
  const maxParallel = (step as Record<string, unknown>).for_each_max_parallel as number | undefined

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'completed',
    output: {
      for_each_source: source ?? 'unknown',
      max_iterations: maxIterations ?? 100,
      max_parallel: maxParallel ?? 1,
      iterations_completed: 0,
      note: 'For-each iteration engine pending — step marked complete for Sprint 23',
    },
    executed_at: now,
  }
}

export default handler
