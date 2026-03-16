'use client'

import { useState } from 'react'

interface OrgData {
  id: string
  name: string
  slug: string
  org_level: string
  created_at: string
}

/**
 * OrgProfileForm — displays and allows editing of org name and slug.
 */
export function OrgProfileForm({ org }: { org: OrgData }) {
  const [name, setName] = useState(org.name ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch(`/api/org/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <label htmlFor="org-name" className="block text-sm font-medium text-foreground mb-1">
          Organisation Name
        </label>
        <input
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder="Enter organisation name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Slug</label>
        <p className="text-sm text-muted-foreground">{org.slug || '(not set)'}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Level</label>
        <p className="text-sm text-muted-foreground capitalize">{org.org_level}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-1">Created</label>
        <p className="text-sm text-muted-foreground">
          {org.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || name === org.name}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
      </button>
    </div>
  )
}
