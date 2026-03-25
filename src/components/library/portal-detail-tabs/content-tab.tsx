'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ClipboardList, ExternalLink, GitBranch, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ALL_PORTAL_BLOCK_TYPES } from '@/lib/portal-constants'
import { SYSTEM_BLOCK_TYPES } from '@/lib/block-types/system-types'
import type { PortalConfig, FormTemplateSummary, WorkflowTemplateSummary, RequestTypeConfigItem } from '../portal-detail-view'

interface ContentTabProps {
  config: PortalConfig
  onUpdate: (updates: Partial<PortalConfig>) => void
  formTemplates: FormTemplateSummary[]
  workflowTemplates: WorkflowTemplateSummary[]
  clientId: string | null
}

/** Look up a system block type definition by type_name */
function getSystemType(typeName: string) {
  return SYSTEM_BLOCK_TYPES.find((t) => t.type_name === typeName)
}

/** Extract field entries from a type's field_schema, sorted by x-display-order */
function getFieldEntries(typeName: string): { key: string; label: string; order: number }[] {
  const def = getSystemType(typeName)
  if (!def?.field_schema?.properties) return []

  const props = def.field_schema.properties as Record<
    string,
    { description?: string; 'x-display-order'?: number }
  >

  return Object.entries(props)
    .map(([key, schema]) => ({
      key,
      label: schema.description ?? formatFieldKey(key),
      order: schema['x-display-order'] ?? 999,
    }))
    .sort((a, b) => a.order - b.order)
}

