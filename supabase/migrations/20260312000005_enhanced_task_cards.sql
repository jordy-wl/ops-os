-- Migration: Update task_queue_item block type with enhanced routing fields
-- Sprint: P3-S4 (Routing Engine & Policy System)
-- Enriches the task card schema with AI recommendation, routing decision,
-- confidence scoring, input/output, and human decision fields.

UPDATE block_type_definitions
SET field_schema = '{
  "type": "object",
  "properties": {
    "workflow_instance_id": { "type": "string", "description": "ID of the parent workflow instance" },
    "step_name": { "type": "string", "description": "Name of the workflow step that created this task" },
    "assigned_to": { "type": "string", "description": "User ID of the assignee" },
    "claimed_at": { "type": "string", "description": "When the task was claimed" },
    "completed_at": { "type": "string", "description": "When the task was completed" },
    "status": {
      "type": "string",
      "enum": ["open", "claimed", "completed"],
      "description": "Task status"
    },
    "instructions": { "type": "string", "description": "Instructions for the task assignee" },
    "ai_recommendation": { "type": "object", "description": "AI-suggested action/output for this task" },
    "confidence_score": { "type": "number", "minimum": 0, "maximum": 1, "description": "AI confidence in its recommendation (0.0-1.0)" },
    "routing_decision": { "type": "string", "enum": ["human", "agent", "approval_chain"], "description": "How this task was routed" },
    "routing_reason": { "type": "string", "description": "Human-readable explanation of the routing decision" },
    "input_data": { "type": "object", "description": "Structured input context (block data, previous step output)" },
    "expected_output_schema": { "type": "object", "description": "JSON schema describing expected output" },
    "actual_output": { "type": "object", "description": "Actual output produced by the handler" },
    "completed_by": { "type": "string", "description": "Clerk user ID or agent identifier" },
    "decision": { "type": "string", "enum": ["approved", "rejected", "modified"], "description": "Human decision on AI recommendation" }
  },
  "required": ["workflow_instance_id", "step_name", "status"]
}'::jsonb,
    updated_at = now()
WHERE type_name = 'task_queue_item';
