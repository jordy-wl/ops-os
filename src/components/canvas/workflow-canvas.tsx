'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { TriggerNode } from './nodes/trigger-node'
import { ActionNode } from './nodes/action-node'
import { ConditionNode } from './nodes/condition-node'
import { WaitNode } from './nodes/wait-node'
import { InputNode } from './nodes/input-node'
import { OutputNode } from './nodes/output-node'
import { TaskNode } from './nodes/task-node'
import { RouteNode } from './nodes/route-node'
import { ForEachNode } from './nodes/for-each-node'
import { DataFlowEdge } from './edges/data-flow-edge'
import { Undo2, Redo2 } from 'lucide-react'
import { NodePalette, type PaletteItem } from './node-palette'
import { NodeConfigPanel } from './panels/node-config-panel'
import { useOrgEntities } from './hooks/use-org-entities'
import { useCanvasHistory } from './hooks/use-canvas-history'
import type { CanvasLayout } from '@/lib/workflow/canvas-layout'

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  wait: WaitNode,
  input: InputNode,
  output: OutputNode,
  task: TaskNode,
  route: RouteNode,
  foreach: ForEachNode,
}

const edgeTypes = {
  dataFlow: DataFlowEdge,
}

interface WorkflowCanvasProps {
  initialLayout?: CanvasLayout
  templateName: string
  onSave: (layout: CanvasLayout) => void
  saving?: boolean
}

let nodeIdCounter = 0
function getNodeId() {
  return `node-${Date.now()}-${nodeIdCounter++}`
}

