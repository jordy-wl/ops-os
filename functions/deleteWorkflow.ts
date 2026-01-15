import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { workflow_instance_id } = await req.json();

  if (!workflow_instance_id) {
    return Response.json({ error: 'Missing workflow_instance_id' }, { status: 400 });
  }

  // Get the workflow instance
  const workflows = await base44.entities.WorkflowInstance.filter({ id: workflow_instance_id });
  if (workflows.length === 0) {
    return Response.json({ error: 'Workflow not found' }, { status: 404 });
  }

  // Delete all related records
  // 1. Delete all TaskInstances
  const tasks = await base44.entities.TaskInstance.filter({
    workflow_instance_id
  });
  for (const task of tasks) {
    await base44.asServiceRole.entities.TaskInstance.delete(task.id);
  }

  // 2. Delete all DeliverableInstances
  const deliverables = await base44.entities.DeliverableInstance.filter({
    workflow_instance_id
  });
  for (const deliverable of deliverables) {
    await base44.asServiceRole.entities.DeliverableInstance.delete(deliverable.id);
  }

  // 3. Delete all StageInstances
  const stages = await base44.entities.StageInstance.filter({
    workflow_instance_id
  });
  for (const stage of stages) {
    await base44.asServiceRole.entities.StageInstance.delete(stage.id);
  }

  // 4. Delete all Events related to this workflow
  const events = await base44.entities.Event.filter({
    payload: { workflow_instance_id }
  });
  for (const event of events) {
    await base44.asServiceRole.entities.Event.delete(event.id);
  }

  // 5. Delete the WorkflowInstance itself
  await base44.asServiceRole.entities.WorkflowInstance.delete(workflow_instance_id);

  return Response.json({ 
    success: true,
    message: 'Workflow and all related records deleted successfully'
  });
});