import type { Block } from '@/lib/context-assembly'
import { DynamicFieldRenderer } from '@/components/blocks/dynamic-field-renderer'

interface BlockDataPanelProps {
  block: Block
  /** Optional field_schema from block_type_definitions — enables structured display */
  fieldSchema?: {
    type?: string
    properties?: Record<string, unknown>
    required?: string[]
  }
}

// Fields shown separately in BlockHeader — omit from the data table
const EXCLUDED_FIELDS = new Set(['jurisdiction'])

/**
 * BlockDataPanel — renders the block metadata as a structured key-value table.
 * When a fieldSchema is provided, uses DynamicFieldRenderer for typed display.
 * Falls back to raw key-value rendering when no schema is available.
 */
export function BlockDataPanel({ block, fieldSchema }: BlockDataPanelProps) {
  const entries = Object.entries(block.metadata).filter(
    ([key]) => !EXCLUDED_FIELDS.has(key)
  )

  // Use DynamicFieldRenderer in readOnly mode when schema is available
  if (fieldSchema && fieldSchema.properties && Object.keys(fieldSchema.properties).length > 0) {
    return (
      <section aria-label="Block data">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Block Data</h2>
        <DynamicFieldRenderer
          fieldSchema={fieldSchema as Parameters<typeof DynamicFieldRenderer>[0]['fieldSchema']}
          values={block.metadata}
          readOnly
        />
      </section>
    )
  }

  // Fallback: raw key-value display
  return (
    <section aria-label="Block data">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Block Data</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No additional data recorded.</p>
      ) : (
        <dl className="divide-y divide-gray-100 rounded-lg border text-sm">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-4 px-4 py-2.5">
              <dt className="w-36 shrink-0 font-medium text-gray-600 capitalize">
                {key.replace(/_/g, ' ')}
              </dt>
              <dd className="flex-1 text-gray-900 break-words">
                {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
