import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { client_id, workflow_template_id } = await req.json();

  if (!client_id || !workflow_template_id) {
    return Response.json({ 
      error: 'Missing required fields: client_id, workflow_template_id' 
    }, { status: 400 });
  }

  // Get the template and its current version
  const template = await base44.entities.WorkflowTemplate.filter({ id: workflow_template_id });
  if (template.length === 0) {
    return Response.json({ error: 'Workflow template not found' }, { status: 404 });
  }

  // Get the latest version (regardless of status)
  const versions = await base44.entities.WorkflowTemplateVersion.filter({ 
    workflow_template_id,
  }, '-version_number', 1);

  const currentVersion = versions[0];
  if (!currentVersion) {
    return Response.json({ error: 'No workflow version found for the template' }, { status: 404 });
  }

  // Create WorkflowInstance
  const workflowInstance = await base44.asServiceRole.entities.WorkflowInstance.create({
    workflow_template_id,
    workflow_template_version_id: currentVersion.id,
    client_id,
    name: `${template[0].name} - ${new Date().toLocaleDateString()}`,
    status: 'not_started',
    started_at: new Date().toISOString(),
    progress_percentage: 0,
    owner_type: template[0].owner_type || 'user',
    owner_id: template[0].owner_id || user.id,
    metadata: { instance_map: { stages: {}, deliverables: {}, tasks: {} } }
  });

  // Get all stages for this version
  const stageTemplates = await base44.entities.StageTemplate.filter({
    workflow_template_version_id: currentVersion.id
  }, 'sequence_order');

  // Build instance map as we create instances
  const instance_map = { stages: {}, deliverables: {}, tasks: {} };

  // Create StageInstances
  const stageInstances = [];
  for (const stageTemplate of stageTemplates) {
    const stageInstance = await base44.asServiceRole.entities.StageInstance.create({
      workflow_instance_id: workflowInstance.id,
      stage_template_id: stageTemplate.id,
      name: stageTemplate.name,
      sequence_order: stageTemplate.sequence_order,
      status: stageTemplate.sequence_order === 1 ? 'in_progress' : 'not_started',
      owner_type: stageTemplate.owner_type,
      owner_id: stageTemplate.owner_id,
      started_at: stageTemplate.sequence_order === 1 ? new Date().toISOString() : null
    });
    stageInstances.push(stageInstance);

    // Store stage mapping
    const stageKey = `stage_${stageTemplate.sequence_order}`;
    instance_map.stages[stageKey] = stageInstance.id;

    // Get deliverables for this stage
    const deliverableTemplates = await base44.entities.DeliverableTemplate.filter({
      stage_template_id: stageTemplate.id
    }, 'sequence_order');

    // Create ALL DeliverableInstances (not just first stage)
    for (const deliverableTemplate of deliverableTemplates) {
      const deliverableInstance = await base44.asServiceRole.entities.DeliverableInstance.create({
        stage_instance_id: stageInstance.id,
        deliverable_template_id: deliverableTemplate.id,
        workflow_instance_id: workflowInstance.id,
        name: deliverableTemplate.name,
        sequence_order: deliverableTemplate.sequence_order,
        status: stageTemplate.sequence_order === 1 && deliverableTemplate.sequence_order === 1 ? 'in_progress' : 'not_started',
        owner_type: deliverableTemplate.owner_type,
        owner_id: deliverableTemplate.owner_id,
        fields: {}
      });

      // Store deliverable mapping
      const deliverableKey = `stage_${stageTemplate.sequence_order}_deliverable_${deliverableTemplate.sequence_order}`;
      instance_map.deliverables[deliverableKey] = deliverableInstance.id;

      // Get tasks for this deliverable
      const taskTemplates = await base44.entities.TaskTemplate.filter({
        deliverable_template_id: deliverableTemplate.id
      }, 'sequence_order');

      // Create ALL TaskInstances (not just first deliverable)
      for (const taskTemplate of taskTemplates) {
        const taskInstance = await base44.asServiceRole.entities.TaskInstance.create({
          deliverable_instance_id: deliverableInstance.id,
          task_template_id: taskTemplate.id,
          workflow_instance_id: workflowInstance.id,
          client_id,
          name: taskTemplate.name,
          description: taskTemplate.description,
          instructions: taskTemplate.instructions,
          sequence_order: taskTemplate.sequence_order,
          status: stageTemplate.sequence_order === 1 && deliverableTemplate.sequence_order === 1 ? 'not_started' : 'not_started',
          priority: taskTemplate.priority || 'normal',
          assigned_user_id: taskTemplate.owner_type === 'user' ? taskTemplate.owner_id : user.id,
          owner_type: taskTemplate.owner_type,
          owner_id: taskTemplate.owner_id,
          is_ad_hoc: false,
          field_values: {}
        });

        // Store task mapping
        const taskKey = `stage_${stageTemplate.sequence_order}_deliverable_${deliverableTemplate.sequence_order}_task_${taskTemplate.sequence_order}`;
        instance_map.tasks[taskKey] = taskInstance.id;
      }
    }
  }

  // Update workflow instance with complete instance map
  await base44.asServiceRole.entities.WorkflowInstance.update(workflowInstance.id, {
    status: 'in_progress',
    current_stage_id: stageInstances[0]?.id,
    metadata: { instance_map }
  });

  // Publish WORKFLOW_INSTANCE_STARTED event
  const workflowStartedEvent = await base44.asServiceRole.entities.Event.create({
    event_type: 'workflow_instance_started',
    source_entity_type: 'workflow_instance',
    source_entity_id: workflowInstance.id,
    actor_type: 'user',
    actor_id: user.id,
    payload: { 
      client_id, 
      workflow_template_id,
      template_name: template[0].name 
    },
    occurred_at: new Date().toISOString()
  });

  // Trigger AI Operator monitoring (async, non-blocking)
  base44.asServiceRole.functions.invoke('aiOperatorMonitor', { 
    event_id: workflowStartedEvent.id 
  }).catch(err => console.error('AI Operator trigger failed:', err));

  // Publish TASK_RELEASED event (single event for all released tasks)
  const releasedTasks = await base44.entities.TaskInstance.filter({
    workflow_instance_id: workflowInstance.id,
    status: 'not_started'
  });

  if (releasedTasks.length > 0) {
    const taskReleasedEvent = await base44.asServiceRole.entities.Event.create({
      event_type: 'task_released',
      source_entity_type: 'task_instance',
      source_entity_id: releasedTasks[0].id,
      actor_type: 'system',
      payload: { 
        workflow_instance_id: workflowInstance.id,
        client_id,
        task_count: releasedTasks.length
      },
      occurred_at: new Date().toISOString()
    });

    // Trigger AI Operator monitoring
    base44.asServiceRole.functions.invoke('aiOperatorMonitor', { 
      event_id: taskReleasedEvent.id 
    }).catch(err => console.error('AI Operator trigger failed:', err));
  }

  return Response.json({ 
    success: true, 
    workflow_instance: workflowInstance,
    stages_created: stageInstances.length
  });
});