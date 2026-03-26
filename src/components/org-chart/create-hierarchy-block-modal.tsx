'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type HierarchyType = 'division' | 'department' | 'team'

interface CreateHierarchyBlockModalProps {
  type: HierarchyType
  parentId: string
  onClose: () => void
  onCreated: () => void
}

const TYPE_CONFIG: Record<HierarchyType, { label: string; parentLabel: string }> = {
  division: { label: 'Division', parentLabel: 'Organisation' },
  department: { label: 'Department', parentLabel: 'Division' },
  team: { label: 'Team', parentLabel: 'Department' },
}

const PARENT_FIELD: Record<HierarchyType, string> = {
  division: 'parent_org',
  department: 'parent_division',
  team: 'parent_department',
}

/**
 * CreateHierarchyBlockModal — simplified block creation for hierarchy types.
 * Pre-selects the block type and pre-fills the parent relation field.
 */
export function CreateHierarchyBlockModal({
  type,
  parentId,
  onClose,
  onCreated,
}: CreateHierarchyBlockModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = TYPE_CONFIG[type]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name: name.trim(),
          metadata: {
            [PARENT_FIELD[type]]: parentId,
            ...(description.trim() ? { description: description.trim() } : {}),
          },
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? `Failed to create ${config.label.toLowerCase()}`)
      }

      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create {config.label}</DialogTitle>
          <DialogDescription>
            Add a new {config.label.toLowerCase()} to this {config.parentLabel.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="hierarchy-name" className="text-sm font-medium text-foreground">
              Name
            </label>
            <input
              id="hierarchy-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={`e.g. ${type === 'division' ? 'Wealth Management' : type === 'department' ? 'Private Banking' : 'HNW Origination'}`}
              autoFocus
              required
            />
          </div>

          <div>
            <label htmlFor="hierarchy-description" className="text-sm font-medium text-foreground">
              Description <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              id="hierarchy-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[60px]"
              placeholder={`Purpose and scope of this ${config.label.toLowerCase()}`}
              rows={2}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? 'Creating...' : `Create ${config.label}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
