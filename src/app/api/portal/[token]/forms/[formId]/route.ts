import { z } from 'zod'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { validatePortalToken } from '@/lib/portal'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const SubmissionSchema = z.object({
  responses: z.record(z.unknown()),
  contact_name: z.string().max(200).optional(),
  contact_email: z.string().email().max(200).optional(),
})

/**
 * GET /api/portal/[token]/forms/[formId] -- load a form template with full question schema.
 * Public (no Clerk auth). Token-validated via shared_links.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; formId: string }> }
) {
  const { token, formId } = await params

  const result = await validatePortalToken(token)
  if (!result.valid) {
    return apiError(result.reason, 'portal/invalid-token', 401)
  }

  const { portalConfig } = result

  // Check that forms feature is enabled
  if (!portalConfig.forms_enabled) {
    return apiError('Forms are not enabled for this portal', 'portal/feature-disabled', 403)
  }

  const supabase = createServerClient()

  // Load the form_template block -- must belong to the same org
  const { data: form, error: formError } = await supabase
    .from('blocks')
    .select('id, name, type, metadata')
    .eq('id', formId)
    .eq('org_id', portalConfig.org_id)
    .eq('type', 'form_template')
    .single()

  if (formError || !form) {
    return apiError('Form not found', 'portal/form-not-found', 404)
  }

  // Verify this form is connected to the client block
  const { data: edgeCheck } = await supabase
    .from('block_edges')
    .select('id')
    .eq('org_id', portalConfig.org_id)
    .or(
      `and(from_block_id.eq.${portalConfig.client_block_id},to_block_id.eq.${formId}),and(from_block_id.eq.${formId},to_block_id.eq.${portalConfig.client_block_id})`
    )
    .limit(1)

  if (!edgeCheck || edgeCheck.length === 0) {
    return apiError('Form not found', 'portal/form-not-found', 404)
  }

  const meta = (form.metadata ?? {}) as Record<string, unknown>

  logger.info('portal', 'portal.form.fetched', {
    org_id: portalConfig.org_id,
    form_id: formId,
    token_prefix: token.slice(0, 8) + '...',
  })

  return ok({
    id: form.id,
    name: form.name,
    title: (meta.title as string) ?? form.name,
    description: (meta.description as string) ?? null,
    category: (meta.category as string) ?? null,
    questions: meta.questions ?? [],
  })
}

/**
 * POST /api/portal/[token]/forms/[formId] -- submit a form response.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Creates a form_submission row with form_template_id and logs a portal.form.submitted event.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string; formId: string }> }
) {
  const { token, formId } = await params

  const result = await validatePortalToken(token)
  if (!result.valid) {
    return apiError(result.reason, 'portal/invalid-token', 401)
  }

  const { portalConfig } = result

  // Check that forms feature is enabled
  if (!portalConfig.forms_enabled) {
    return apiError('Forms are not enabled for this portal', 'portal/feature-disabled', 403)
  }

  // Parse and validate body
  const body = await req.json().catch(() => null)
  if (!body) {
    return apiError('Invalid JSON body', 'validation/invalid-json', 400)
  }

  const parsed = SubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.issues)
  }

  const { responses, contact_name, contact_email } = parsed.data
  const supabase = createServerClient()

  // Verify the form_template block exists, belongs to the org, and is a form_template
  const { data: form, error: formError } = await supabase
    .from('blocks')
    .select('id, name, type')
    .eq('id', formId)
    .eq('org_id', portalConfig.org_id)
    .eq('type', 'form_template')
    .single()

  if (formError || !form) {
    return apiError('Form not found', 'portal/form-not-found', 404)
  }

  // Verify this form is connected to the client block
  const { data: edgeCheck } = await supabase
    .from('block_edges')
    .select('id')
    .eq('org_id', portalConfig.org_id)
    .or(
      `and(from_block_id.eq.${portalConfig.client_block_id},to_block_id.eq.${formId}),and(from_block_id.eq.${formId},to_block_id.eq.${portalConfig.client_block_id})`
    )
    .limit(1)

  if (!edgeCheck || edgeCheck.length === 0) {
    return apiError('Form not found', 'portal/form-not-found', 404)
  }

  // Create form_submission
  const { data: submission, error: submitError } = await supabase
    .from('form_submissions')
    .insert({
      org_id: portalConfig.org_id,
      shared_link_id: portalConfig.shared_link_id,
      block_id: portalConfig.client_block_id,
      form_template_id: formId,
      field_data: responses,
      respondent_name: contact_name ?? null,
      respondent_email: contact_email ?? null,
    })
    .select('id, submitted_at')
    .single()

  if (submitError || !submission) {
    logger.error('portal', 'portal.form.submit_failed', {
      org_id: portalConfig.org_id,
      form_id: formId,
      error_code: submitError?.code,
      token_prefix: token.slice(0, 8) + '...',
    })
    return apiError('Failed to submit form', 'portal/form-submit-failed', 500)
  }

  // Log audit event
  await supabase.from('events').insert({
    org_id: portalConfig.org_id,
    block_id: portalConfig.client_block_id,
    type: 'portal.form.submitted',
    actor_id: 'portal',
    actor_type: 'system',
    payload: {
      submission_id: submission.id,
      portal_config_id: portalConfig.id,
      form_template_id: formId,
      form_name: form.name,
      response_count: Object.keys(responses).length,
    },
  })

  logger.info('portal', 'portal.form.submitted', {
    org_id: portalConfig.org_id,
    portal_config_id: portalConfig.id,
    form_id: formId,
    submission_id: submission.id,
    token_prefix: token.slice(0, 8) + '...',
  })

  return ok({ id: submission.id, submitted_at: submission.submitted_at }, 201)
}
