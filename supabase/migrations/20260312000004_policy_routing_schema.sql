-- Migration: Update Policy block type with routing-aware field schema
-- Sprint: P3-S4 (Routing Engine & Policy System)
-- Idempotent: uses ON CONFLICT to update if Policy type already exists

UPDATE block_type_definitions
SET field_schema = '{
  "type": "object",
  "properties": {
    "policy_type": {
      "type": "string",
      "enum": ["routing", "compliance", "operational", "security", "approval"],
      "description": "Type of policy"
    },
    "effective_date": {
      "type": "string",
      "description": "Effective from date (YYYY-MM-DD)"
    },
    "review_date": {
      "type": "string",
      "description": "Next review date (YYYY-MM-DD)"
    },
    "status": {
      "type": "string",
      "enum": ["draft", "active", "under_review", "superseded", "archived"],
      "description": "Policy status"
    },
    "approval_required": {
      "type": "boolean",
      "description": "Whether actions under this policy require approval"
    },
    "jurisdiction": {
      "type": "string",
      "enum": ["AU", "US", "GB", "SG", "HK", "NZ", "JP", "DE", "FR", "CA", "global"],
      "description": "Applicable jurisdiction (ISO 3166-1 alpha-2 or global)"
    },
    "routing_mode": {
      "type": "string",
      "enum": ["human_only", "ai_only", "hybrid", "escalation_chain"],
      "description": "Default routing mode for this policy"
    },
    "confidence_threshold": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "description": "Minimum AI confidence score (0.0-1.0) to auto-approve"
    },
    "risk_routing_map": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "mode": { "type": "string", "enum": ["human_only", "ai_only", "hybrid", "escalation_chain"] },
          "threshold": { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "required": ["mode", "threshold"]
      },
      "description": "Maps risk level names to routing decisions"
    },
    "approval_chain": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "role": { "type": "string" },
          "order": { "type": "number" },
          "required": { "type": "boolean" }
        },
        "required": ["role", "order", "required"]
      },
      "description": "Ordered list of approvers for escalation_chain routing"
    },
    "fallback_routing": {
      "type": "string",
      "enum": ["human_only"],
      "description": "Fallback routing mode when no policy rule matches"
    },
    "max_ai_attempts": {
      "type": "number",
      "minimum": 1,
      "maximum": 10,
      "description": "Maximum AI retry attempts before escalating to human"
    }
  }
}'::jsonb,
    updated_at = now()
WHERE type_name = 'policy';
