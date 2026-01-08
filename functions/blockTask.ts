import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task_instance_id, blocker_reason } = await req.json();

    if (!task_instance_id || !blocker_reason) {
      return Response.json({ 
        error: 'Missing required fields: task_instance_id, blocker_reason' 
      }, { status: 400 });
    }

    // Fetch task
    const tasks = await base44.asServiceRole.entities.TaskInstance.filter({ 
      id: task_instance_id 
    });
    const task = tasks[0];

    if (!task) {
      return Response.json({ error: 'Task not found' }, { status: 404 });
    }

    // Update task to blocked
    await base44.asServiceRole.entities.TaskInstance.update(task_instance_id, {
      is_blocked: true,
      blocker_reason,
      status: 'blocked'
    });

    // Publish task_blocked event
    const blockedEvent = await base44.asServiceRole.entities.Event.create({
      event_type: 'task_blocked',
      source_entity_type: 'task_instance',
      source_entity_id: task_instance_id,
      actor_type: 'user',
      actor_id: user.id,
      payload: {
        task_name: task.name,
        blocker_reason,
        client_id: task.client_id,
        workflow_instance_id: task.workflow_instance_id
      },
      occurred_at: new Date().toISOString()
    });

    // Trigger AI Operator monitoring for immediate response
    base44.asServiceRole.functions.invoke('aiOperatorMonitor', { 
      event_id: blockedEvent.id 
    }).catch(err => console.error('AI Operator trigger failed:', err));

    return Response.json({
      success: true,
      task_instance_id,
      blocker_reason
    });

  } catch (error) {
    console.error('Block Task Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});