export function WorkflowCanvas({ initialLayout, templateName, onSave, saving }: WorkflowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const orgEntities = useOrgEntities()

  const [nodes, setNodes, onNodesChange] = useNodesState(
    (initialLayout?.nodes ?? []) as Node[]
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    (initialLayout?.edges ?? []) as Edge[]
  )

  const { undo, redo, canUndo, canRedo, takeSnapshot } = useCanvasHistory({
    nodes,
    edges,
    setNodes,
    setEdges,
  })

  // Determine which nodes are data flow nodes (input/output)
  const dataFlowNodeIds = useMemo(() => {
    const ids = new Set<string>()
    for (const node of nodes) {
      if (node.type === 'input' || node.type === 'output') {
        ids.add(node.id)
      }
    }
    return ids
  }, [nodes])

  // Enrich edges with data flow type and styling
  const enrichedEdges = useMemo(() => {
    return edges.map((edge) => {
      const isDataFlow = dataFlowNodeIds.has(edge.source) || dataFlowNodeIds.has(edge.target)
      if (!isDataFlow) return edge

      // Find source node to get field mappings
      const sourceNode = nodes.find((n) => n.id === edge.source)
      const sourceData = sourceNode?.data as Record<string, unknown> | undefined
      const sourceConfig = (sourceData?.config ?? {}) as Record<string, unknown>
      const fieldMappings = Array.isArray(sourceConfig.field_mappings)
        ? sourceConfig.field_mappings as Array<{ from: string; to: string }>
        : []

      return {
        ...edge,
        type: 'dataFlow',
        data: {
          isDataFlow: true,
          fieldMappings,
          label: edge.label ? String(edge.label) : undefined,
        },
      }
    })
  }, [edges, dataFlowNodeIds, nodes])

  const onConnect = useCallback(
    (params: Connection) => {
      takeSnapshot()
      setEdges((eds) => addEdge({ ...params, animated: true }, eds))
    },
    [setEdges, takeSnapshot]
  )

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  const addNodeFromPalette = useCallback(
    (item: PaletteItem, position?: { x: number; y: number }) => {
      takeSnapshot()
      const id = getNodeId()
      const pos = position ?? { x: 300, y: (nodes.length + 1) * 120 }

      const defaultStepType =
        item.nodeType === 'condition'
          ? 'condition'
          : item.nodeType === 'wait'
            ? 'wait'
            : item.nodeType === 'input'
              ? 'input'
              : item.nodeType === 'output'
                ? 'output'
                : item.nodeType === 'task'
                  ? 'generate_task'
                  : item.nodeType === 'route'
                    ? 'route'
                    : item.nodeType === 'foreach'
                      ? 'for_each'
                      : item.stepType ?? 'emit_event'

      const defaultStepName = `${defaultStepType}_${Date.now()}`

      const defaultConfig =
        item.nodeType === 'trigger'
          ? { triggerType: item.label === 'Manual Start' ? 'manual' : 'event', ...(item.customActionConfig ?? {}) }
          : item.nodeType === 'input'
            ? { source_type: 'block_fields', field_mappings: [] }
            : item.nodeType === 'output'
              ? { output_type: 'update_fields', field_mappings: [] }
              : item.nodeType === 'task'
                ? { task_form_schema: { title: '', fields: [], actions: [] }, task_assign_to: 'routing_engine', task_priority: 'medium' }
                : item.nodeType === 'route'
                  ? { route_field: '', route_branches: [], route_default_label: 'Default' }
                  : item.nodeType === 'foreach'
                    ? { for_each_source: '', for_each_max_parallel: 1, for_each_max_iterations: 100 }
                    : {}

      const newNode: Node = {
        id,
        type: item.nodeType,
        position: pos,
        data: {
          label: item.label,
          stepType: defaultStepType,
          stepName: defaultStepName,
          config: defaultConfig,
        },
      }

      setNodes((nds) => [...nds, newNode])
    },
    [nodes.length, setNodes, takeSnapshot]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const data = event.dataTransfer.getData('application/ops-os-node')
      if (!data || !reactFlowInstance || !reactFlowWrapper.current) return

      const item: PaletteItem = JSON.parse(data)
      const bounds = reactFlowWrapper.current.getBoundingClientRect()
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      })

      addNodeFromPalette(item, position)
    },
    [reactFlowInstance, addNodeFromPalette]
  )

  const handleSave = useCallback(() => {
    const layout: CanvasLayout = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.type ?? 'action') as CanvasLayout['nodes'][number]['type'],
        position: n.position,
        data: n.data as CanvasLayout['nodes'][number]['data'],
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
        ...(e.label ? { label: String(e.label) } : {}),
      })),
    }
    onSave(layout)
  }, [nodes, edges, onSave])

  const onUpdateNodeData = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data } : n))
      )
    },
    [setNodes]
  )

  const selectedNodeObj = selectedNode
    ? nodes.find((n) => n.id === selectedNode) ?? null
    : null

  const handleDeleteSelected = useCallback(() => {
    if (!selectedNode) return
    takeSnapshot()
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode && e.target !== selectedNode))
    setSelectedNode(null)
  }, [selectedNode, setNodes, setEdges, takeSnapshot])

  return (
    <div className="flex h-full">
      <NodePalette onAddNode={addNodeFromPalette} />

      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b bg-background px-4 py-2">
          <h2 className="text-sm font-medium text-foreground truncate">{templateName}</h2>
          <div className="flex items-center gap-2">
            {selectedNode && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                Delete Node
              </button>
            )}
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              aria-label="Undo"
              title="Undo (Ctrl+Z)"
              className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              aria-label="Redo"
              title="Redo (Ctrl+Shift+Z)"
              className="rounded-md border border-border bg-background p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div ref={reactFlowWrapper} className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={enrichedEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            deleteKeyCode="Delete"
            className="[&_.react-flow__pane]:bg-gradient-to-br [&_.react-flow__pane]:from-muted [&_.react-flow__pane]:to-muted/70 dark:[&_.react-flow__pane]:from-zinc-900 dark:[&_.react-flow__pane]:to-zinc-950"
          >
            <Controls position="bottom-right" />
            <MiniMap
              nodeStrokeWidth={3}
              zoomable
              pannable
              className="!bg-background/80 !backdrop-blur-sm !border !border-border/50 !rounded-xl"
            />
            <Background variant={BackgroundVariant.Dots} gap={15} size={1} color="var(--border)" />
          </ReactFlow>
        </div>
      </div>

      {/* Config panel — right sidebar when node selected */}
      {selectedNodeObj && (
        <NodeConfigPanel
          node={selectedNodeObj}
          onUpdate={onUpdateNodeData}
          onClose={() => setSelectedNode(null)}
          entities={orgEntities}
        />
      )}
    </div>
  )
}
