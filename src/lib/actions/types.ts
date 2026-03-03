import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import type { AuthContext } from '@/lib/auth/withAuth'

/**
 * ActionResult — the standard response shape returned by every action handler.
 * `actionId` is a server-generated UUID for idempotency tracking.
 * `workflowJobId` is only present when the action enqueues a workflow job.
 */
export type ActionResult = {
  actionId: string
  eventId: string | null
  workflowJobId?: string | null
  status: 'completed' | 'pending' | 'failed'
}

/**
 * ActionHandler — generic contract for all action handlers.
 *
 * @typeParam T - The validated payload type (inferred from the Zod schema)
 *
 * Each handler exports:
 *   - `schema`: Zod schema for payload validation
 *   - `execute`: async function that performs the mutation and returns ActionResult
 *
 * To add a new action type:
 *   1. Create `src/lib/actions/handlers/{action-name}.ts`
 *   2. Export `schema` and `execute` matching this interface
 *   3. Register in `src/lib/actions/registry.ts`
 */
export interface ActionHandler<T> {
  schema: z.ZodType<T, z.ZodTypeDef, unknown>
  execute: (
    payload: T,
    ctx: AuthContext,
    supabase: SupabaseClient
  ) => Promise<ActionResult>
}
