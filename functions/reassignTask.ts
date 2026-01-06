import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task_instance_id, new_user_id } = await req.json();

  if (!task_instance_id || !new_user_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const task = await base44.asServiceRole.entities.TaskInstance.update(task_instance_id, {
    assigned_user_id: new_user_id
  });

  await base44.asServiceRole.entities.Event.create({
    event_type: 'task_reassigned',
    source_entity_type: 'task_instance',
    source_entity_id: task_instance_id,
    actor_type: 'user',
    actor_id: user.id,
    payload: { new_user_id },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ success: true, task });
});