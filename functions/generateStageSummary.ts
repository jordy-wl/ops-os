import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { stage_instance_id } = await req.json();

    if (!stage_instance_id) {
      return Response.json({ 
        error: 'Missing required field: stage_instance_id' 
      }, { status: 400 });
    }

    console.log(`Generating summary for stage instance: ${stage_instance_id}`);

    // Fetch the stage instance
    const stageInstances = await base44.asServiceRole.entities.StageInstance.filter({ 
      id: stage_instance_id 
    });
    const stageInstance = stageInstances[0];

    if (!stageInstance) {
      return Response.json({ error: 'Stage instance not found' }, { status: 404 });
    }

    if (stageInstance.status !== 'completed') {
      return Response.json({ 
        error: 'Stage must be completed before generating summary' 
      }, { status: 400 });
    }

    // Get workflow instance to find client
    const workflowInstances = await base44.asServiceRole.entities.WorkflowInstance.filter({ 
      id: stageInstance.workflow_instance_id 
    });
    const workflowInstance = workflowInstances[0];

    if (!workflowInstance) {
      return Response.json({ error: 'Workflow instance not found' }, { status: 404 });
    }

    // Get client
    const clients = await base44.asServiceRole.entities.Client.filter({ 
      id: workflowInstance.client_id 
    });
    const client = clients[0];

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Get all tasks for this stage
    const deliverableInstances = await base44.asServiceRole.entities.DeliverableInstance.filter({ 
      stage_instance_id: stage_instance_id 
    });

    const taskInstances = [];
    for (const deliverable of deliverableInstances) {
      const tasks = await base44.asServiceRole.entities.TaskInstance.filter({ 
        deliverable_instance_id: deliverable.id 
      });
      taskInstances.push(...tasks);
    }

    console.log(`Found ${taskInstances.length} tasks for stage ${stageInstance.name}`);

    // Get field values collected during this stage
    const fieldValues = await base44.asServiceRole.entities.FieldValue.filter({ 
      object_type: 'client',
      object_id: client.id
    });

    // Prepare context for LLM
    const taskSummaries = taskInstances.map(task => ({
      name: task.name,
      status: task.status,
      completed_at: task.completed_at,
      field_values: task.field_values || {}
    }));

    const summaryPrompt = `You are generating a concise historical summary of a completed workflow stage for long-term memory.

**Context:**
- Client: ${client.name}
- Workflow: ${workflowInstance.name}
- Stage: ${stageInstance.name}
- Stage Status: ${stageInstance.status}
- Completed At: ${stageInstance.completed_at}

**Tasks Completed (${taskInstances.length} total):**
${taskSummaries.map(t => `- ${t.name} (${t.status})`).join('\n')}

**Key Field Values Collected:**
${JSON.stringify(taskInstances.map(t => t.field_values).filter(fv => fv && Object.keys(fv).length > 0), null, 2)}

**Instructions:**
Generate a 2-3 sentence summary capturing:
1. What was accomplished in this stage
2. Any notable challenges, delays, or key decisions
3. Important data points or insights for future reference

Keep it factual and concise. This summary will be used by AI agents in the future to understand the client's history without reading raw logs.`;

    const summaryText = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: summaryPrompt
    });

    console.log('Generated summary:', summaryText);

    // Append to client's summary_history
    const currentHistory = client.summary_history || [];
    const newSummary = {
      stage_instance_id: stage_instance_id,
      stage_name: stageInstance.name,
      workflow_name: workflowInstance.name,
      summary_text: summaryText,
      generated_at: new Date().toISOString()
    };

    await base44.asServiceRole.entities.Client.update(client.id, {
      summary_history: [...currentHistory, newSummary]
    });

    console.log('Summary appended to client record');

    // Create audit log
    await base44.asServiceRole.entities.AIAuditLog.create({
      action_type: 'generate_stage_summary',
      actor_type: 'ai',
      actor_id: user.id,
      input_summary: `Generate summary for stage: ${stageInstance.name}`,
      output_summary: 'Stage summary generated and stored',
      raw_input: { stage_instance_id },
      raw_output: { summary_text: summaryText },
      status: 'success'
    });

    return Response.json({ 
      success: true, 
      summary: newSummary
    });

  } catch (error) {
    console.error('Generate Stage Summary Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});