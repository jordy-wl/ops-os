'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { UserCircle, Search, X, ChevronDown } from 'lucide-react'

interface TeamMember {
  id: string
  name: string
}

interface OwnerPickerProps {
  blockId: string
  currentOwnerId: string | null
  orgTeamMembers?: TeamMember[]
}

/**
 * OwnerPicker -- client component for selecting the owner of a block.
 *
 * Displays the current owner (or "Unassigned") with a dropdown to search
 * and select from team_member blocks in the org. Calls PATCH /api/blocks/[id]/owner.
 */
export function OwnerPicker({ blockId, currentOwnerId, orgTeamMembers }: OwnerPickerProps) {
  const [ownerId, setOwnerId] = useState<string | null>(currentOwnerId)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(orgTeamMembers ?? [])
  const [loading, setLoading] = useState(!orgTeamMembers)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch team members on mount if not provided via SSR
  useEffect(() => {
    if (orgTeamMembers) return
    let cancelled = false

    async function fetchTeamMembers() {
      try {
        const res = await fetch('/api/blocks?type=team_member&limit=200')
        if (!res.ok) throw new Error('Failed to fetch team members')
        const body = await res.json()
        if (!cancelled) {
          const members: TeamMember[] = (body.data ?? []).map(
            (b: { id: string; name: string }) => ({ id: b.id, name: b.name })
          )
          setTeamMembers(members)
        }
      } catch {
        if (!cancelled) setError('Could not load team members')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchTeamMembers()
    return () => { cancelled = true }
  }, [orgTeamMembers])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [open])

  const handleSelect = useCallback(
    async (newOwnerId: string | null) => {
      if (newOwnerId === ownerId) {
        setOpen(false)
        setSearch('')
        return
      }

      setSaving(true)
      setError(null)

      try {
        const res = await fetch(`/api/blocks/${blockId}/owner`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ owner_id: newOwnerId }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error?.message ?? 'Failed to update owner')
        }

        setOwnerId(newOwnerId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
      } finally {
        setSaving(false)
        setOpen(false)
        setSearch('')
      }
    },
    [blockId, ownerId]
  )

  const currentOwner = teamMembers.find((m) => m.id === ownerId)
  const filtered = teamMembers.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs text-muted-foreground mb-1">Owner</label>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={saving}
        className="w-full flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-left hover:bg-muted transition-colors disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Owner: ${currentOwner?.name ?? 'Unassigned'}. Click to change.`}
      >
        <UserCircle className="w-4 h-4 shrink-0 text-muted-foreground" />
        <span className={`flex-1 truncate ${currentOwner ? 'text-foreground' : 'text-muted-foreground'}`}>
          {saving ? 'Saving...' : currentOwner?.name ?? 'Unassigned'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
      </button>

      {error && (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      )}

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg"
          role="listbox"
          aria-label="Select owner"
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team members..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              aria-label="Search team members"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clear option */}
          <div className="max-h-48 overflow-y-auto">
            {ownerId !== null && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                role="option"
                aria-selected={false}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                Clear owner
              </button>
            )}

            {loading && (
              <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                Loading...
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground text-center">
                {search ? 'No matches found' : 'No team members found'}
              </div>
            )}

            {!loading &&
              filtered.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => handleSelect(member.id)}
                  role="option"
                  aria-selected={member.id === ownerId}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    member.id === ownerId
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <UserCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{member.name}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
