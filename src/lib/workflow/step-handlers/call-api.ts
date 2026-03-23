import { logger } from '@/lib/logger'
import { interpolateTemplate, buildStepVariables } from '../step-engine'
import type { StepResult } from '../step-engine'
import type { StepHandler } from './types'

const DEFAULT_TIMEOUT_MS = 5000
const MAX_TIMEOUT_MS = 30000
const DEFAULT_MAX_RETRIES = 1

const handler: StepHandler = async (step, meta, orgId, supabase) => {
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

  const stepVars = buildStepVariables(meta.step_results)
  const variables = { block: blockVars, context: contextVars, steps: stepVars }

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
      await resp.text().catch(() => '')

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
          output: { status: resp.status, url: interpolatedUrl, attempt },
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

export default handler
