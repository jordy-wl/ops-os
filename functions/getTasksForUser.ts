import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status_filter, limit = 50 } = await req.json();

  // Get tasks assigned to user or their teams
  let query = { assigned_user_id: user.id };
  
  if (status_filter && status_filter !== 'all') {
    query.status = status_filter;
  }

  const tasks = await base44.entities.TaskInstance.filter(query, '-created_date', limit);

  // Enrich with client and workflow names
  const enrichedTasks = [];
  
  for (const task of tasks) {
    // Get client
    const clients = await base44.entities.Client.filter({ id: task.client_id });
    const clientName = clients[0]?.name || 'Unknown Client';

    // Get workflow
    const workflows = await base44.entities.WorkflowInstance.filter({ id: task.workflow_instance_id });
    const workflowName = workflows[0]?.name || 'Unknown Workflow';

    enrichedTasks.push({
      ...task,
      client_name: clientName,
      workflow_name: workflowName
    });
  }

  return Response.json({ 
    success: true, 
    tasks: enrichedTasks 
  });
});