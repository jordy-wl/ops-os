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

  const workflows = await base44.entities.WorkflowInstance.filter({ id: workflow_instance_id });
  if (workflows.length === 0) {
    return Response.json({ error: 'Workflow not found' }, { status: 404 });
  }

  const workflow = workflows[0];

  const stages = await base44.entities.StageInstance.filter({ workflow_instance_id }, 'sequence_order');
  const tasks = await base44.entities.TaskInstance.filter({ workflow_instance_id });
  const deliverables = await base44.entities.DeliverableInstance.filter({ workflow_instance_id });

  const tasksByStatus = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] || 0) + 1;
    return acc;
  }, {});

  return Response.json({
    success: true,
    workflow,
    stages,
    tasks_summary: tasksByStatus,
    total_tasks: tasks.length,
    total_deliverables: deliverables.length
  });
});