'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Tag, Plus, X, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LabelPickerProps {
  entityType: string
  entityId: string
  readOnly?: boolean
}

interface LabelValue {
  id: string
  value: string
  sort_order: number
}

interface LabelCategory {
  id: string
  name: string
  color: string | null
  values: LabelValue[]
}

interface LabelAssignment {
  id: string
  label_value_id: string
  entity_type: string
  entity_id: string
  label_value: {
    id: string
    value: string
    category: {
      id: string
      name: string
      color: string | null
    }
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_COLOR = '#6b7280' // gray-500

// ---------------------------------------------------------------------------
// LabelPicker
// ---------------------------------------------------------------------------

export function LabelPicker({ entityType, entityId, readOnly = false }: LabelPickerProps) {
  const [categories, setCategories] = useState<LabelCategory[]>([])
  const [assignments, setAssignments] = useState<LabelAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [mutatingIds, setMutatingIds] = useState<Set<string>>(new Set())

  const containerRef = useRef<HTMLDivElement>(null)

  // -------------------------------------------------------------------------
  // Data fetching
  // -------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [catRes, assignRes] = await Promise.all([
        fetch('/api/labels'),
        fetch(`/api/labels/assignments?entity_type=${entityType}&entity_id=${entityId}`),
      ])

      if (!catRes.ok) throw new Error('Failed to fetch label categories')
      if (!assignRes.ok) throw new Error('Failed to fetch label assignments')

      const catBody = await catRes.json()
      const assignBody = await assignRes.json()

