'use client'

import { Plus, Trash2 } from 'lucide-react'
import { makeConfigUpdater } from '../types'
import { FieldLabel, TextInput, SelectInput } from '../shared/form-primitives'
import type { NodeConfigProps } from '../types'

interface RouteBranch {
  value: string
  label?: string
}

const ROUTE_FIELD_OPTIONS = [
  { value: '', label: 'Select a field…' },
  { value: 'block.status', label: 'Record Status' },
  { value: 'block.type', label: 'Record Type' },
  { value: 'context.ai_classify.result', label: 'AI Classification Result' },
  { value: 'context.ai_analysis.result', label: 'AI Analysis Result' },
  { value: 'context.ai_risk_assessment.risk_level', label: 'Risk Level' },
]

export function RouteConfig({ node, onUpdate }: NodeConfigProps) {
  const { config, updateConfig } = makeConfigUpdater(node, onUpdate)
  const routeField = (config.route_field as string) ?? ''
  const branches: RouteBranch[] = Array.isArray(config.route_branches) ? config.route_branches as RouteBranch[] : []
  const defaultLabel = (config.route_default_label as string) ?? 'Default'

  const updateBranches = (newBranches: RouteBranch[]) => {
    updateConfig('route_branches', newBranches)
  }

  const addBranch = () => {
    updateBranches([...branches, { value: '', label: '' }])
  }

  const removeBranch = (index: number) => {
    updateBranches(branches.filter((_, i) => i !== index))
  }

  const updateBranch = (index: number, field: keyof RouteBranch, value: string) => {
    const updated = branches.map((b, i) =>
      i === index ? { ...b, [field]: value } : b
    )
    updateBranches(updated)
  }

  return (
    <div className="space-y-3">
      {/* Route based on */}
      <div>
        <FieldLabel htmlFor="route-field">Route based on</FieldLabel>
        <SelectInput
          id="route-field"
          value={routeField}
          onChange={(v) => updateConfig('route_field', v)}
          options={ROUTE_FIELD_OPTIONS}
        />
      </div>

      {/* Branch list */}
      <div>
        <FieldLabel htmlFor="route-branches">Branches</FieldLabel>
        <div className="space-y-2">
          {branches.map((branch, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded-md border border-border/50 bg-muted/30 p-2">
              <div className="flex-1 space-y-1.5">
                <TextInput
                  id={`route-branch-value-${i}`}
                  value={branch.value}
                  onChange={(v) => updateBranch(i, 'value', v)}
                  placeholder="When value equals…"
                />
                <TextInput
                  id={`route-branch-label-${i}`}
                  value={branch.label ?? ''}
                  onChange={(v) => updateBranch(i, 'label', v)}
                  placeholder="Branch label (optional)"
                />
              </div>
              <button
                type="button"
                onClick={() => removeBranch(i)}
                className="mt-1 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label={`Remove branch ${i + 1}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addBranch}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border py-1.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Branch
        </button>
      </div>

      {/* Default branch label */}
      <div>
        <FieldLabel htmlFor="route-default">Default Branch Label</FieldLabel>
        <TextInput
          id="route-default"
          value={defaultLabel}
          onChange={(v) => updateConfig('route_default_label', v)}
          placeholder="Default"
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Used when no other branch matches. Cannot be removed.
        </p>
      </div>
    </div>
  )
}
