import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { WorkflowStep } from './template-schema'

export type StepResult = {
  step_name: string
  step_type: string
  status: 'completed' | 'failed' | 'waiting'
  output?: Record<string, unknown>
  error?: string
  executed_at: string
}

type InstanceMetadata = {
  template_id: string
  source_block_id: string
  applies_to_type: string
  status: 'pending' | 'running' | 'done' | 'failed'
  current_step_index: number
  step_results: StepResult[]
  started_at: string | null
  completed_at: string | null
}

type AdvanceResult = {
  status: 'advanced' | 'completed' | 'waiting' | 'failed'
  step_result: StepResult
  instance_status: string
}

/**
 * Advances a workflow instance by executing its current step.
 * Returns the result of the step execution.
 */
export async function advanceWorkflowInstance(
  instanceId: string,
  orgId: string
): Promise<AdvanceResult> {
  const supabase = createServerClient()

  // 1. Read the instance
  const { data: instance, error: instanceError } = await supabase
    .from('blocks')
    .select('id, metadata, name')
    .eq('id', instanceId)
    .eq('org_id', orgId)
    .eq('type', 'workflow_instance')
    .single()

  if (instanceError || !instance) {
    throw new Error(`Instance not found: ${instanceId}`)
  }

  const meta = instance.metadata as InstanceMetadata

  if (meta.status === 'done' || meta.status === 'failed') {
    throw new Error(`Instance ${instanceId} is already ${meta.status}`)
  }

  // 2. Read the template to get steps
  const { data: template, error: templateError } = await supabase
    .from('blocks')
    .select('id, metadata')
    .eq('id', meta.template_id)
    .eq('type', 'workflow_template')
    .single()

  if (templateError || !template) {
    throw new Error(`Template not found: ${meta.template_id}`)
  }

  const templateMeta = template.metadata as { steps: WorkflowStep[] }
  const steps = templateMeta.steps

  if (meta.current_step_index >= steps.length) {
    throw new Error(`Step index ${meta.current_step_index} out of bounds (${steps.length} steps)`)
  }

  const currentStep = steps[meta.current_step_index]
  const now = new Date().toISOString()

  // Mark as running if this is the first step
  if (meta.status === 'pending') {
    await supabase
      .from('blocks')
      .update({
        metadata: { ...meta, status: 'running', started_at: now },
      })
      .eq('id', instanceId)
    meta.status = 'running'
    meta.started_at = now
  }

  // 3. Execute the step
  let stepResult: StepResult

  try {
    stepResult = await executeStep(currentStep, meta, orgId, supabase)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error'
    stepResult = {
      step_name: currentStep.name,
      step_type: currentStep.type,
      status: 'failed',
      error: errorMsg,
      executed_at: now,
    }
  }

  // 4. Record result and advance
  const updatedResults = [...meta.step_results, stepResult]
  const nextIndex = meta.current_step_index + 1

  let instanceStatus: InstanceMetadata['status'] = 'running'
  let completedAt: string | null = null

  if (stepResult.status === 'failed') {
    instanceStatus = 'failed'
    completedAt = now
  } else if (stepResult.status === 'waiting') {
    // Step is waiting (e.g. for a human task or timer) — don't advance
    instanceStatus = 'running'
  } else if (nextIndex >= steps.length) {
    instanceStatus = 'done'
    completedAt = now
  }

  const updatedMeta: InstanceMetadata = {
    ...meta,
    status: instanceStatus,
    current_step_index: stepResult.status === 'waiting' ? meta.current_step_index : nextIndex,
    step_results: updatedResults,
    completed_at: completedAt,
  }

  await supabase
    .from('blocks')
    .update({ metadata: updatedMeta })
    .eq('id', instanceId)

  // 5. Emit completion event if done
  if (instanceStatus === 'done') {
    await supabase.from('events').insert({
      org_id: orgId,
      block_id: instanceId,
      type: 'workflow.instance.completed',
      actor_type: 'system',
      payload: {
        template_id: meta.template_id,
        source_block_id: meta.source_block_id,
        step_count: steps.length,
        duration_ms: meta.started_at
          ? new Date(now).getTime() - new Date(meta.started_at).getTime()
          : null,
      },
    })
  }

  // 6. Emit step event
  await supabase.from('events').insert({
    org_id: orgId,
    block_id: instanceId,
    type: stepResult.status === 'failed' ? 'workflow.step.failed' : 'workflow.step.completed',
    actor_type: 'system',
    payload: {
      step_name: currentStep.name,
      step_type: currentStep.type,
      step_index: meta.current_step_index,
      result_status: stepResult.status,
    },
  })

  return {
    status: instanceStatus === 'done'
      ? 'completed'
      : stepResult.status === 'waiting'
        ? 'waiting'
        : stepResult.status === 'failed'
          ? 'failed'
          : 'advanced',
    step_result: stepResult,
    instance_status: instanceStatus,
  }
}

