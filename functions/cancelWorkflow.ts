import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { workflow_instance_id } = await req.json();

  if (!workflow_instance_id) {
    return Response.json({ 
      error: 'Missing required field: workflow_instance_id' 
    }, { status: 400 });
  }

  // Get the workflow instance
  const workflowInstances = await base44.entities.WorkflowInstance.filter({ 
    id: workflow_instance_id 
  });

  if (workflowInstances.length === 0) {
    return Response.json({ error: 'Workflow instance not found' }, { status: 404 });
  }

  const workflowInstance = workflowInstances[0];

  // Delete all tasks that are not started or in progress
  const tasks = await base44.entities.TaskInstance.filter({
    workflow_instance_id,
  });

  const deletedTaskIds = [];
  for (const task of tasks) {
    if (task.status === 'not_started' || task.status === 'in_progress') {
      await base44.asServiceRole.entities.TaskInstance.delete(task.id);
      deletedTaskIds.push(task.id);
    }
  }

  // Update workflow instance status to cancelled
  await base44.asServiceRole.entities.WorkflowInstance.update(workflow_instance_id, {
    status: 'cancelled',
    completed_at: new Date().toISOString()
  });

  // Update all stage instances to cancelled
  const stageInstances = await base44.entities.StageInstance.filter({
    workflow_instance_id
  });

  for (const stage of stageInstances) {
    if (stage.status !== 'completed') {
      await base44.asServiceRole.entities.StageInstance.update(stage.id, {
        status: 'skipped'
      });
    }
  }

  // Update all deliverable instances to cancelled
  const deliverableInstances = await base44.entities.DeliverableInstance.filter({
    workflow_instance_id
  });

  for (const deliverable of deliverableInstances) {
    if (deliverable.status !== 'completed') {
      await base44.asServiceRole.entities.DeliverableInstance.update(deliverable.id, {
        status: 'blocked'
      });
    }
  }

  // Publish workflow cancelled event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'workflow_instance_cancelled',
    source_entity_type: 'workflow_instance',
    source_entity_id: workflow_instance_id,
    actor_type: 'user',
    actor_id: user.id,
    payload: { 
      client_id: workflowInstance.client_id,
      tasks_deleted: deletedTaskIds.length
    },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ 
    success: true, 
    tasks_deleted: deletedTaskIds.length,
    workflow_instance_id 
  });
});