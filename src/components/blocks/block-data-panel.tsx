import type { Block } from '@/lib/context-assembly'

interface BlockDataPanelProps {
  block: Block
}

// Fields shown separately in BlockHeader — omit from the data table
const EXCLUDED_FIELDS = new Set(['jurisdiction'])

/**
 * BlockDataPanel — renders the block metadata as a structured key-value table.
 * Excludes fields already displayed in the BlockHeader (e.g. jurisdiction).
 *
 * @param block - The block whose metadata should be displayed
 */
export function BlockDataPanel({ block }: BlockDataPanelProps) {
  const entries = Object.entries(block.metadata).filter(
    ([key]) => !EXCLUDED_FIELDS.has(key)
  )

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
