'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Tags,
  Plus,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Palette,
  GripVertical,
  Loader2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LabelValue {
  id: string
  value: string
  slug: string
  sort_order: number
}

interface LabelCategory {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  created_at: string
  values: LabelValue[]
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRESET_COLORS = [
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Green', hex: '#22c55e' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Cyan', hex: '#06b6d4' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LabelsManager() {
  const [categories, setCategories] = useState<LabelCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Expansion / inline editing state
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(PRESET_COLORS[0].hex)
  const [newCategoryDescription, setNewCategoryDescription] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)

  // Edit category
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryColor, setEditCategoryColor] = useState('')
  const [editCategoryDescription, setEditCategoryDescription] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Add value
  const [addingValueTo, setAddingValueTo] = useState<string | null>(null)
  const [newValueText, setNewValueText] = useState('')
  const [newValueSortOrder, setNewValueSortOrder] = useState(0)
  const [savingValue, setSavingValue] = useState(false)

  // Delete confirmation
  const [deletingCategory, setDeletingCategory] = useState<LabelCategory | null>(null)
  const [deletingInProgress, setDeletingInProgress] = useState(false)

  // -------------------------------------------------------------------------
  // Fetch categories
  // -------------------------------------------------------------------------

  const fetchCategories = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/labels')
      if (!res.ok) {
        throw new Error(`Failed to fetch labels (${res.status})`)
      }
      const data = await res.json()
      setCategories(data.categories ?? data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labels')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  // -------------------------------------------------------------------------
  // Create category
  // -------------------------------------------------------------------------

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return
    setSavingCategory(true)
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          color: newCategoryColor,
          description: newCategoryDescription.trim() || null,
        }),
      })
      if (!res.ok) {
        throw new Error(`Failed to create category (${res.status})`)
      }
      setCreatingCategory(false)
      setNewCategoryName('')
      setNewCategoryColor(PRESET_COLORS[0].hex)
      setNewCategoryDescription('')
      await fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category')
    } finally {
      setSavingCategory(false)
    }
  }

  // -------------------------------------------------------------------------
  // Edit category
  // -------------------------------------------------------------------------

  function startEditCategory(category: LabelCategory) {
    setEditingCategoryId(category.id)
    setEditCategoryName(category.name)
    setEditCategoryColor(category.color ?? PRESET_COLORS[0].hex)
    setEditCategoryDescription(category.description ?? '')
  }

  function cancelEditCategory() {
    setEditingCategoryId(null)
    setEditCategoryName('')
    setEditCategoryColor('')
    setEditCategoryDescription('')
  }

  async function handleSaveEditCategory() {
    if (!editingCategoryId || !editCategoryName.trim()) return
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/labels/${editingCategoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editCategoryName.trim(),
          color: editCategoryColor,
          description: editCategoryDescription.trim() || null,
        }),
      })
      if (!res.ok) {
        throw new Error(`Failed to update category (${res.status})`)
      }
      cancelEditCategory()
      await fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category')
    } finally {
      setSavingEdit(false)
    }
  }

  // -------------------------------------------------------------------------
  // Delete category
  // -------------------------------------------------------------------------

  async function handleDeleteCategory() {
    if (!deletingCategory) return
    setDeletingInProgress(true)
    try {
      const res = await fetch(`/api/labels/${deletingCategory.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error(`Failed to delete category (${res.status})`)
      }
      setDeletingCategory(null)
      if (expandedCategory === deletingCategory.id) {
        setExpandedCategory(null)
      }
      await fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category')
    } finally {
      setDeletingInProgress(false)
    }
  }

  // -------------------------------------------------------------------------
  // Add value to category
  // -------------------------------------------------------------------------

  function startAddingValue(categoryId: string) {
    setAddingValueTo(categoryId)
    setNewValueText('')
    const category = categories.find((c) => c.id === categoryId)
    const maxOrder = category?.values.reduce((max, v) => Math.max(max, v.sort_order), 0) ?? 0
    setNewValueSortOrder(maxOrder + 1)
  }

  async function handleAddValue() {
    if (!addingValueTo || !newValueText.trim()) return
    setSavingValue(true)
    try {
      const res = await fetch(`/api/labels/${addingValueTo}/values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          value: newValueText.trim(),
          sort_order: newValueSortOrder,
        }),
      })
      if (!res.ok) {
        throw new Error(`Failed to add value (${res.status})`)
      }
      setAddingValueTo(null)
      setNewValueText('')
      setNewValueSortOrder(0)
      await fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add value')
    } finally {
      setSavingValue(false)
    }
  }

  // -------------------------------------------------------------------------
  // Delete value
  // -------------------------------------------------------------------------

  async function handleDeleteValue(categoryId: string, valueId: string) {
    try {
      const res = await fetch(`/api/labels/${categoryId}/values/${valueId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error(`Failed to delete value (${res.status})`)
      }
      await fetchCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete value')
    }
  }

  // -------------------------------------------------------------------------
  // Toggle expand
  // -------------------------------------------------------------------------

  function toggleExpand(categoryId: string) {
    setExpandedCategory((prev) => (prev === categoryId ? null : categoryId))
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div>
      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Labels</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organize workflows and blocks with label categories and values.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreatingCategory(true)
            setNewCategoryName('')
            setNewCategoryColor(PRESET_COLORS[0].hex)
            setNewCategoryDescription('')
          }}
          disabled={creatingCategory}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Create Category</span>
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mb-4 rounded-md bg-destructive/5 border border-destructive/20 px-4 py-3 text-[13px] text-destructive flex items-center justify-between"
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-2 text-destructive hover:text-destructive/80"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading labels...</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && categories.length === 0 && !creatingCategory && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-16 px-6 text-center">
          <Tags className="h-10 w-10 text-muted-foreground/50 mb-3" aria-hidden="true" />
          <p className="text-lg font-medium text-foreground mb-1">No label categories yet</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Labels help you organize workflows by department, purpose, or region. Most
            organizations start with Department and Purpose categories.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setCreatingCategory(true)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create your first category</span>
          </Button>
        </div>
      )}

      {/* Create category form (inline) */}
      {creatingCategory && (
        <div className="mb-4 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">New Category</h3>
          <div>
            <label htmlFor="new-cat-name" className="block text-[13px] font-medium text-foreground mb-1">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              id="new-cat-name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Department, Region, Purpose"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-foreground mb-1.5">
              <Palette className="inline h-3.5 w-3.5 mr-1" aria-hidden="true" />
              Color
            </label>
            <ColorPicker value={newCategoryColor} onChange={setNewCategoryColor} />
          </div>
          <div>
            <label htmlFor="new-cat-desc" className="block text-[13px] font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              id="new-cat-desc"
              value={newCategoryDescription}
              onChange={(e) => setNewCategoryDescription(e.target.value)}
              placeholder="Optional description for this category"
              rows={2}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background resize-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" onClick={handleCreateCategory} disabled={!newCategoryName.trim() || savingCategory}>
              {savingCategory ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Saving...</span>
                </>
              ) : (
                'Save'
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreatingCategory(false)}
              disabled={savingCategory}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Category list */}
      {!loading && categories.length > 0 && (
        <div className="space-y-2">
          {categories.map((category) => {
            const isExpanded = expandedCategory === category.id
            const isEditing = editingCategoryId === category.id

            return (
              <div
                key={category.id}
                className="rounded-lg border border-border bg-background shadow-sm"
              >
                {/* Category header row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleExpand(category.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${category.name}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}

                    {category.color && (
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: category.color }}
                        aria-hidden="true"
                      />
                    )}

                    <span className="text-[13px] font-medium text-foreground truncate">
                      {category.name}
                    </span>

                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground shrink-0">
                      {category.values.length} {category.values.length === 1 ? 'value' : 'values'}
                    </span>
                  </button>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => startEditCategory(category)}
                      aria-label={`Edit ${category.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeletingCategory(category)}
                      aria-label={`Delete ${category.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-3">
                    <div>
                      <label
                        htmlFor={`edit-cat-name-${category.id}`}
                        className="block text-[13px] font-medium text-foreground mb-1"
                      >
                        Name
                      </label>
                      <Input
                        id={`edit-cat-name-${category.id}`}
                        value={editCategoryName}
                        onChange={(e) => setEditCategoryName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-medium text-foreground mb-1.5">
                        Color
                      </label>
                      <ColorPicker value={editCategoryColor} onChange={setEditCategoryColor} />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-cat-desc-${category.id}`}
                        className="block text-[13px] font-medium text-foreground mb-1"
                      >
                        Description
                      </label>
                      <textarea
                        id={`edit-cat-desc-${category.id}`}
                        value={editCategoryDescription}
                        onChange={(e) => setEditCategoryDescription(e.target.value)}
                        rows={2}
                        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={handleSaveEditCategory}
                        disabled={!editCategoryName.trim() || savingEdit}
                      >
                        {savingEdit ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          'Save'
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelEditCategory} disabled={savingEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Expanded values list */}
                {isExpanded && !isEditing && (
                  <div className="border-t border-border">
                    {category.values.length === 0 && addingValueTo !== category.id && (
                      <div className="px-4 py-4 text-[13px] text-muted-foreground text-center">
                        No values in this category yet.
                      </div>
                    )}

                    {category.values
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((val) => (
                        <div
                          key={val.id}
                          className="flex items-center gap-3 px-4 py-2 border-b border-border last:border-b-0 group/value hover:bg-muted/30 transition-colors"
                        >
                          <GripVertical
                            className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="text-[13px] text-foreground flex-1 min-w-0 truncate">
                            {val.value}
                          </span>
                          <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                            #{val.sort_order}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleDeleteValue(category.id, val.id)}
                            aria-label={`Delete value ${val.value}`}
                            className="opacity-0 group-hover/value:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}

                    {/* Add value form (inline) */}
                    {addingValueTo === category.id ? (
                      <div className="px-4 py-3 bg-muted/20 flex items-end gap-2">
                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor={`new-val-${category.id}`}
                            className="block text-[11px] font-medium text-muted-foreground mb-1"
                          >
                            Value
                          </label>
                          <Input
                            id={`new-val-${category.id}`}
                            value={newValueText}
                            onChange={(e) => setNewValueText(e.target.value)}
                            placeholder="e.g. Engineering, Sales"
                            autoFocus
                          />
                        </div>
                        <div className="w-20 shrink-0">
                          <label
                            htmlFor={`new-val-order-${category.id}`}
                            className="block text-[11px] font-medium text-muted-foreground mb-1"
                          >
                            Order
                          </label>
                          <Input
                            id={`new-val-order-${category.id}`}
                            type="number"
                            value={newValueSortOrder}
                            onChange={(e) => setNewValueSortOrder(Number(e.target.value))}
                            min={0}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleAddValue}
                          disabled={!newValueText.trim() || savingValue}
                        >
                          {savingValue ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            'Add'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setAddingValueTo(null)}
                          disabled={savingValue}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="px-4 py-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startAddingValue(category.id)}
                          className="text-muted-foreground"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Add Value</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deletingCategory}
        onOpenChange={(open) => {
          if (!open) setDeletingCategory(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deletingCategory?.name}?</DialogTitle>
            <DialogDescription>
              This will remove all values and unassign them from any workflows. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeletingCategory(null)}
              disabled={deletingInProgress}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCategory}
              disabled={deletingInProgress}
            >
              {deletingInProgress ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  <span>Deleting...</span>
                </>
              ) : (
                'Delete Category'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ColorPicker — 6 presets + custom hex input
// ---------------------------------------------------------------------------

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (hex: string) => void
}) {
  const [showCustom, setShowCustom] = useState(
    !PRESET_COLORS.some((p) => p.hex === value)
  )

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PRESET_COLORS.map((preset) => (
        <button
          key={preset.hex}
          type="button"
          onClick={() => {
            onChange(preset.hex)
            setShowCustom(false)
          }}
          className={cn(
            'h-7 w-7 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === preset.hex ? 'border-foreground scale-110' : 'border-transparent'
          )}
          style={{ backgroundColor: preset.hex }}
          aria-label={`Select ${preset.name} color`}
          title={preset.name}
        />
      ))}
      <button
        type="button"
        onClick={() => setShowCustom(true)}
        className={cn(
          'h-7 w-7 rounded-full border-2 border-dashed flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          showCustom ? 'border-foreground' : 'border-muted-foreground/40 hover:border-muted-foreground'
        )}
        aria-label="Enter custom color"
        title="Custom"
      >
        <Palette className="h-3 w-3 text-muted-foreground" />
      </button>
      {showCustom && (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#hex"
          className="w-24 h-7 text-[12px]"
          maxLength={7}
          aria-label="Custom hex color"
        />
      )}
    </div>
  )
}