/** Convert snake_case to Title Case for display */
function formatFieldKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function ContentTab({
  config,
  onUpdate,
  formTemplates,
  workflowTemplates,
}: ContentTabProps) {
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())
  const [addingRequestType, setAddingRequestType] = useState(false)

  // Build the current config from exposed_block_type_config, falling back to exposed_block_types
  const blockTypeConfig = useMemo(() => {
    const cfg = config.exposed_block_type_config ?? {}
    if (Object.keys(cfg).length > 0) return cfg

    // Fallback: build from legacy exposed_block_types
    const fallback: Record<string, { enabled: boolean; fields: Record<string, boolean> }> = {}
    for (const t of config.exposed_block_types ?? []) {
      fallback[t] = { enabled: true, fields: {} }
    }
    return fallback
  }, [config.exposed_block_type_config, config.exposed_block_types])

  const toggleExpanded = useCallback((typeName: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(typeName)) {
        next.delete(typeName)
      } else {
        next.add(typeName)
      }
      return next
    })
  }, [])

  const handleTypeToggle = useCallback(
    (typeName: string, enabled: boolean) => {
      const updated = { ...blockTypeConfig }
      if (enabled) {
        updated[typeName] = { enabled: true, fields: updated[typeName]?.fields ?? {} }
      } else {
        updated[typeName] = { enabled: false, fields: updated[typeName]?.fields ?? {} }
      }

      // Sync both fields for backward compat
      const enabledTypes = Object.entries(updated)
        .filter(([, v]) => v.enabled)
        .map(([k]) => k)

      onUpdate({
        exposed_block_type_config: updated,
        exposed_block_types: enabledTypes,
      })
    },
    [blockTypeConfig, onUpdate]
  )

  const handleFieldToggle = useCallback(
    (typeName: string, fieldKey: string, visible: boolean) => {
      const updated = { ...blockTypeConfig }
      const current = updated[typeName] ?? { enabled: true, fields: {} }
      const fields = { ...current.fields, [fieldKey]: visible }
      updated[typeName] = { ...current, fields }

      onUpdate({ exposed_block_type_config: updated })
    },
    [blockTypeConfig, onUpdate]
  )

  // Request type handlers
  const requestTypeConfig: RequestTypeConfigItem[] = useMemo(
    () => config.request_type_config ?? [],
    [config.request_type_config]
  )

  const handleAddRequestType = useCallback(
    (workflowId: string) => {
      const updated = [...requestTypeConfig, { workflow_template_id: workflowId }]
      onUpdate({ request_type_config: updated })
      setAddingRequestType(false)
    },
    [requestTypeConfig, onUpdate]
  )

  const handleRemoveRequestType = useCallback(
    (workflowId: string) => {
      const updated = requestTypeConfig.filter(
        (rt) => rt.workflow_template_id !== workflowId
      )
      onUpdate({ request_type_config: updated.length > 0 ? updated : null })
    },
    [requestTypeConfig, onUpdate]
  )

  // Workflows not yet added as request types
  const availableWorkflows = useMemo(() => {
    const usedIds = new Set(requestTypeConfig.map((rt) => rt.workflow_template_id))
    return workflowTemplates.filter((wf) => !usedIds.has(wf.id))
  }, [workflowTemplates, requestTypeConfig])

  return (
    <div className="space-y-6">
      {/* Block types with per-field visibility */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1">
          Exposed Block Types
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Toggle which types of records clients can see, and configure which
          fields are visible per type.
        </p>

        <div className="rounded-lg border border-border divide-y divide-border">
          {ALL_PORTAL_BLOCK_TYPES.map((bt) => {
            const typeEnabled = blockTypeConfig[bt.value]?.enabled ?? false
            const isExpanded = expandedTypes.has(bt.value)
            const fields = getFieldEntries(bt.value)
            const fieldConfig = blockTypeConfig[bt.value]?.fields ?? {}

            return (
              <div key={bt.value}>
                {/* Type row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Enable/disable toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={typeEnabled}
                    aria-label={`Toggle ${bt.label}`}
                    onClick={() => handleTypeToggle(bt.value, !typeEnabled)}
                    className={`
                      relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
                      border-2 border-transparent shadow-sm transition-colors
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                      ${typeEnabled ? 'bg-primary' : 'bg-input'}
                    `}
                  >
                    <span
                      className={`
                        pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform
                        ${typeEnabled ? 'translate-x-4' : 'translate-x-0'}
                      `}
                    />
                  </button>

                  {/* Type label */}
                  <span className={`text-sm flex-1 ${typeEnabled ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {bt.label}
                  </span>

                  {/* Expand chevron (only if type is enabled and has fields) */}
                  {typeEnabled && fields.length > 0 && (
                    <button
                      type="button"
                      aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${bt.label} fields`}
                      onClick={() => toggleExpanded(bt.value)}
                      className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Field checkboxes (expanded) */}
                {typeEnabled && isExpanded && fields.length > 0 && (
                  <div className="px-4 pb-3 pl-16">
                    <p className="text-xs text-muted-foreground mb-2">
                      Uncheck fields to hide them from the portal. All fields
                      are visible by default.
                    </p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {fields.map((field) => {
                        // If no explicit settings, default to visible (opt-out model)
                        const hasExplicitConfig = Object.keys(fieldConfig).length > 0
                        const isVisible = hasExplicitConfig
                          ? fieldConfig[field.key] !== false
                          : true

                        return (
                          <label
                            key={field.key}
                            className="flex items-center gap-2 rounded px-2 py-1.5 cursor-pointer hover:bg-muted/30 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              onChange={(e) =>
                                handleFieldToggle(bt.value, field.key, e.target.checked)
                              }
                              className="rounded border-input w-3.5 h-3.5"
                            />
                            <span className="text-xs text-foreground">
                              {formatFieldKey(field.key)}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Form templates */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Forms
            </h3>
            <p className="text-xs text-muted-foreground">
              Form templates available to clients when Forms is enabled.
            </p>
          </div>
        </div>

        {formTemplates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mb-1">
              No form templates yet
            </p>
            <p className="text-xs text-muted-foreground">
              Create a form template block to make it available in the portal.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border divide-y divide-border">
            {formTemplates.map((form) => (
              <div
                key={form.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {form.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {form.questionCount} question
                    {form.questionCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={
                      form.status === 'active'
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-[10px]"
                  >
                    {form.status}
                  </Badge>
                  <Link href={`/blocks/${form.id}`}>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Edit Questions
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Types (conditional on requests_enabled) */}
      {config.requests_enabled && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">
                Request Types
              </h3>
              <p className="text-xs text-muted-foreground">
                Workflow templates clients can trigger as request types.
                Without request types, clients see the default request form.
              </p>
            </div>
          </div>

          {requestTypeConfig.length === 0 && !addingRequestType ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <GitBranch className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground mb-2">
                No request types configured
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Clients will see the default category-based request form.
              </p>
              {workflowTemplates.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAddingRequestType(true)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Request Type
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* List of configured request types */}
              {requestTypeConfig.length > 0 && (
                <div className="rounded-lg border border-border divide-y divide-border mb-3">
                  {requestTypeConfig.map((rt) => {
                    const workflow = workflowTemplates.find(
                      (wf) => wf.id === rt.workflow_template_id
                    )
                    const linkedForm = rt.form_template_id
                      ? formTemplates.find((f) => f.id === rt.form_template_id)
                      : null

                    return (
                      <div
                        key={rt.workflow_template_id}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {rt.display_name || workflow?.name || 'Unknown Workflow'}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {rt.display_name && workflow?.name && (
                              <span className="text-xs text-muted-foreground">
                                Workflow: {workflow.name}
                              </span>
                            )}
                            {linkedForm && (
                              <span className="text-xs text-muted-foreground">
                                Form: {linkedForm.name}
                              </span>
                            )}
                            {!linkedForm && !rt.display_name && (
                              <span className="text-xs text-muted-foreground">
                                No intake form
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveRequestType(rt.workflow_template_id)
                          }
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          aria-label={`Remove ${rt.display_name || workflow?.name || 'request type'}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Add request type selector */}
              {addingRequestType ? (
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Select a workflow template
                  </p>
                  {availableWorkflows.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                      All workflow templates have been added.
                    </p>
                  ) : (
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {availableWorkflows.map((wf) => (
                        <button
                          key={wf.id}
                          type="button"
                          onClick={() => handleAddRequestType(wf.id)}
                          className="w-full text-left px-3 py-2 rounded hover:bg-muted/50 transition-colors"
                        >
                          <p className="text-sm text-foreground">{wf.name}</p>
                          {wf.description && (
                            <p className="text-xs text-muted-foreground truncate">
                              {wf.description}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddingRequestType(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                availableWorkflows.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingRequestType(true)}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Request Type
                  </Button>
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
