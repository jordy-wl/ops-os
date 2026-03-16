'use client'

import { memo, useState } from 'react'
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

interface DataFlowEdgeData {
  isDataFlow?: boolean
  fieldMappings?: Array<{ from: string; to: string }>
  label?: string
}

function DataFlowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps & { data?: DataFlowEdgeData }) {
  const [hovered, setHovered] = useState(false)

  const isDataFlow = data?.isDataFlow ?? false
  const mappings = data?.fieldMappings ?? []
  const edgeLabel = data?.label

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const strokeColor = isDataFlow
    ? 'hsl(217, 91%, 60%)' // blue-500
    : 'var(--border)'

  const strokeWidth = isDataFlow ? 2.5 : 1.5

  return (
    <>
      {/* Invisible wider path for easier hover targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? 'hsl(217, 91%, 60%)' : strokeColor,
          strokeWidth: selected ? 3 : strokeWidth,
          strokeDasharray: isDataFlow ? '6 3' : undefined,
          transition: 'stroke 0.2s, stroke-width 0.2s',
        }}
      />

      {/* Edge label badge */}
      {(edgeLabel || isDataFlow) && (
        <foreignObject
          x={labelX - 30}
          y={labelY - 10}
          width={60}
          height={20}
          className="pointer-events-none overflow-visible"
        >
          <div className="flex items-center justify-center">
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-medium ${
                isDataFlow
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {edgeLabel ?? 'data'}
            </span>
          </div>
        </foreignObject>
      )}

      {/* Hover tooltip showing field mappings */}
      {hovered && mappings.length > 0 && (
        <foreignObject
          x={labelX - 80}
          y={labelY + 12}
          width={160}
          height={mappings.length * 22 + 28}
          className="overflow-visible"
        >
          <div
            className="rounded-md border bg-popover text-popover-foreground shadow-md p-2"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Field Mappings</p>
            {mappings.map((m, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px]">
                <span className="text-blue-600 dark:text-blue-400 font-mono">{m.from}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-green-600 dark:text-green-400 font-mono">{m.to}</span>
              </div>
            ))}
          </div>
        </foreignObject>
      )}
    </>
  )
}

export const DataFlowEdge = memo(DataFlowEdgeComponent)
