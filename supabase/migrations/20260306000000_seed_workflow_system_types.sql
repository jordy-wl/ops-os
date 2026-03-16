-- Seed workflow-related system block types for all existing orgs
-- Idempotent: ON CONFLICT DO NOTHING
INSERT INTO block_type_definitions (org_id, type_name, display_name, description, icon, color, is_system, field_schema)
SELECT
  o.id,
  t.type_name,
  t.display_name,
  t.description,
  t.icon,
  t.color,
  true,
  t.field_schema::jsonb
FROM orgs o
CROSS JOIN (VALUES
  ('workflow_template', 'Workflow Template', 'A reusable workflow definition with triggers, steps, and conditions.', 'git-branch', 'indigo',
   '{"type":"object","properties":{"applies_to_type":{"type":"string"},"trigger":{"type":"object"},"steps":{"type":"array"},"description":{"type":"string"}},"required":["applies_to_type","trigger","steps"]}'),
  ('workflow_instance', 'Workflow Instance', 'A running instance of a workflow template.', 'play', 'cyan',
   '{"type":"object","properties":{"template_id":{"type":"string"},"source_block_id":{"type":"string"},"applies_to_type":{"type":"string"},"status":{"type":"string","enum":["pending","running","done","failed"]},"current_step_index":{"type":"number"},"step_results":{"type":"array"},"started_at":{"type":"string"},"completed_at":{"type":"string"}},"required":["template_id","source_block_id","status"]}'),
  ('task_queue_item', 'Task', 'A pending task created by a workflow step, assigned to a human or agent.', 'check-square', 'orange',
   '{"type":"object","properties":{"workflow_instance_id":{"type":"string"},"step_name":{"type":"string"},"assigned_to":{"type":"string"},"claimed_at":{"type":"string"},"completed_at":{"type":"string"},"status":{"type":"string","enum":["open","claimed","completed"]},"instructions":{"type":"string"}},"required":["workflow_instance_id","step_name","status"]}')
) AS t(type_name, display_name, description, icon, color, field_schema)
ON CONFLICT (org_id, type_name) DO NOTHING;
