import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { 
    event_type, 
    source_entity_type, 
    source_entity_id, 
    actor_type = 'user',
    payload = {} 
  } = await req.json();

  if (!event_type || !source_entity_type || !source_entity_id) {
    return Response.json({ 
      error: 'Missing required fields: event_type, source_entity_type, source_entity_id' 
    }, { status: 400 });
  }

  const event = await base44.asServiceRole.entities.Event.create({
    event_type,
    source_entity_type,
    source_entity_id,
    actor_type,
    actor_id: actor_type === 'user' ? user.id : null,
    payload,
    occurred_at: new Date().toISOString()
  });

  return Response.json({ success: true, event });
});