'use client'

import type { Block } from '@/lib/context-assembly'

interface BlockContextPickerProps {
  blocks: Block[]
  selectedId: string | null
  onChange: (blockId: string | null) => void
}

/**
 * BlockContextPicker — dropdown for selecting which block the chat question is about.
 * When a block is selected its name is shown in the chat header and its ID is sent
 * with every message as blockId for context assembly.
 *
 * @param blocks     - All blocks for the current org (pre-fetched by server component)
 * @param selectedId - Currently selected block ID, or null for org-level context
 * @param onChange   - Called when the selection changes
 */
export function BlockContextPicker({ blocks, selectedId, onChange }: BlockContextPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="block-context" className="text-xs font-medium text-gray-500 shrink-0">
        Context:
      </label>
      <select
        id="block-context"
        value={selectedId ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="h-8 rounded-md border border-gray-200 px-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 max-w-[200px] truncate"
        aria-label="Select block context for AI chat"
      >
        <option value="">Org-level (no block)</option>
        {blocks.map((block) => (
          <option key={block.id} value={block.id}>
            [{block.type}] {block.name}
          </option>
        ))}
      </select>
    </div>
  )
}
