import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { 
    object_type, 
    object_id, 
    field_code, 
    value,
    source_type = 'user_input'
  } = await req.json();

  if (!object_type || !object_id || !field_code || value === undefined) {
    return Response.json({ 
      error: 'Missing required fields: object_type, object_id, field_code, value' 
    }, { status: 400 });
  }

  // Get field definition by code
  const fieldDefs = await base44.entities.FieldDefinition.filter({ code: field_code });
  if (fieldDefs.length === 0) {
    return Response.json({ error: 'Field definition not found' }, { status: 404 });
  }

  const fieldDef = fieldDefs[0];

  // Check for existing FieldValue
  const existingValues = await base44.entities.FieldValue.filter({
    object_type,
    object_id,
    field_definition_id: fieldDef.id
  });

  let fieldValue;

  if (existingValues.length > 0) {
    // Update existing
    fieldValue = await base44.asServiceRole.entities.FieldValue.update(existingValues[0].id, {
      value: { data: value },
      source_type
    });
  } else {
    // Create new
    fieldValue = await base44.asServiceRole.entities.FieldValue.create({
      object_type,
      object_id,
      field_definition_id: fieldDef.id,
      value: { data: value },
      source_type
    });
  }

  // Publish FIELD_UPDATED event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'field_updated',
    source_entity_type: 'field_value',
    source_entity_id: fieldValue.id,
    actor_type: source_type === 'ai_enriched' ? 'ai' : 'user',
    actor_id: source_type === 'ai_enriched' ? null : user.id,
    payload: {
      field_name: fieldDef.name,
      field_code,
      object_type,
      object_id,
      value
    },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ success: true, field_value: fieldValue });
});