      setCategories(catBody.data ?? [])
      setAssignments(assignBody.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labels')
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // -------------------------------------------------------------------------
  // Close popover on click outside
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPopoverOpen(false)
      }
    }
    if (popoverOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [popoverOpen])

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  const assignedValueIds = new Set(assignments.map((a) => a.label_value_id))

  function findAssignment(valueId: string): LabelAssignment | undefined {
    return assignments.find((a) => a.label_value_id === valueId)
  }

  function badgeColor(color: string | null): string {
    return color ?? DEFAULT_COLOR
  }

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async function handleAssign(valueId: string) {
    if (mutatingIds.has(valueId)) return

    setMutatingIds((prev) => new Set(prev).add(valueId))

    // Optimistic: find the category and value to build a local assignment
    let optimisticAssignment: LabelAssignment | null = null
    for (const cat of categories) {
      const val = cat.values.find((v) => v.id === valueId)
      if (val) {
        optimisticAssignment = {
          id: `optimistic-${valueId}`,
          label_value_id: valueId,
          entity_type: entityType,
          entity_id: entityId,
          label_value: {
            id: val.id,
            value: val.value,
            category: { id: cat.id, name: cat.name, color: cat.color },
          },
        }
        break
      }
    }

    if (optimisticAssignment) {
      setAssignments((prev) => [...prev, optimisticAssignment])
    }

    try {
      const res = await fetch('/api/labels/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_value_id: valueId, entity_type: entityType, entity_id: entityId }),
      })

      if (!res.ok) throw new Error('Failed to assign label')

      const body = await res.json()
      // Replace the optimistic assignment with the real one
      setAssignments((prev) =>
        prev.map((a) => (a.id === `optimistic-${valueId}` ? { ...a, id: body.data?.id ?? a.id } : a)),
      )
    } catch {
      // Revert optimistic update
      setAssignments((prev) => prev.filter((a) => a.id !== `optimistic-${valueId}`))
    } finally {
      setMutatingIds((prev) => {
        const next = new Set(prev)
        next.delete(valueId)
        return next
      })
    }
  }

  async function handleUnassign(assignmentId: string, valueId: string) {
    if (mutatingIds.has(valueId)) return

    setMutatingIds((prev) => new Set(prev).add(valueId))

    // Optimistic: remove from list
    const previousAssignments = [...assignments]
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId))

    try {
      const res = await fetch(`/api/labels/assignments?id=${assignmentId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to unassign label')
    } catch {
      // Revert optimistic update
      setAssignments(previousAssignments)
    } finally {
      setMutatingIds((prev) => {
        const next = new Set(prev)
        next.delete(valueId)
        return next
      })
    }
  }

  function handleToggle(valueId: string) {
    const existing = findAssignment(valueId)
    if (existing) {
      handleUnassign(existing.id, valueId)
    } else {
      handleAssign(valueId)
    }
  }

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status" aria-label="Loading labels">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
        <span>Loading labels...</span>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <Tag className="size-3" aria-hidden="true" />
        <span>{error}</span>
        <button
          type="button"
          onClick={fetchData}
          className="ml-1 underline hover:no-underline text-xs cursor-pointer"
          aria-label="Retry loading labels"
        >
          Retry
        </button>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Assigned label badges */}
        {assignments.map((assignment) => {
          const color = badgeColor(assignment.label_value.category.color)
          return (
            <span
              key={assignment.id}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
              style={{
                backgroundColor: `${color}20`,
                borderColor: `${color}40`,
                color: color,
              }}
            >
              {assignment.label_value.category.name}: {assignment.label_value.value}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleUnassign(assignment.id, assignment.label_value_id)}
                  className="ml-0.5 rounded-sm p-0.5 hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer transition-colors"
                  aria-label={`Remove label ${assignment.label_value.category.name}: ${assignment.label_value.value}`}
                  disabled={mutatingIds.has(assignment.label_value_id)}
                >
                  <X className="size-3" aria-hidden="true" />
                </button>
              )}
            </span>
          )
        })}

        {/* Empty state */}
        {assignments.length === 0 && readOnly && (
          <span className="text-xs text-muted-foreground">No labels</span>
        )}

        {/* Add Label button */}
        {!readOnly && (
          <button
            type="button"
            onClick={() => setPopoverOpen((prev) => !prev)}
            className={cn(
              'inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5',
              'text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30',
              'cursor-pointer transition-colors',
            )}
            aria-expanded={popoverOpen}
            aria-haspopup="listbox"
            aria-label="Add label"
          >
            <Plus className="size-3" aria-hidden="true" />
            Add Label
          </button>
        )}
      </div>

      {/* Dropdown popover */}
      {popoverOpen && (
        <div
          className="absolute left-0 z-50 mt-1.5 w-64 rounded-md border bg-popover shadow-lg"
          role="listbox"
          aria-label="Label categories"
        >
          <div className="max-h-64 overflow-y-auto">
            {categories.length === 0 && (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center">
                No label categories defined
              </div>
            )}

            {categories.map((category) => (
              <div key={category.id}>
                <div
                  className="sticky top-0 flex items-center gap-1.5 bg-muted/80 backdrop-blur-sm px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                >
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{ backgroundColor: badgeColor(category.color) }}
                    aria-hidden="true"
                  />
                  {category.name}
                </div>
                {category.values.map((val) => {
                  const isAssigned = assignedValueIds.has(val.id)
                  const isMutating = mutatingIds.has(val.id)
                  return (
                    <button
                      key={val.id}
                      type="button"
                      role="option"
                      aria-selected={isAssigned}
                      aria-label={`${isAssigned ? 'Remove' : 'Add'} label ${category.name}: ${val.value}`}
                      disabled={isMutating}
                      className={cn(
                        'flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left cursor-pointer transition-colors',
                        isAssigned
                          ? 'text-muted-foreground bg-muted/30'
                          : 'text-foreground hover:bg-accent',
                        isMutating && 'opacity-50 cursor-wait',
                      )}
                      onClick={() => handleToggle(val.id)}
                    >
                      <span
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-sm border',
                          isAssigned
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30',
                        )}
                        aria-hidden="true"
                      >
                        {isAssigned && <Check className="size-3" />}
                      </span>
                      <span className="flex-1 truncate">{val.value}</span>
                      {isMutating && <Loader2 className="size-3 animate-spin shrink-0" aria-hidden="true" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
