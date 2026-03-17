'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Sparkles, Loader2 } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ValuePropData {
  target_audience?: string
  unique_value?: string
  competitive_advantage?: string
  positioning_statement?: string
  proof_points?: string[]
  status?: string
}

interface ValuePropEditorProps {
  blockId: string
  blockName: string
  initialData: ValuePropData
  onAiSuggest?: () => Promise<{
    target_audience: string
    unique_value: string
    competitive_advantage: string
    proof_points: string[]
  } | null>
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'archived', label: 'Archived' },
]

// ─── Component ──────────────────────────────────────────────────────────────

export function ValuePropEditor({ blockId, initialData, onAiSuggest }: ValuePropEditorProps) {
  const router = useRouter()
  const [data, setData] = useState<ValuePropData>({
    target_audience: initialData.target_audience ?? '',
    unique_value: initialData.unique_value ?? '',
    competitive_advantage: initialData.competitive_advantage ?? '',
    positioning_statement: initialData.positioning_statement ?? '',
    proof_points: initialData.proof_points ?? [],
    status: initialData.status ?? 'draft',
  })
  const [saving, setSaving] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newProofPoint, setNewProofPoint] = useState('')

  // ─── Field Changes ──────────────────────────────────────────────────────

  const updateField = useCallback((field: keyof ValuePropData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }))
  }, [])

  // ─── Proof Points ───────────────────────────────────────────────────────

  const addProofPoint = useCallback(() => {
    const text = newProofPoint.trim()
    if (!text) return
    setData((prev) => ({
      ...prev,
      proof_points: [...(prev.proof_points ?? []), text],
    }))
    setNewProofPoint('')
  }, [newProofPoint])

  const removeProofPoint = useCallback((index: number) => {
    setData((prev) => ({
      ...prev,
      proof_points: (prev.proof_points ?? []).filter((_, i) => i !== index),
    }))
  }, [])

  const editProofPoint = useCallback((index: number, value: string) => {
    setData((prev) => ({
      ...prev,
      proof_points: (prev.proof_points ?? []).map((item, i) => (i === index ? value : item)),
    }))
  }, [])

  // ─── Save ───────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/blocks/${blockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata: data }),
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

  // ─── AI Suggest ─────────────────────────────────────────────────────────

  const handleAiSuggest = useCallback(async () => {
    if (!onAiSuggest) return
    setSuggesting(true)
    setError(null)
    try {
      const result = await onAiSuggest()
      if (result) {
        setData((prev) => ({
          ...prev,
          target_audience: result.target_audience,
          unique_value: result.unique_value,
          competitive_advantage: result.competitive_advantage,
          proof_points: result.proof_points,
        }))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI suggestion failed')
    } finally {
      setSuggesting(false)
    }
  }, [onAiSuggest])

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-foreground">Value Proposition</h3>
        <div className="flex items-center gap-2">
          {onAiSuggest && (
            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={suggesting}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {suggesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {suggesting ? 'Suggesting…' : 'AI Suggest'}
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

      <div className="rounded-md border border-border bg-card p-4 space-y-4">
        {/* Status */}
        <div>
          <label htmlFor="vp-status" className="block text-[12px] font-medium text-foreground mb-1">
            Status
          </label>
          <select
            id="vp-status"
            value={data.status}
            onChange={(e) => updateField('status', e.target.value)}
            className="h-8 w-full max-w-[200px] rounded-md border border-border bg-background px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Target Audience */}
        <div>
          <label htmlFor="vp-audience" className="block text-[12px] font-medium text-foreground mb-1">
            Target Audience
          </label>
          <input
            id="vp-audience"
            type="text"
            value={data.target_audience}
            onChange={(e) => updateField('target_audience', e.target.value)}
            placeholder="Who is your ideal customer?"
            className="h-8 w-full rounded-md border border-border bg-background px-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Unique Value */}
        <div>
          <label htmlFor="vp-value" className="block text-[12px] font-medium text-foreground mb-1">
            Unique Value
          </label>
          <textarea
            id="vp-value"
            value={data.unique_value}
            onChange={(e) => updateField('unique_value', e.target.value)}
            placeholder="What unique value do you provide?"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Competitive Advantage */}
        <div>
          <label htmlFor="vp-advantage" className="block text-[12px] font-medium text-foreground mb-1">
            Competitive Advantage
          </label>
          <textarea
            id="vp-advantage"
            value={data.competitive_advantage}
            onChange={(e) => updateField('competitive_advantage', e.target.value)}
            placeholder="What differentiates you from competitors?"
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Positioning Statement */}
        <div>
          <label htmlFor="vp-positioning" className="block text-[12px] font-medium text-foreground mb-1">
            Positioning Statement
          </label>
          <textarea
            id="vp-positioning"
            value={data.positioning_statement}
            onChange={(e) => updateField('positioning_statement', e.target.value)}
            placeholder="For [target audience] who [need], [product] is a [category] that [key benefit]."
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Proof Points */}
        <div>
          <label className="block text-[12px] font-medium text-foreground mb-1">
            Proof Points
          </label>
          <ul className="space-y-1.5 mb-2" role="list" aria-label="Proof points">
            {(data.proof_points ?? []).map((point, i) => (
              <li key={i} className="group flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <input
                  type="text"
                  value={point}
                  onChange={(e) => editProofPoint(i, e.target.value)}
                  className="flex-1 h-7 rounded border border-border bg-background px-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-ring"
                  aria-label={`Proof point ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => removeProofPoint(i)}
                  className="opacity-0 group-hover:opacity-50 hover:!opacity-100 transition-opacity flex-shrink-0"
                  aria-label="Remove proof point"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newProofPoint}
              onChange={(e) => setNewProofPoint(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addProofPoint()
                }
              }}
              placeholder="Add a proof point (e.g. 99.7% uptime)"
              className="flex-1 h-7 rounded border border-dashed border-border bg-transparent px-2 text-[12px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label="New proof point"
            />
            <button
              type="button"
              onClick={addProofPoint}
              disabled={!newProofPoint.trim()}
              className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity disabled:opacity-20"
              aria-label="Add proof point"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
