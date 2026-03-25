import { z } from 'zod'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { validatePortalToken, type PortalConfig } from '@/lib/portal'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { spawnPortalWorkflow } from '@/lib/workflow/portal-trigger'

// ─── Schemas ────────────────────────────────────────────────────────────────

/** Legacy category-based request schema (backward compatible). */
const LegacyRequestSchema = z.object({
  category: z.string().min(1, 'Category is required').max(100),
  subject: z.string().min(1, 'Subject is required').max(500),
  description: z.string().min(1, 'Description is required').max(5000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
})

/** Workflow-based request schema (new path -- triggers a workflow instance). */
const WorkflowRequestSchema = z.object({
  workflow_template_id: z.string().uuid('workflow_template_id must be a valid UUID'),
  subject: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  responses: z.record(z.unknown()).optional(),
})

// ─── GET: list portal requests ──────────────────────────────────────────────

/**
 * GET /api/portal/[token]/requests -- list requests submitted through this portal.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Returns form_submissions where source = 'portal_request' for this client,
 * enriched with workflow instance status when a workflow was spawned.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const result = await validatePortalToken(token)
  if (!result.valid) {
    return apiError(result.reason, 'portal/invalid-token', 401)
  }

  const { portalConfig } = result

  if (!portalConfig.requests_enabled) {
    return apiError('Requests are not enabled for this portal', 'portal/feature-disabled', 403)
  }

  const supabase = createServerClient()

  // Query form_submissions for this client that came from portal requests
  const { data: submissions, error: queryError } = await supabase
    .from('form_submissions')
    .select('id, field_data, submitted_at, workflow_instance_id')
    .eq('block_id', portalConfig.client_block_id)
    .eq('org_id', portalConfig.org_id)
    .order('submitted_at', { ascending: false })
    .limit(50)

  if (queryError) {
    logger.error('portal', 'portal.requests.list_failed', {
      org_id: portalConfig.org_id,
      error_code: queryError.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to fetch requests', 'portal/requests-failed', 500)
  }

  // Filter to portal_request source only (in-app, since Supabase JSON filter can be unreliable)
  const portalSubmissions = (submissions ?? []).filter((s) => {
    const fieldData = s.field_data as Record<string, unknown> | null
    return fieldData?.source === 'portal_request'
  })

  // Batch-fetch workflow instance metadata for submissions that have one
  const instanceIds = portalSubmissions
    .map((s) => s.workflow_instance_id)
    .filter((id): id is string => id != null)

  const instanceMap = new Map<string, { status: string; current_step_index: number; total_steps: number }>()

  if (instanceIds.length > 0) {
    const { data: instances } = await supabase
      .from('blocks')
      .select('id, metadata')
      .in('id', instanceIds)
      .eq('type', 'workflow_instance')

    // Collect unique template IDs to batch-fetch step counts (avoid N+1)
    const templateIds = new Set<string>()
    for (const inst of instances ?? []) {
      const meta = (inst.metadata ?? {}) as Record<string, unknown>
      const tid = meta.template_id as string | undefined
      if (tid) templateIds.add(tid)
    }

    const templateStepCounts = new Map<string, number>()
    if (templateIds.size > 0) {
      const { data: templates } = await supabase
        .from('blocks')
        .select('id, metadata')
        .in('id', Array.from(templateIds))
        .eq('type', 'workflow_template')

      for (const tmpl of templates ?? []) {
        const tmplMeta = (tmpl.metadata ?? {}) as Record<string, unknown>
        const steps = tmplMeta.steps as unknown[] | undefined
        templateStepCounts.set(tmpl.id, Array.isArray(steps) ? steps.length : 0)
      }
    }

    for (const inst of instances ?? []) {
      const meta = (inst.metadata ?? {}) as Record<string, unknown>
      const templateId = meta.template_id as string | undefined

      instanceMap.set(inst.id, {
        status: (meta.status as string) ?? 'pending',
        current_step_index: (meta.current_step_index as number) ?? 0,
        total_steps: templateId ? (templateStepCounts.get(templateId) ?? 0) : 0,
      })
    }
  }

  // Map to response shape
  const requests = portalSubmissions.map((s) => {
    const fieldData = (s.field_data ?? {}) as Record<string, unknown>
    const instanceInfo = s.workflow_instance_id ? instanceMap.get(s.workflow_instance_id) : null

    return {
      id: s.id,
      request_type: (fieldData.workflow_template_id as string) ?? (fieldData.category as string) ?? 'general',
      subject: (fieldData.subject as string) ?? '',
      status: instanceInfo?.status ?? 'submitted',
      current_step: instanceInfo?.current_step_index ?? null,
      total_steps: instanceInfo?.total_steps ?? null,
      submitted_at: s.submitted_at,
    }
  })

  logger.info('portal', 'portal.requests.listed', {
    org_id: portalConfig.org_id,
    token_prefix: token.slice(0, 8) + '...',
    count: requests.length,
  })

  return ok(requests)
}

// ─── POST: submit a portal request ──────────────────────────────────────────

/**
 * POST /api/portal/[token]/requests -- submit a request through the portal.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Two paths:
 * 1. Workflow-based: body has `workflow_template_id` -- validates against
 *    portal's request_type_config, creates form_submission, spawns workflow instance.
 * 2. Legacy: body has `category` -- creates form_submission only (no workflow).
 *
 * Both paths log a portal.request.submitted event.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const result = await validatePortalToken(token)
  if (!result.valid) {
    return apiError(result.reason, 'portal/invalid-token', 401)
  }

  const { portalConfig } = result

  if (!portalConfig.requests_enabled) {
    return apiError('Requests are not enabled for this portal', 'portal/feature-disabled', 403)
  }

  const body = await req.json().catch(() => null)
  if (!body) {
    return apiError('Invalid JSON body', 'validation/invalid-json', 400)
  }

  // Route to workflow path or legacy path based on body shape
  if (body.workflow_template_id) {
    return handleWorkflowRequest(body, portalConfig, token)
  }

  return handleLegacyRequest(body, portalConfig, token)
}

// ─── Workflow-based request handler ─────────────────────────────────────────

async function handleWorkflowRequest(
  body: unknown,
  portalConfig: PortalConfig,
  token: string
) {
  const parsed = WorkflowRequestSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { workflow_template_id, subject, description, responses } = parsed.data

  // Validate that this workflow_template_id is in the portal's request_type_config
  const configEntries = portalConfig.request_type_config ?? []
  const matchingEntry = configEntries.find((e) => e.workflow_template_id === workflow_template_id)

  if (!matchingEntry) {
    return apiError(
      'This request type is not available for this portal',
      'portal/invalid-request-type',
      400
    )
  }

  // Build field_data for the form_submission
  // If the request type has a form_template_id, expect responses; otherwise expect subject/description
  const fieldData: Record<string, unknown> = {
    source: 'portal_request',
    workflow_template_id,
  }

  if (matchingEntry.form_template_id && responses) {
    fieldData.form_template_id = matchingEntry.form_template_id
    fieldData.responses = responses
    // Copy subject from responses if present, or generate one from the display name
    fieldData.subject = (responses.subject as string) ?? matchingEntry.display_name ?? 'Portal Request'
  } else {
    if (!subject) {
      return apiError('Subject is required for this request type', 'validation/missing-subject', 400)
    }
    fieldData.subject = subject
    fieldData.description = description ?? ''
  }

  const supabase = createServerClient()

  // Create form_submission
  const { data: submission, error: submitError } = await supabase
    .from('form_submissions')
    .insert({
      org_id: portalConfig.org_id,
      shared_link_id: portalConfig.shared_link_id,
      block_id: portalConfig.client_block_id,
      form_template_id: matchingEntry.form_template_id ?? null,
      field_data: fieldData,
      respondent_name: null,
      respondent_email: null,
    })
    .select('id, submitted_at')
    .single()

  if (submitError || !submission) {
    logger.error('portal', 'portal.request.submit_failed', {
      org_id: portalConfig.org_id,
      error_code: submitError?.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to submit request', 'portal/request-failed', 500)
  }

  // Spawn the workflow instance
  const spawnResult = await spawnPortalWorkflow(
    portalConfig.org_id,
    workflow_template_id,
    portalConfig.client_block_id,
    submission.id,
    fieldData
  )

  let workflowInstanceId: string | null = null

  if ('instanceId' in spawnResult) {
    workflowInstanceId = spawnResult.instanceId

    // Update the form_submission with the workflow_instance_id
    await supabase
      .from('form_submissions')
      .update({ workflow_instance_id: workflowInstanceId })
      .eq('id', submission.id)
  } else {
    // Workflow spawn failed -- log but do not fail the request
    // The form_submission is still valid; the workflow can be retried
    logger.warn('portal', 'portal.request.workflow_spawn_failed', {
      org_id: portalConfig.org_id,
      submission_id: submission.id,
      error: spawnResult.error,
      token_prefix: token.slice(0, 8) + '...',
    })
  }

  // Log audit event
  await supabase.from('events').insert({
    org_id: portalConfig.org_id,
    block_id: portalConfig.client_block_id,
    type: 'portal.request.submitted',
    actor_id: 'portal',
    actor_type: 'system',
    payload: {
      submission_id: submission.id,
      portal_config_id: portalConfig.id,
      workflow_template_id,
      workflow_instance_id: workflowInstanceId,
      subject: fieldData.subject,
    },
  })

  logger.info('portal', 'portal.request.submitted', {
    org_id: portalConfig.org_id,
    portal_config_id: portalConfig.id,
    submission_id: submission.id,
    workflow_instance_id: workflowInstanceId,
    token_prefix: token.slice(0, 8) + '...',
  })

  return ok(
    {
      id: submission.id,
      submitted_at: submission.submitted_at,
      workflow_instance_id: workflowInstanceId,
    },
    201
  )
}

// ─── Legacy category-based request handler ──────────────────────────────────

async function handleLegacyRequest(
  body: unknown,
  portalConfig: PortalConfig,
  token: string
) {
  const parsed = LegacyRequestSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { category, subject, description, priority } = parsed.data
  const supabase = createServerClient()

  // Create form_submission row as the request record
  const { data: submission, error: submitError } = await supabase
    .from('form_submissions')
    .insert({
      org_id: portalConfig.org_id,
      shared_link_id: portalConfig.shared_link_id,
      block_id: portalConfig.client_block_id,
      field_data: { category, subject, description, priority, source: 'portal_request' },
      respondent_name: null,
      respondent_email: null,
    })
    .select('id, submitted_at')
    .single()

  if (submitError || !submission) {
    logger.error('portal', 'portal.request.submit_failed', {
      org_id: portalConfig.org_id,
      error_code: submitError?.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to submit request', 'portal/request-failed', 500)
  }

  // Log audit event
  await supabase.from('events').insert({
    org_id: portalConfig.org_id,
    block_id: portalConfig.client_block_id,
    type: 'portal.request.submitted',
    actor_id: 'portal',
    actor_type: 'system',
    payload: {
      submission_id: submission.id,
      portal_config_id: portalConfig.id,
      category,
      subject,
      priority,
    },
  })

  logger.info('portal', 'portal.request.submitted', {
    org_id: portalConfig.org_id,
    portal_config_id: portalConfig.id,
    submission_id: submission.id,
    token_prefix: token.slice(0, 8) + '...',
  })

  return ok({ id: submission.id, submitted_at: submission.submitted_at }, 201)
}