/**
 * Execute a single workflow step.
 */
async function executeStep(
  step: WorkflowStep,
  meta: InstanceMetadata,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<StepResult> {
  const now = new Date().toISOString()

  switch (step.type) {
    case 'emit_event': {
      if (!step.event_type) {
        return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing event_type', executed_at: now }
      }
      const { error } = await supabase.from('events').insert({
        org_id: orgId,
        block_id: meta.source_block_id,
        type: step.event_type,
        actor_type: 'workflow',
        payload: { workflow_instance_id: meta.template_id, step_name: step.name },
      })
      if (error) {
        logger.error('step-engine', 'step.emit_event_failed', { error_code: error.code })
        return { step_name: step.name, step_type: step.type, status: 'failed', error: error.message, executed_at: now }
      }
      return { step_name: step.name, step_type: step.type, status: 'completed', output: { event_type: step.event_type }, executed_at: now }
    }

    case 'run_action': {
      if (!step.action_type) {
        return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing action_type', executed_at: now }
      }
      // For now, emit an event recording the action request.
      // Full action dispatch will be wired in when the action registry supports it.
      await supabase.from('events').insert({
        org_id: orgId,
        block_id: meta.source_block_id,
        type: 'action.requested',
        actor_type: 'workflow',
        payload: { action_type: step.action_type, step_name: step.name, workflow_instance_id: meta.template_id },
      })
      return { step_name: step.name, step_type: step.type, status: 'completed', output: { action_type: step.action_type }, executed_at: now }
    }

    case 'wait': {
      const waitSeconds = step.wait_seconds ?? 60
      // Schedule a future workflow_job to resume this instance
      const scheduledAt = new Date(Date.now() + waitSeconds * 1000).toISOString()
      const { error } = await supabase.from('workflow_jobs').insert({
        org_id: orgId,
        workflow_type: 'resume_instance',
        step_name: step.name,
        status: 'pending',
        payload: { instance_id: meta.template_id, step_index: meta.current_step_index },
        scheduled_at: scheduledAt,
      })
      if (error) {
        logger.error('step-engine', 'step.wait_schedule_failed', { error_code: error.code })
        return { step_name: step.name, step_type: step.type, status: 'failed', error: error.message, executed_at: now }
      }
      return { step_name: step.name, step_type: step.type, status: 'waiting', output: { scheduled_at: scheduledAt, wait_seconds: waitSeconds }, executed_at: now }
    }

    case 'condition': {
      // Simple condition evaluation — check if the condition string matches a basic pattern
      // For now, conditions always pass (true). Full expression evaluator deferred.
      const conditionMet = true
      return {
        step_name: step.name,
        step_type: step.type,
        status: 'completed',
        output: { condition: step.condition ?? 'true', result: conditionMet },
        executed_at: now,
      }
    }

    case 'call_api': {
      return await executeCallApi(step, meta, orgId, supabase)
    }

    case 'send_email': {
      if (!step.connector_id) {
        return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing connector_id', executed_at: now }
      }
      const { REGISTRY } = await import('@/lib/actions/registry')
      const handler = REGISTRY['email.send']
      if (!handler) {
        return { step_name: step.name, step_type: step.type, status: 'failed', error: 'email.send handler not registered', executed_at: now }
      }
      const emailPayload = {
        connector_id: step.connector_id,
        to: (step as Record<string, unknown>).to as string ?? '',
        subject: (step as Record<string, unknown>).subject as string ?? step.name,
        body: (step as Record<string, unknown>).body as string ?? '',
        block_id: meta.source_block_id,
      }
      const emailResult = await handler.execute(emailPayload, { orgId, userId: 'system', clerkOrgId: '', role: 'ops-admin' as const }, supabase)
      return {
        step_name: step.name,
        step_type: step.type,
        status: emailResult.status === 'completed' ? 'completed' : 'failed',
        output: { action_id: emailResult.actionId, event_id: emailResult.eventId },
        executed_at: now,
      }
    }

    case 'book_meeting': {
      if (!step.connector_id) {
        return { step_name: step.name, step_type: step.type, status: 'failed', error: 'Missing connector_id', executed_at: now }
      }
      const { REGISTRY } = await import('@/lib/actions/registry')
      const handler = REGISTRY['meeting.book']
      if (!handler) {
        return { step_name: step.name, step_type: step.type, status: 'failed', error: 'meeting.book handler not registered', executed_at: now }
      }
      const meetingPayload = {
        connector_id: step.connector_id,
        title: (step as Record<string, unknown>).title as string ?? step.name,
        start: (step as Record<string, unknown>).start as string ?? new Date().toISOString(),
        end: (step as Record<string, unknown>).end as string ?? new Date(Date.now() + 3600000).toISOString(),
        attendees: (step as Record<string, unknown>).attendees as string[] ?? [],
        block_id: meta.source_block_id,
      }
      const meetingResult = await handler.execute(meetingPayload, { orgId, userId: 'system', clerkOrgId: '', role: 'ops-admin' as const }, supabase)
      return {
        step_name: step.name,
        step_type: step.type,
        status: meetingResult.status === 'completed' ? 'completed' : 'failed',
        output: { action_id: meetingResult.actionId, event_id: meetingResult.eventId },
        executed_at: now,
      }
    }

    case 'generate_document': {
      const { REGISTRY } = await import('@/lib/actions/registry')
      const handler = REGISTRY['document.generate']
      if (!handler) {
        return { step_name: step.name, step_type: step.type, status: 'failed', error: 'document.generate handler not registered', executed_at: now }
      }
      const docPayload = {
        source_block_id: meta.source_block_id,
        template_id: (step as Record<string, unknown>).template_id as string | undefined,
        prompt: (step as Record<string, unknown>).prompt as string | undefined,
        output_format: ((step as Record<string, unknown>).output_format as string) ?? 'html',
      }
      const docResult = await handler.execute(docPayload, { orgId, userId: 'system', clerkOrgId: '', role: 'ops-admin' as const }, supabase)
      return {
        step_name: step.name,
        step_type: step.type,
        status: docResult.status === 'completed' ? 'completed' : 'failed',
        output: { action_id: docResult.actionId, event_id: docResult.eventId },
        executed_at: now,
      }
    }

    default:
      return { step_name: step.name, step_type: step.type, status: 'failed', error: `Unknown step type: ${step.type}`, executed_at: now }
  }
}

// ─── call_api step handler ─────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5000
const MAX_TIMEOUT_MS = 30000
const DEFAULT_MAX_RETRIES = 1

/**
 * Interpolate {{block.*}} and {{context.*}} template variables in a string.
 * block.* resolves against the source block row, context.* against instance metadata.
 */
export function interpolateTemplate(
  template: string,
  variables: Record<string, Record<string, unknown>>
): string {
  return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_match, ns, key) => {
    const scope = variables[ns]
    if (!scope) return ''
    const val = scope[key]
    if (val === undefined || val === null) return ''
    return typeof val === 'object' ? JSON.stringify(val) : String(val)
  })
}

