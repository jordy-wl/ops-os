import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { task_instance_id, new_status, blocker_reason } = await req.json();

  if (!task_instance_id || !new_status) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const updateData = { status: new_status };
  
  if (new_status === 'blocked' && blocker_reason) {
    updateData.is_blocked = true;
    updateData.blocker_reason = blocker_reason;
  }

  if (new_status === 'in_progress' && !updateData.started_at) {
    updateData.started_at = new Date().toISOString();
  }

  const task = await base44.asServiceRole.entities.TaskInstance.update(task_instance_id, updateData);

  await base44.asServiceRole.entities.Event.create({
    event_type: new_status === 'blocked' ? 'deliverable_blocked' : 'task_started',
    source_entity_type: 'task_instance',
    source_entity_id: task_instance_id,
    actor_type: 'user',
    actor_id: user.id,
    payload: { new_status, blocker_reason },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ success: true, task });
});