'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface DeleteBlockTypeProps {
  blockTypeId: string
  blockTypeName: string
  isSystem: boolean
}

export function DeleteBlockType({ blockTypeId, blockTypeName, isSystem }: DeleteBlockTypeProps) {
  const router = useRouter()
  const [blockCount, setBlockCount] = useState<number | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function checkUsage() {
      try {
        const res = await fetch(`/api/blocks?type=${blockTypeName}&limit=0&count=true`)
        if (res.ok) {
          const json = await res.json()
          setBlockCount(json.count ?? json.data?.length ?? 0)
        }
      } catch {
        // Non-blocking
      }
    }
    if (!isSystem) checkUsage()
  }, [blockTypeName, isSystem])

  if (isSystem) {
    return (
      <div className="mt-8 pt-6 border-t border-border">
        <h3 className="text-[13px] font-semibold text-foreground mb-1">Delete Block Type</h3>
        <p className="text-[12px] text-muted-foreground">
          System block types cannot be deleted.
        </p>
      </div>
    )
  }

  async function handleDelete() {
    setIsDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/block-types/${blockTypeId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        setError(json.error?.message || 'Failed to delete block type.')
        return
      }
      router.push('/settings/block-types')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h3 className="text-[13px] font-semibold text-destructive mb-1">Danger Zone</h3>
      <p className="text-[12px] text-muted-foreground mb-3">
        Deleting a block type is permanent. All field definitions will be removed.
        {blockCount !== null && blockCount > 0 && (
          <span className="block mt-1 text-destructive font-medium">
            {blockCount} existing block{blockCount !== 1 ? 's' : ''} of this type exist. Delete them first.
          </span>
        )}
      </p>

      {error && (
        <div className="text-[13px] text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2 mb-3" role="alert">
          {error}
        </div>
      )}

      {!isConfirming ? (
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          disabled={blockCount !== null && blockCount > 0}
          className="inline-flex items-center gap-2 rounded-md border border-destructive/30 px-4 py-1.5 text-[13px] font-medium text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Delete Block Type
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-1.5 text-[13px] font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isDeleting ? 'Deleting…' : 'Confirm Delete'}
          </button>
          <button
            type="button"
            onClick={() => setIsConfirming(false)}
            className="px-4 py-1.5 rounded-md border border-border text-[13px] font-medium text-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
