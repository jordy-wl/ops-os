import type { Node } from '@xyflow/react'
import type { OrgEntities } from '../hooks/use-org-entities'

export interface NodeConfigProps {
  node: Node
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
  entities?: OrgEntities
}

/** Extract typed data from a node */
export function getNodeData(node: Node) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>
  return { data, config }
}

/** Helper to create an updateConfig function */
export function makeConfigUpdater(
  node: Node,
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
) {
  const data = node.data as Record<string, unknown>
  const config = (data.config ?? {}) as Record<string, unknown>

  return {
    data,
    config,
    updateData(field: string, value: unknown) {
      onUpdate(node.id, { ...data, [field]: value })
    },
    updateConfig(field: string, value: unknown) {
      onUpdate(node.id, { ...data, config: { ...config, [field]: value } })
    },
  }
}