async function executeCallApi(
  step: WorkflowStep,
  meta: InstanceMetadata,
  orgId: string,
  supabase: ReturnType<typeof createServerClient>
): Promise<StepResult> {
  const now = new Date().toISOString()
  const fail = (error: string): StepResult => ({
    step_name: step.name, step_type: step.type, status: 'failed', error, executed_at: now,
  })

  // Validate required fields
  if (!step.connector_id) return fail('Missing connector_id')
  if (!step.method) return fail('Missing method')
  if (!step.path) return fail('Missing path')

  // Look up the connector
  const { data: connector, error: connError } = await supabase
    .from('integration_connectors')
    .select('id, config, credentials_ref, status')
    .eq('id', step.connector_id)
    .eq('org_id', orgId)
    .single()

  if (connError || !connector) {
    return fail(`Connector not found: ${step.connector_id}`)
  }

  if (connector.status !== 'active') {
    return fail(`Connector is ${connector.status}`)
  }

  const config = connector.config as Record<string, unknown> | null
  const baseUrl = (config?.base_url as string) ?? ''
  if (!baseUrl) {
    return fail('Connector has no base_url in config')
  }

  // Fetch source block for template variable interpolation
  const { data: sourceBlock } = await supabase
    .from('blocks')
    .select('id, name, type, metadata')
    .eq('id', meta.source_block_id)
    .single()

  const blockVars: Record<string, unknown> = sourceBlock
    ? { id: sourceBlock.id, name: sourceBlock.name, type: sourceBlock.type, ...(sourceBlock.metadata as Record<string, unknown> ?? {}) }
    : { id: meta.source_block_id }

  const contextVars: Record<string, unknown> = {
    template_id: meta.template_id,
    source_block_id: meta.source_block_id,
    applies_to_type: meta.applies_to_type,
  }

  const variables = { block: blockVars, context: contextVars }

  // Interpolate path and body
  const fullUrl = `${baseUrl.replace(/\/+$/, '')}/${step.path.replace(/^\/+/, '')}`
  const interpolatedUrl = interpolateTemplate(fullUrl, variables)
  const body = step.body_template ? interpolateTemplate(step.body_template, variables) : undefined

  // Build headers — resolve auth from credentials_ref if available
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'OpsOS-Workflow/1.0',
  }
  if (connector.credentials_ref) {
    const envVal = process.env[connector.credentials_ref]
    if (envVal) {
      headers['Authorization'] = `Bearer ${envVal}`
    }
  }

  // Execute with timeout and retry
  const timeoutMs = Math.min(step.timeout_ms ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS)
  const maxRetries = step.max_retries ?? DEFAULT_MAX_RETRIES
  let lastError: string | undefined
  let responseStatus: number | undefined
  let responseBody: string | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      const fetchOpts: RequestInit = {
        method: step.method,
        headers,
        signal: controller.signal,
      }
      if (body && step.method !== 'GET') {
        fetchOpts.body = body
      }

      const resp = await fetch(interpolatedUrl, fetchOpts)
      clearTimeout(timer)

      responseStatus = resp.status
      responseBody = await resp.text().catch(() => '')

      if (resp.ok) {
        logger.info('step-engine', 'step.call_api_success', {
          step_name: step.name,
          connector_id: step.connector_id,
          status: resp.status,
          attempt,
        })
        return {
          step_name: step.name,
          step_type: step.type,
          status: 'completed',
          output: {
            status: resp.status,
            url: interpolatedUrl,
            attempt,
          },
          executed_at: now,
        }
      }

      lastError = `HTTP ${resp.status}`
      logger.warn('step-engine', 'step.call_api_http_error', {
        step_name: step.name,
        status: resp.status,
        attempt,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown fetch error'
      lastError = msg.includes('abort') ? `Timeout after ${timeoutMs}ms` : msg
      logger.warn('step-engine', 'step.call_api_fetch_error', {
        step_name: step.name,
        error: lastError,
        attempt,
      })
    }
  }

  return {
    step_name: step.name,
    step_type: step.type,
    status: 'failed',
    error: lastError ?? 'Unknown error',
    output: { status: responseStatus, attempts: maxRetries + 1 },
    executed_at: now,
  }
}
