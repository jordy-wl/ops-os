import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { workflow_instance_id, client_id, name, description, assigned_user_id, priority = 'normal' } = await req.json();

  if (!name) {
    return Response.json({ error: 'Missing task name' }, { status: 400 });
  }

  const task = await base44.asServiceRole.entities.TaskInstance.create({
    workflow_instance_id,
    client_id,
    name,
    description,
    status: 'not_started',
    priority,
    assigned_user_id: assigned_user_id || user.id,
    is_ad_hoc: true,
    sequence_order: 999
  });

  await base44.asServiceRole.entities.Event.create({
    event_type: 'task_released',
    source_entity_type: 'task_instance',
    source_entity_id: task.id,
    actor_type: 'user',
    actor_id: user.id,
    payload: { is_ad_hoc: true },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ success: true, task });
});