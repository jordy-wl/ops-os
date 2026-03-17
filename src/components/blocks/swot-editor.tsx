'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, GripVertical, Sparkles, Loader2 } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

type QuadrantKey = 'strengths' | 'weaknesses' | 'opportunities' | 'threats'

interface SwotData {
  strengths?: string[]
  weaknesses?: string[]
  opportunities?: string[]
  threats?: string[]
  analysis_date?: string
  context_block_id?: string
  ai_generated?: boolean
}

interface SwotEditorProps {
  blockId: string
  blockName: string
  initialData: SwotData
  onAiGenerate?: () => Promise<{ strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] } | null>
}

// ─── Quadrant Config ────────────────────────────────────────────────────────

const QUADRANTS: { key: QuadrantKey; label: string; color: string; bg: string; border: string; placeholder: string }[] = [
  { key: 'strengths', label: 'Strengths', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', placeholder: 'e.g. Strong market position' },
  { key: 'weaknesses', label: 'Weaknesses', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', placeholder: 'e.g. Limited geographic reach' },
  { key: 'opportunities', label: 'Opportunities', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', placeholder: 'e.g. Growing market demand' },
  { key: 'threats', label: 'Threats', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', placeholder: 'e.g. New competitor entering market' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function SwotEditor({ blockId, initialData, onAiGenerate }: SwotEditorProps) {
  const router = useRouter()
  const [data, setData] = useState<SwotData>({
    strengths: initialData.strengths ?? [],
    weaknesses: initialData.weaknesses ?? [],
    opportunities: initialData.opportunities ?? [],
    threats: initialData.threats ?? [],
    analysis_date: initialData.analysis_date,
    context_block_id: initialData.context_block_id,
    ai_generated: initialData.ai_generated,
  })
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newItems, setNewItems] = useState<Record<QuadrantKey, string>>({
    strengths: '',
    weaknesses: '',
    opportunities: '',
    threats: '',
  })
  const [dragState, setDragState] = useState<{ quadrant: QuadrantKey; fromIndex: number } | null>(null)

  // ─── Item Operations ────────────────────────────────────────────────────

  const addItem = useCallback((quadrant: QuadrantKey) => {
    const text = newItems[quadrant].trim()
    if (!text) return
    setData((prev) => ({
      ...prev,
      [quadrant]: [...(prev[quadrant] ?? []), text],
    }))
    setNewItems((prev) => ({ ...prev, [quadrant]: '' }))
  }, [newItems])

  const removeItem = useCallback((quadrant: QuadrantKey, index: number) => {
    setData((prev) => ({
      ...prev,
      [quadrant]: (prev[quadrant] ?? []).filter((_, i) => i !== index),
    }))
  }, [])

  const editItem = useCallback((quadrant: QuadrantKey, index: number, value: string) => {
    setData((prev) => ({
      ...prev,
      [quadrant]: (prev[quadrant] ?? []).map((item, i) => (i === index ? value : item)),
    }))
  }, [])

  const moveItem = useCallback((quadrant: QuadrantKey, fromIndex: number, toIndex: number) => {
    setData((prev) => {
      const items = [...(prev[quadrant] ?? [])]
      const [moved] = items.splice(fromIndex, 1)
      items.splice(toIndex, 0, moved)
      return { ...prev, [quadrant]: items }
    })
  }, [])

  // ─── Drag Handlers ──────────────────────────────────────────────────────

  const handleDragStart = useCallback((quadrant: QuadrantKey, index: number) => {
    setDragState({ quadrant, fromIndex: index })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, quadrant: QuadrantKey, index: number) => {
    e.preventDefault()
    if (dragState && dragState.quadrant === quadrant && dragState.fromIndex !== index) {
      moveItem(quadrant, dragState.fromIndex, index)
      setDragState({ quadrant, fromIndex: index })
    }
  }, [dragState, moveItem])

  const handleDragEnd = useCallback(() => {
    setDragState(null)
  }, [])

  // ─── Save ───────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            ...data,
            analysis_date: data.analysis_date || new Date().toISOString().split('T')[0],
          },
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error?.message ?? 'Failed to save')
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }, [blockId, data, router])

  // ─── AI Generate ────────────────────────────────────────────────────────

  const handleAiGenerate = useCallback(async () => {
    if (!onAiGenerate) return
    setGenerating(true)
    setError(null)
    try {
      const result = await onAiGenerate()
      if (result) {
        setData((prev) => ({
          ...prev,
          strengths: result.strengths,
          weaknesses: result.weaknesses,
          opportunities: result.opportunities,
          threats: result.threats,
          ai_generated: true,
          analysis_date: new Date().toISOString().split('T')[0],
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI generation failed')
    } finally {
      setGenerating(false)
    }
  }, [onAiGenerate])

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-foreground">SWOT Analysis</h3>
        <div className="flex items-center gap-2">
          {onAiGenerate && (
            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {generating ? 'Generating…' : 'AI Generate'}
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[13px] text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2" role="alert">
          {error}
        </div>
      )}

      {data.ai_generated && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          AI Generated {data.analysis_date && `on ${data.analysis_date}`}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {QUADRANTS.map((q) => {
          const items = data[q.key] ?? []
          return (
            <div key={q.key} className={`rounded-md border ${q.border} ${q.bg} p-3`}>
              <h4 className={`text-[12px] font-semibold ${q.color} mb-2`}>{q.label}</h4>

              <ul className="space-y-1 mb-2" role="list" aria-label={`${q.label} items`}>
                {items.map((item, i) => (
                  <li
                    key={`${q.key}-${i}`}
                    className="group flex items-start gap-1 text-[12px] text-foreground"
                    draggable
                    onDragStart={() => handleDragStart(q.key, i)}
                    onDragOver={(e) => handleDragOver(e, q.key, i)}
                    onDragEnd={handleDragEnd}
                  >
                    <button
                      type="button"
                      className="mt-0.5 cursor-grab opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0"
                      aria-label={`Reorder ${q.label} item`}
                      tabIndex={-1}
                    >
                      <GripVertical className="h-3 w-3" />
                    </button>
                    <input
                      type="text"
                      value={item}
                      onChange={(e) => editItem(q.key, i, e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-[12px] p-0 focus:ring-0"
                      aria-label={`${q.label} item ${i + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(q.key, i)}
                      className="mt-0.5 opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity flex-shrink-0"
                      aria-label={`Remove ${q.label} item`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newItems[q.key]}
                  onChange={(e) => setNewItems((prev) => ({ ...prev, [q.key]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addItem(q.key)
                    }
                  }}
                  placeholder={q.placeholder}
                  className="flex-1 bg-transparent border-none outline-none text-[12px] placeholder:text-muted-foreground/50 p-0 focus:ring-0"
                  aria-label={`Add ${q.label} item`}
                />
                <button
                  type="button"
                  onClick={() => addItem(q.key)}
                  disabled={!newItems[q.key].trim()}
                  className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity disabled:opacity-20"
                  aria-label={`Add to ${q.label}`}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
