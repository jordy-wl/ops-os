import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { workflow_instance_id } = await req.json();

    if (!workflow_instance_id) {
      return Response.json({ error: 'Missing workflow_instance_id' }, { status: 400 });
    }

    // Fetch the workflow instance
    const instances = await base44.asServiceRole.entities.WorkflowInstance.filter({ 
      id: workflow_instance_id 
    });
    const instance = instances[0];

    if (!instance) {
      return Response.json({ error: 'Workflow instance not found' }, { status: 404 });
    }

    if (instance.status === 'completed') {
      return Response.json({ error: 'Workflow already completed' }, { status: 400 });
    }

    // Update workflow instance status
    await base44.asServiceRole.entities.WorkflowInstance.update(workflow_instance_id, {
      status: 'completed',
      completed_at: new Date().toISOString(),
      progress_percentage: 100
    });

    // Publish workflow_instance_completed event
    const completedEvent = await base44.asServiceRole.entities.Event.create({
      event_type: 'workflow_instance_completed',
      source_entity_type: 'workflow_instance',
      source_entity_id: workflow_instance_id,
      actor_type: 'user',
      actor_id: user.id,
      payload: {
        client_id: instance.client_id,
        workflow_name: instance.name
      },
      occurred_at: new Date().toISOString()
    });

    // Trigger AI Operator monitoring
    base44.asServiceRole.functions.invoke('aiOperatorMonitor', { 
      event_id: completedEvent.id 
    }).catch(err => console.error('AI Operator trigger failed:', err));

    // Check if there's a next workflow to start
    const templates = await base44.asServiceRole.entities.WorkflowTemplate.filter({ 
      id: instance.workflow_template_id 
    });
    const template = templates[0];

    let nextWorkflowInstance = null;
    if (template?.next_workflow_template_id) {
      // Automatically start the next workflow
      const startResponse = await base44.asServiceRole.functions.invoke('startWorkflow', {
        client_id: instance.client_id,
        workflow_template_id: template.next_workflow_template_id
      });
      
      nextWorkflowInstance = startResponse.data?.workflowInstance;
    }

    return Response.json({
      success: true,
      workflow_instance: instance,
      next_workflow_started: !!nextWorkflowInstance,
      next_workflow_instance: nextWorkflowInstance
    });

  } catch (error) {
    console.error('Complete Workflow Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});