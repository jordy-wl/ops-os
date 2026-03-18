'use client'

import { makeConfigUpdater } from '../types'
import { FieldLabel, SelectInput, NumberInput } from '../shared/form-primitives'
import type { NodeConfigProps } from '../types'

const SOURCE_OPTIONS = [
  { value: '', label: 'Select a source...' },
  { value: 'search_results', label: 'Search Results' },
  { value: 'list_field', label: 'List Field' },
  { value: 'api_response', label: 'API Response' },
]

const PARALLEL_OPTIONS = [
  { value: '1', label: '1 (sequential)' },
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '25', label: '25' },
]

export function ForEachConfig({ node, onUpdate }: NodeConfigProps) {
  const { config, updateConfig } = makeConfigUpdater(node, onUpdate)
  const source = (config.for_each_source as string) ?? ''
  const maxParallel = (config.for_each_max_parallel as number) ?? 1
  const maxIterations = (config.for_each_max_iterations as number) ?? 100

  return (
    <div className="space-y-3">
      {/* Source */}
      <div>
        <FieldLabel htmlFor="foreach-source">For each item in</FieldLabel>
        <SelectInput
          id="foreach-source"
          value={source}
          onChange={(v) => updateConfig('for_each_source', v)}
          options={SOURCE_OPTIONS}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          The collection to iterate over. Each item runs the connected steps.
        </p>
      </div>

      {/* Max parallel */}
      <div>
        <FieldLabel htmlFor="foreach-parallel">Max parallel</FieldLabel>
        <SelectInput
          id="foreach-parallel"
          value={String(maxParallel)}
          onChange={(v) => updateConfig('for_each_max_parallel', parseInt(v) || 1)}
          options={PARALLEL_OPTIONS}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          How many items to process at the same time.
        </p>
      </div>

      {/* Max iterations */}
      <div>
        <FieldLabel htmlFor="foreach-iterations">Max iterations</FieldLabel>
        <NumberInput
          id="foreach-iterations"
          value={maxIterations}
          onChange={(v) => updateConfig('for_each_max_iterations', v)}
          min={1}
          max={1000}
        />
        <p className="mt-1 text-[10px] text-muted-foreground">
          Safety limit to prevent runaway loops. Default: 100.
        </p>
      </div>
    </div>
  )
}
