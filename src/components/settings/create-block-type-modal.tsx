'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'

const ICON_OPTIONS = [
  'building', 'handshake', 'folder', 'user', 'file-text', 'git-branch',
  'play', 'check-square', 'palette', 'box', 'lightbulb', 'target',
  'grid-2x2', 'shield', 'wrench', 'package', 'star', 'zap', 'flag', 'bookmark',
] as const

const COLOR_OPTIONS = [
  { name: 'blue', class: 'bg-blue-500' },
  { name: 'green', class: 'bg-green-500' },
  { name: 'purple', class: 'bg-purple-500' },
  { name: 'amber', class: 'bg-amber-500' },
  { name: 'indigo', class: 'bg-indigo-500' },
  { name: 'cyan', class: 'bg-cyan-500' },
  { name: 'orange', class: 'bg-orange-500' },
  { name: 'rose', class: 'bg-rose-500' },
  { name: 'emerald', class: 'bg-emerald-500' },
  { name: 'gray', class: 'bg-gray-500' },
] as const

export function CreateBlockTypeButton() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Create Block Type
      </button>
      {isOpen && <CreateBlockTypeModal onClose={() => setIsOpen(false)} />}
    </>
  )
}

function CreateBlockTypeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [typeName, setTypeName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [icon, setIcon] = useState<string>('box')
  const [color, setColor] = useState<string>('blue')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const typeNameValid = /^[a-z][a-z0-9_]*$/.test(typeName)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!typeName || !displayName) {
      setError('Type name and display name are required.')
      return
    }

    if (!typeNameValid) {
      setError('Type name must be lowercase letters, numbers, and underscores. Must start with a letter.')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/block-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type_name: typeName,
          display_name: displayName,
          icon,
          color,
          description: '',
          field_schema: { type: 'object', properties: {} },
        }),
      })

      if (!res.ok) {
        const json = await res.json()
        setError(json.error?.message || 'Failed to create block type.')
        return
      }

      const json = await res.json()
      onClose()
      router.push(`/settings/block-types/${json.data.id}`)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-lg bg-background border border-border shadow-lg p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-type-title"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 id="create-type-title" className="text-[15px] font-semibold text-foreground mb-4">
          Create Block Type
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="type-name" className="block text-[13px] font-medium text-foreground mb-1">
              Type Name
            </label>
            <input
              id="type-name"
              type="text"
              value={typeName}
              onChange={(e) => setTypeName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="e.g. custom_entity"
              className="h-8 w-full rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="text-[11px] text-muted-foreground mt-0.5">Lowercase letters, numbers, underscores only.</p>
          </div>

          <div>
            <label htmlFor="display-name" className="block text-[13px] font-medium text-foreground mb-1">
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Custom Entity"
              className="h-8 w-full rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">Icon</label>
            <div className="flex flex-wrap gap-1.5">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIcon(ic)}
                  className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                    icon === ic
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColor(c.name)}
                  className={`h-6 w-6 rounded-full ${c.class} transition-all ${
                    color === c.name ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''
                  }`}
                  aria-label={c.name}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {error && (
            <div className="text-[13px] text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2" role="alert">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-md border border-border text-[13px] font-medium text-foreground hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !typeName || !displayName}
              className="px-4 py-1.5 rounded-md bg-primary text-[13px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
