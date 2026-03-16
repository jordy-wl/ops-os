'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { InlineFieldManager } from '@/components/blocks/inline-field-manager'
import type { FieldGroup } from '@/lib/block-types/field-types'

interface InlineFieldManagerWrapperProps {
  blockTypeId: string
  blockTypeName: string
  blockTypeSlug: string
  fieldSchema: Record<string, unknown>
}

/**
 * Client wrapper for InlineFieldManager — bridges server component data
 * to the client component. Provides onSchemaUpdate via router.refresh().
 */
export function InlineFieldManagerWrapper({
  blockTypeId,
  blockTypeName,
  blockTypeSlug,
  fieldSchema,
}: InlineFieldManagerWrapperProps) {
  const router = useRouter()

  const handleSchemaUpdate = useCallback(() => {
    router.refresh()
  }, [router])

  // Normalise field_schema into the shape InlineFieldManager expects
  const schema = {
    type: (fieldSchema.type as string) ?? 'object',
    properties: (fieldSchema.properties as Record<string, Record<string, unknown>>) ?? {},
    required: fieldSchema.required as string[] | undefined,
    'x-field-groups': fieldSchema['x-field-groups'] as FieldGroup[] | undefined,
  }

  return (
    <InlineFieldManager
      blockTypeId={blockTypeId}
      blockTypeName={blockTypeName}
      blockTypeSlug={blockTypeSlug}
      schema={schema}
      onSchemaUpdate={handleSchemaUpdate}
    />
  )
}
