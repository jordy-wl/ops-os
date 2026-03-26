-- Backfill x-relation-edge-type on all system block type relation fields.
-- This enables edge-sync to auto-create/delete block_edges when relation
-- field values change. Without this annotation, syncRelationEdges() is a no-op.

-- solution.product_refs → includes_product
UPDATE block_type_definitions
SET field_schema = jsonb_set(field_schema, '{properties,product_refs,x-relation-edge-type}', '"includes_product"')
WHERE type_name = 'solution' AND is_system = true
  AND field_schema->'properties'->'product_refs' IS NOT NULL
  AND field_schema->'properties'->'product_refs'->>'x-relation-edge-type' IS NULL;

-- solution.service_refs → includes_service
UPDATE block_type_definitions
SET field_schema = jsonb_set(field_schema, '{properties,service_refs,x-relation-edge-type}', '"includes_service"')
WHERE type_name = 'solution' AND is_system = true
  AND field_schema->'properties'->'service_refs' IS NOT NULL
  AND field_schema->'properties'->'service_refs'->>'x-relation-edge-type' IS NULL;

-- team_member.reporting_to → reports_to
UPDATE block_type_definitions
SET field_schema = jsonb_set(field_schema, '{properties,reporting_to,x-relation-edge-type}', '"reports_to"')
WHERE type_name = 'team_member' AND is_system = true
  AND field_schema->'properties'->'reporting_to' IS NOT NULL
  AND field_schema->'properties'->'reporting_to'->>'x-relation-edge-type' IS NULL;

-- swot_analysis.context_block_id → analyses
UPDATE block_type_definitions
SET field_schema = jsonb_set(field_schema, '{properties,context_block_id,x-relation-edge-type}', '"analyses"')
WHERE type_name = 'swot_analysis' AND is_system = true
  AND field_schema->'properties'->'context_block_id' IS NOT NULL
  AND field_schema->'properties'->'context_block_id'->>'x-relation-edge-type' IS NULL;

-- form_template.client_block_id → assigned_to
UPDATE block_type_definitions
SET field_schema = jsonb_set(field_schema, '{properties,client_block_id,x-relation-edge-type}', '"assigned_to"')
WHERE type_name = 'form_template' AND is_system = true
  AND field_schema->'properties'->'client_block_id' IS NOT NULL
  AND field_schema->'properties'->'client_block_id'->>'x-relation-edge-type' IS NULL;

-- workflow_instance.template_id → instance_of
UPDATE block_type_definitions
SET field_schema = jsonb_set(field_schema, '{properties,template_id,x-relation-edge-type}', '"instance_of"')
WHERE type_name = 'workflow_instance' AND is_system = true
  AND field_schema->'properties'->'template_id' IS NOT NULL
  AND field_schema->'properties'->'template_id'->>'x-relation-edge-type' IS NULL;

-- workflow_instance.source_block_id → triggered_by
UPDATE block_type_definitions
SET field_schema = jsonb_set(field_schema, '{properties,source_block_id,x-relation-edge-type}', '"triggered_by"')
WHERE type_name = 'workflow_instance' AND is_system = true
  AND field_schema->'properties'->'source_block_id' IS NOT NULL
  AND field_schema->'properties'->'source_block_id'->>'x-relation-edge-type' IS NULL;

-- task_queue_item.workflow_instance_id → belongs_to
UPDATE block_type_definitions
SET field_schema = jsonb_set(field_schema, '{properties,workflow_instance_id,x-relation-edge-type}', '"belongs_to"')
WHERE type_name = 'task_queue_item' AND is_system = true
  AND field_schema->'properties'->'workflow_instance_id' IS NOT NULL
  AND field_schema->'properties'->'workflow_instance_id'->>'x-relation-edge-type' IS NULL;
