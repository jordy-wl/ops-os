import { z } from 'zod'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { validatePortalToken } from '@/lib/portal'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

const RequestSchema = z.object({
  category: z.string().min(1, 'Category is required').max(100),
  subject: z.string().min(1, 'Subject is required').max(500),
  description: z.string().min(1, 'Description is required').max(5000),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
})

/**
 * POST /api/portal/[token]/requests -- submit a request through the portal.
 * Public (no Clerk auth). Token-validated via shared_links.
 *
 * Creates a form_submission row and logs a portal.request.submitted event.
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

  // Check that requests feature is enabled
  if (!portalConfig.requests_enabled) {
    return apiError('Requests are not enabled for this portal', 'portal/feature-disabled', 403)
  }

  // Parse and validate body
  const body = await req.json().catch(() => null)
  if (!body) {
    return apiError('Invalid JSON body', 'validation/invalid-json', 400)
  }

  const parsed = RequestSchema.safeParse(body)
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
