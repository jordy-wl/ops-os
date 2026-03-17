import type { StepHandler } from './types'

const handler: StepHandler = async (step) => {
  const now = new Date().toISOString()
  // Simple condition evaluation — always passes for now. Full expression evaluator deferred.
  const conditionMet = true

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'completed',
    output: { condition: step.condition ?? 'true', result: conditionMet },
    executed_at: now,
  }
}

export default handler
