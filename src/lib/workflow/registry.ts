import { onboardingHandler } from '@/lib/workflow/handlers/onboarding'
import type { WorkflowHandler } from '@/lib/workflow/types'

/**
 * Workflow Handler Registry — maps workflow_jobs.type to its handler.
 *
 * To add a new workflow type:
 *   1. Create `src/lib/workflow/handlers/{type}.ts` and export a WorkflowHandler
 *   2. Import and register it here
 *   3. The engine auto-dispatches — no other changes needed
 */
export const WORKFLOW_REGISTRY: Record<string, WorkflowHandler> = {
  onboarding: onboardingHandler,
}
