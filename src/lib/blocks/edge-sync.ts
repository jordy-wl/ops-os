import { createServerClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

interface RelationFieldConfig {
  fieldName: string
  edgeType: string
  isMulti: boolean
}

/**
 * Extracts relation fields that have x-relation-edge-type configured from a field schema.
 */
function getRelationFieldsWithEdgeSync(
  fieldSchema: Record<string, unknown>
): RelationFieldConfig[] {
  const properties = (fieldSchema.properties ?? {}) as Record<
    string,
    Record<string, unknown>
  >
  const result: RelationFieldConfig[] = []

  for (const [fieldName, prop] of Object.entries(properties)) {
    const fieldType = prop['x-field-type'] as string | undefined
    const edgeType = prop['x-relation-edge-type'] as string | undefined

    if (!edgeType) continue
    if (fieldType !== 'relation' && fieldType !== 'multi-relation') continue

    result.push({
      fieldName,
      edgeType,
      isMulti: fieldType === 'multi-relation',
    })
  }

  return result
}

/**
 * Normalises a relation field value to a Set of UUID strings.
 * - `relation` fields store a single UUID string
 * - `multi-relation` fields store an array of UUID strings
 */
function toIdSet(value: unknown, isMulti: boolean): Set<string> {
  if (!value) return new Set()
  if (isMulti) {
    if (!Array.isArray(value)) return new Set()
    return new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0))
  }
  if (typeof value === 'string' && value.length > 0) return new Set([value])
  return new Set()
}

/**
 * Syncs block_edges for all relation/multi-relation fields that have x-relation-edge-type set.
 * Called after a successful block metadata PATCH.
 *
 * Algorithm:
 * 1. Fetch the block's field_schema from block_type_definitions
 * 2. Find all properties with x-field-type: relation|multi-relation AND x-relation-edge-type set
 * 3. For each such field, compare old metadata[field] vs new metadata[field]
 * 4. Determine which target IDs were added and which were removed
 * 5. For added IDs: upsert into block_edges with source_field
 * 6. For removed IDs: delete from block_edges where source_field matches
 */
export async function syncRelationEdges(
  supabase: ReturnType<typeof createServerClient>,
  orgId: string,
  blockId: string,
  blockType: string,
  oldMetadata: Record<string, unknown>,
  newMetadata: Record<string, unknown>
): Promise<void> {
  // Fetch the field schema for this block type
  const { data: typeDef, error: fetchError } = await supabase
    .from('block_type_definitions')
    .select('field_schema')
    .eq('org_id', orgId)
    .eq('type_name', blockType)
    .single()

  if (fetchError || !typeDef?.field_schema) {
    logger.warn('edge-sync', 'schema.fetch_failed', {
      block_type: blockType,
      error_code: fetchError?.code,
    })
    return
  }

  const fieldSchema = typeDef.field_schema as Record<string, unknown>
  const relationFields = getRelationFieldsWithEdgeSync(fieldSchema)

  if (relationFields.length === 0) return

  const ops: PromiseLike<void>[] = []

  for (const { fieldName, edgeType, isMulti } of relationFields) {
    const oldIds = toIdSet(oldMetadata[fieldName], isMulti)
    const newIds = toIdSet(newMetadata[fieldName], isMulti)

    const toAdd = [...newIds].filter((id) => !oldIds.has(id))
    const toRemove = [...oldIds].filter((id) => !newIds.has(id))

    // Upsert new edges
    if (toAdd.length > 0) {
      const rows = toAdd.map((targetId) => ({
        org_id: orgId,
        from_block_id: blockId,
        to_block_id: targetId,
        edge_type: edgeType,
        source_field: fieldName,
      }))

      ops.push(
        (async () => {
          const { error } = await supabase
            .from('block_edges')
            .upsert(rows, {
              onConflict: 'org_id,from_block_id,to_block_id,edge_type',
              ignoreDuplicates: false,
            })
          if (error) {
            logger.warn('edge-sync', 'upsert.failed', {
              block_id: blockId,
              field: fieldName,
              edge_type: edgeType,
              error_code: error.code,
            })
          }
        })()
      )
    }

    // Remove old edges (only field-driven ones via source_field filter)
    if (toRemove.length > 0) {
      ops.push(
        (async () => {
          const { error } = await supabase
            .from('block_edges')
            .delete()
            .eq('org_id', orgId)
            .eq('from_block_id', blockId)
            .eq('source_field', fieldName)
            .in('to_block_id', toRemove)
          if (error) {
            logger.warn('edge-sync', 'delete.failed', {
              block_id: blockId,
              field: fieldName,
              error_code: error.code,
            })
          }
        })()
      )
    }
  }

  await Promise.all(ops)
}
