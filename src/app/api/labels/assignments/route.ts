import { z } from 'zod'
import { withAuth } from '@/lib/auth/withAuth'
import { requirePermission } from '@/lib/rbac/middleware'
import { ok, apiError, validationError } from '@/lib/api/responses'
import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import type { Permission } from '@/lib/rbac/types'

const CreateAssignmentSchema = z.object({
  label_value_id: z.string().uuid(),
  entity_type: z.string().min(1).default('block'),
  entity_id: z.string().uuid(),
})

/**
 * GET /api/labels/assignments — query label assignments
 *
 * Query modes (always filtered by org_id):
 *   ?entity_type=block&entity_id=<uuid>  — list all labels for a specific entity
 *   ?label_value_id=<uuid>               — list all entities with a specific label
 *
 * Returns enriched data with joined label_values and label_categories.
 */
export const GET = withAuth(
  requirePermission(['manage_settings' as Permission], async (req, ctx) => {
    const url = new URL(req.url)
    const entityType = url.searchParams.get('entity_type')
    const entityId = url.searchParams.get('entity_id')
    const labelValueId = url.searchParams.get('label_value_id')

    const supabase = createServerClient()

    // Mode 1: labels for a specific entity
    if (entityType && entityId) {
      const { data: assignments, error } = await supabase
        .from('label_assignments')
        .select('*, label_values(*, label_categories(*))')
        .eq('org_id', ctx.orgId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)

      if (error) {
        logger.error('labels', 'label_assignment.list_by_entity_failed', {
          org_id: ctx.orgId,
          entity_type: entityType,
          entity_id: entityId,
          error_code: error.code,
        })
        return apiError('Failed to list label assignments', 'labels/assignments-list-failed', 500)
      }

      return ok(assignments ?? [])
    }

    // Mode 2: entities with a specific label
    if (labelValueId) {
      const { data: assignments, error } = await supabase
        .from('label_assignments')
        .select('*, label_values(*, label_categories(*))')
        .eq('org_id', ctx.orgId)
        .eq('label_value_id', labelValueId)

      if (error) {
        logger.error('labels', 'label_assignment.list_by_value_failed', {
          org_id: ctx.orgId,
          label_value_id: labelValueId,
          error_code: error.code,
        })
        return apiError('Failed to list label assignments', 'labels/assignments-list-failed', 500)
      }

      return ok(assignments ?? [])
    }

    return apiError(
      'Missing query parameters: provide entity_type+entity_id or label_value_id',
      'validation/missing-params',
      400
    )
  })
)

/**
 * POST /api/labels/assignments — assign a label value to an entity
 * Upserts to handle duplicate assignments gracefully.
 */
export const POST = withAuth(
  requirePermission(['manage_settings' as Permission], async (req, ctx) => {
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Invalid JSON body', 'validation/invalid-json', 400)

    const parsed = CreateAssignmentSchema.safeParse(body)
    if (!parsed.success) return validationError(parsed.error.issues)

    const { label_value_id, entity_type, entity_id } = parsed.data

    const supabase = createServerClient()

    // Verify the label value exists and belongs to this org
    const { data: labelValue, error: valueError } = await supabase
      .from('label_values')
      .select('id, category_id')
      .eq('id', label_value_id)
      .eq('org_id', ctx.orgId)
      .single()

    if (valueError || !labelValue) {
      return apiError('Label value not found', 'labels/value-not-found', 404)
    }

    // Upsert: insert, on conflict do nothing (return existing)
    const { data: assignment, error } = await supabase
      .from('label_assignments')
      .upsert(
        {
          org_id: ctx.orgId,
          label_value_id,
          entity_type,
          entity_id,
        },
        { onConflict: 'label_value_id,entity_type,entity_id' }
      )
      .select('*, label_values(*, label_categories(*))')
      .single()

    if (error) {
      logger.error('labels', 'label_assignment.create_failed', {
        org_id: ctx.orgId,
        label_value_id,
        entity_type,
        entity_id,
        error_code: error.code,
      })
      return apiError('Failed to create label assignment', 'labels/assignment-create-failed', 500)
    }

    logger.info('labels', 'label_assignment.created', {
      org_id: ctx.orgId,
      assignment_id: assignment.id,
      label_value_id,
      entity_type,
      entity_id,
    })

    return ok(assignment, 201)
  })
)

/**
 * DELETE /api/labels/assignments?id=<uuid> — remove a label assignment
 */
export const DELETE = withAuth(
  requirePermission(['manage_settings' as Permission], async (req, ctx) => {
    const url = new URL(req.url)
    const assignmentId = url.searchParams.get('id')

    if (!assignmentId) {
      return apiError('Missing required query parameter: id', 'validation/missing-param', 400)
    }

    const supabase = createServerClient()

    // Verify assignment exists and belongs to this org
    const { data: existing, error: fetchError } = await supabase
      .from('label_assignments')
      .select('id, label_value_id, entity_type, entity_id')
      .eq('id', assignmentId)
      .eq('org_id', ctx.orgId)
      .single()

    if (fetchError || !existing) {
      return apiError('Label assignment not found', 'labels/assignment-not-found', 404)
    }

    const { error: deleteError } = await supabase
      .from('label_assignments')
      .delete()
      .eq('id', assignmentId)

    if (deleteError) {
      logger.error('labels', 'label_assignment.delete_failed', {
        org_id: ctx.orgId,
        assignment_id: assignmentId,
        error_code: deleteError.code,
      })
      return apiError('Failed to delete label assignment', 'labels/assignment-delete-failed', 500)
    }

    logger.info('labels', 'label_assignment.deleted', {
      org_id: ctx.orgId,
      assignment_id: assignmentId,
      label_value_id: existing.label_value_id,
      entity_type: existing.entity_type,
      entity_id: existing.entity_id,
    })

    return ok({ deleted: true })
  })
)
