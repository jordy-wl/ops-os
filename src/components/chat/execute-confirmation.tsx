'use client'

import { Zap } from 'lucide-react'

interface ExecuteConfirmationProps {
  onConfirm: () => void
  onCancel: () => void
}

/**
 * ExecuteConfirmation — shown when user sends a message in Execute mode.
 * Execute mode can trigger real actions (create blocks, update data, trigger workflows).
 */
export function ExecuteConfirmation({ onConfirm, onCancel }: ExecuteConfirmationProps) {
  return (
    <div className="mx-3 mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-start gap-2">
        <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-medium text-amber-900">Execute mode active</p>
          <p className="text-xs text-amber-700 mt-0.5">
            This message may trigger actions like creating blocks, updating data, or starting workflows.
          </p>
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
            >
              Send &amp; execute
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
