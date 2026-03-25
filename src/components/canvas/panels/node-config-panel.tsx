'use client'

import { X } from 'lucide-react'
import type { Node } from '@xyflow/react'
import type { OrgEntities } from '../hooks/use-org-entities'
import type { PreviousStep } from './shared/template-record-picker'
import { FieldLabel, TextInput } from './shared/form-primitives'
import {
  TriggerConfig,
  ActionConfig,
  ConditionConfig,
  WaitConfig,
  InputConfig,
  OutputConfig,
  TaskConfig,
  RouteConfig,
  ForEachConfig,
  StepInstructionsPanel,
} from './configs'

interface NodeConfigPanelProps {
  node: Node
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  onClose: () => void
  entities?: OrgEntities
  previousSteps?: PreviousStep[]
}

const NODE_TYPE_LABELS: Record<string, string> = {
  trigger: 'Trigger',
  action: 'Action',
  condition: 'Condition',
  wait: 'Wait / Delay',
  input: 'Input',
  output: 'Output',
  task: 'Task',
  route: 'Route',
  foreach: 'For Each',
}

export function NodeConfigPanel({ node, onUpdate, onClose, entities, previousSteps }: NodeConfigPanelProps) {
  const nodeType = node.type ?? 'action'
  const data = node.data as Record<string, unknown>

  return (
    <div className="w-64 border-l bg-background flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <h3 className="text-xs font-semibold text-foreground">
            {NODE_TYPE_LABELS[nodeType] ?? 'Node'} Config
          </h3>
          <p className="text-xs text-muted-foreground truncate mt-0.5" title={node.id}>
            {(data.label as string) ?? node.id}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close config panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Config fields */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {/* Label field (common to all) */}
        <div className="mb-3">
          <FieldLabel htmlFor="node-label">Label</FieldLabel>
          <TextInput
            id="node-label"
            value={(data.label as string) ?? ''}
            onChange={(v) => onUpdate(node.id, { ...data, label: v })}
            placeholder="Node label"
          />
        </div>

        {/* Type-specific config */}
        {nodeType === 'trigger' && <TriggerConfig node={node} onUpdate={onUpdate} entities={entities} previousSteps={previousSteps} />}
        {nodeType === 'action' && <ActionConfig node={node} onUpdate={onUpdate} entities={entities} previousSteps={previousSteps} />}
        {nodeType === 'condition' && <ConditionConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'wait' && <WaitConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'input' && <InputConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'output' && <OutputConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'task' && <TaskConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'route' && <RouteConfig node={node} onUpdate={onUpdate} />}
        {nodeType === 'foreach' && <ForEachConfig node={node} onUpdate={onUpdate} />}

        {/* Step instructions panel — shown for executable step types */}
        {(nodeType === 'action' || nodeType === 'condition' || nodeType === 'wait' || nodeType === 'task' || nodeType === 'route' || nodeType === 'foreach') && (
          <StepInstructionsPanel node={node} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  )
}
