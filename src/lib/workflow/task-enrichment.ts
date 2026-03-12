/**
 * Task Enrichment — populates routing and context fields on task_queue_items
 * when they are created by the workflow engine.
 */

import type { RoutingDecision } from '@/lib/routing/types'

interface TaskEnrichmentInput {
  routingDecision?: RoutingDecision
  inputData?: Record<string, unknown>
  expectedOutputSchema?: Record<string, unknown>
  instructions?: string
}

interface EnrichedTaskMetadata {
  routing_decision?: string
  routing_reason?: string
  confidence_score?: number
  input_data?: Record<string, unknown>
  expected_output_schema?: Record<string, unknown>
  instructions?: string
}

/**
 * Build enrichment fields for a task_queue_item's metadata.
 * Called by the workflow engine when creating a new task.
 */
export function buildTaskEnrichment(input: TaskEnrichmentInput): EnrichedTaskMetadata {
  const result: EnrichedTaskMetadata = {}

  if (input.routingDecision) {
    result.routing_decision = input.routingDecision.route
    result.routing_reason = input.routingDecision.reason
    result.confidence_score = input.routingDecision.confidence
  }

  if (input.inputData) {
    result.input_data = input.inputData
  }

  if (input.expectedOutputSchema) {
    result.expected_output_schema = input.expectedOutputSchema
  }

  if (input.instructions) {
    result.instructions = input.instructions
  }

  return result
}
