'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { type Permission } from '@/lib/rbac/types'
import { PermissionMatrix } from './permission-matrix'

export function RoleForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<Set<Permission>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (permissions.size === 0) {
      setError('At least one permission is required')
      return
    }
    setSubmitting(true)

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          display_name: displayName,
          description,
          permissions: [...permissions],
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error?.message ?? 'Something went wrong')
        return
      }

      router.push('/settings/roles')
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {error && (
        <div className="rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-[13px] text-destructive" role="alert">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="display_name" className="block text-sm font-medium text-foreground mb-1">
          Role Name <span className="text-destructive">*</span>
        </label>
        <input
          id="display_name"
          type="text"
          required
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value)
            // Auto-generate slug from display name
            setName(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
          }}
          className={inputClass}
          placeholder="Field Manager"
        />
        <p className="mt-1 text-xs text-muted-foreground">Slug: {name || '(auto-generated)'}</p>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-foreground mb-1">Description</label>
        <input id="description" type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder="Can manage blocks and run workflows" />
      </div>

      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">
          Permissions <span className="text-destructive">*</span>
        </h3>
        <div className="rounded-lg border border-border p-3">
          <PermissionMatrix selected={permissions} onChange={setPermissions} />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || !displayName.trim() || permissions.size === 0}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
        >
          {submitting ? 'Creating...' : 'Create Role'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
