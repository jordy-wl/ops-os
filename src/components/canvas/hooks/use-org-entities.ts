'use client'

import { useState, useEffect } from 'react'

export interface OrgBlock {
  id: string
  name: string
  type: string
}

export interface OrgConnector {
  id: string
  provider: string
  status: string
  label: string
}

export interface OrgFieldDef {
  block_type: string
  fields: { key: string; label: string; type: string }[]
}

export interface OrgWorkflowTemplate {
  id: string
  name: string
  appliesToType: string | null
  steps: { name: string; type: string }[]
}

export interface OrgEntities {
  blocks: OrgBlock[]
  connectors: OrgConnector[]
  blockTypes: string[]
  fieldDefs: OrgFieldDef[]
  workflowTemplates: OrgWorkflowTemplate[]
  loading: boolean
}

/**
 * Fetches org-level entities (blocks, connectors, block types, field definitions)
 * for use in entity-aware node configuration dropdowns.
 */
export function useOrgEntities(): OrgEntities {
  const [blocks, setBlocks] = useState<OrgBlock[]>([])
  const [connectors, setConnectors] = useState<OrgConnector[]>([])
  const [blockTypes, setBlockTypes] = useState<string[]>([])
  const [fieldDefs, setFieldDefs] = useState<OrgFieldDef[]>([])
  const [workflowTemplates, setWorkflowTemplates] = useState<OrgWorkflowTemplate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const [blocksRes, connectorsRes, typesRes, wfTemplatesRes] = await Promise.all([
          fetch('/api/blocks?limit=200&fields=id,name,type').then((r) => r.ok ? r.json() : null),
          fetch('/api/integrations/connectors').then((r) => r.ok ? r.json() : null),
          fetch('/api/blocks/types').then((r) => r.ok ? r.json() : null),
          fetch('/api/blocks?limit=100&fields=id,name,type,metadata&type=workflow_template').then((r) => r.ok ? r.json() : null),
        ])

        if (cancelled) return

        // Blocks
        const rawBlocks = blocksRes?.data?.blocks ?? blocksRes?.data ?? []
        setBlocks(
          rawBlocks
            .filter((b: Record<string, unknown>) => b.type !== 'workflow_instance' && b.type !== 'task_queue_item')
            .map((b: Record<string, unknown>) => ({ id: b.id as string, name: b.name as string, type: b.type as string }))
        )

        // Connectors
        const rawConnectors = connectorsRes?.data ?? []
        setConnectors(
          rawConnectors.map((c: Record<string, unknown>) => ({
            id: c.id as string,
            provider: c.provider as string,
            status: c.status as string,
            label: `${c.provider} (${c.status})`,
          }))
        )

        // Block types
        const rawTypes = typesRes?.data ?? []
        const typeNames = rawTypes.map((t: Record<string, unknown>) => t.name as string).filter(Boolean)
        setBlockTypes(typeNames.length > 0 ? typeNames : [...new Set(rawBlocks.map((b: Record<string, unknown>) => b.type as string))])

        // Field definitions from block_type_definitions
        const fieldDefsArr: OrgFieldDef[] = []
        for (const t of rawTypes) {
          const schema = (t as Record<string, unknown>).field_schema as Record<string, unknown> | undefined
          if (schema?.properties) {
            const props = schema.properties as Record<string, Record<string, unknown>>
            fieldDefsArr.push({
              block_type: (t as Record<string, unknown>).name as string,
              fields: Object.entries(props).map(([key, val]) => ({
                key,
                label: (val.title as string) ?? key,
                type: (val.type as string) ?? 'string',
              })),
            })
          }
        }
        setFieldDefs(fieldDefsArr)

        // Workflow templates (blocks with type='workflow_template')
        const rawWfTemplates = wfTemplatesRes?.data?.blocks ?? wfTemplatesRes?.data ?? []
        setWorkflowTemplates(
          rawWfTemplates.map((b: Record<string, unknown>) => {
            const meta = (b.metadata ?? {}) as Record<string, unknown>
            const rawSteps = (meta.steps ?? []) as Record<string, unknown>[]
            return {
              id: b.id as string,
              name: (b.name as string) ?? 'Unnamed template',
              appliesToType: (meta.applies_to_type as string) ?? null,
              steps: rawSteps.map((s) => ({
                name: (s.name as string) ?? (s.stepName as string) ?? 'Unnamed step',
                type: (s.type as string) ?? (s.stepType as string) ?? 'action',
              })),
            }
          })
        )
      } catch {
        // Graceful degradation — dropdowns will be empty, free-text still works
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { blocks, connectors, blockTypes, fieldDefs, workflowTemplates, loading }
}
