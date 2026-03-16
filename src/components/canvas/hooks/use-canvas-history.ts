'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Node, Edge } from '@xyflow/react'

const MAX_HISTORY_SIZE = 50

interface HistoryState {
  nodes: Node[]
  edges: Edge[]
}

interface UseCanvasHistoryParams {
  nodes: Node[]
  edges: Edge[]
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
}

interface UseCanvasHistoryReturn {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  takeSnapshot: () => void
}

/**
 * Tracks undo/redo history for the workflow canvas.
 *
 * Call `takeSnapshot()` before any operation that mutates nodes or edges.
 * The hook registers Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z (redo) keyboard
 * shortcuts automatically.
 *
 * History is capped at MAX_HISTORY_SIZE (50) entries to limit memory usage.
 */
export function useCanvasHistory({
  nodes,
  edges,
  setNodes,
  setEdges,
}: UseCanvasHistoryParams): UseCanvasHistoryReturn {
  // Past states (for undo). The top of the stack is the most recent snapshot
  // taken *before* the last mutation.
  const pastRef = useRef<HistoryState[]>([])

  // Future states (for redo). Populated when the user undoes an action.
  const futureRef = useRef<HistoryState[]>([])

  /**
   * Capture the current canvas state and push it onto the undo stack.
   * This should be called *before* any mutation takes place so the
   * pre-mutation state can be restored on undo.
   *
   * Taking a new snapshot clears the redo stack because the timeline has
   * diverged.
   */
  const takeSnapshot = useCallback(() => {
    const snapshot: HistoryState = {
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
    }

    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY_SIZE - 1)), snapshot]
    futureRef.current = []
  }, [nodes, edges])

  /**
   * Restore the most recent snapshot from the undo stack.
   * The current state is pushed onto the redo stack so the user can redo.
   */
  const undo = useCallback(() => {
    const past = pastRef.current
    if (past.length === 0) return

    const previous = past[past.length - 1]
    pastRef.current = past.slice(0, -1)

    // Save current state to redo stack
    futureRef.current = [
      ...futureRef.current,
      { nodes: structuredClone(nodes), edges: structuredClone(edges) },
    ]

    setNodes(previous.nodes)
    setEdges(previous.edges)
  }, [nodes, edges, setNodes, setEdges])

  /**
   * Re-apply a previously undone state from the redo stack.
   * The current state is pushed back onto the undo stack.
   */
  const redo = useCallback(() => {
    const future = futureRef.current
    if (future.length === 0) return

    const next = future[future.length - 1]
    futureRef.current = future.slice(0, -1)

    // Save current state to undo stack
    pastRef.current = [
      ...pastRef.current,
      { nodes: structuredClone(nodes), edges: structuredClone(edges) },
    ]

    setNodes(next.nodes)
    setEdges(next.edges)
  }, [nodes, edges, setNodes, setEdges])

  const canUndo = pastRef.current.length > 0
  const canRedo = futureRef.current.length > 0

  // Register keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isModifier = event.metaKey || event.ctrlKey

      if (!isModifier || event.key.toLowerCase() !== 'z') return

      event.preventDefault()

      if (event.shiftKey) {
        redo()
      } else {
        undo()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  return { undo, redo, canUndo, canRedo, takeSnapshot }
}
