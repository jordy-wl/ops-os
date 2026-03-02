import type { SupabaseClient } from '@supabase/supabase-js'

export type WorkflowJobStatus = 'pending' | 'running' | 'done' | 'failed'

/** Raw workflow_jobs row as returned from Supabase. */
export interface WorkflowJob {
  id: string
  org_id: string
  block_id: string | null
  type: string
  status: WorkflowJobStatus
  payload: Record<string, unknown>
  attempts: number
  scheduled_at: string
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

/** Context passed to every workflow handler. */
export interface WorkflowContext {
  jobId: string
  orgId: string
  blockId: string | null
  payload: Record<string, unknown>
  supabase: SupabaseClient
}

/**
 * WorkflowHandler — async function that executes a single workflow job.
 * Throws on failure; the engine handles retry and failure bookkeeping.
 */
export type WorkflowHandler = (ctx: WorkflowContext) => Promise<void>
