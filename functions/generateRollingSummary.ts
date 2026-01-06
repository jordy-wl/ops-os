import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { stage_instance_id } = await req.json();

  if (!stage_instance_id) {
    return Response.json({ error: 'Missing stage_instance_id' }, { status: 400 });
  }

  // Get stage instance
  const stageInstances = await base44.asServiceRole.entities.StageInstance.filter({ 
    id: stage_instance_id 
  });
  
  if (stageInstances.length === 0) {
    return Response.json({ error: 'Stage not found' }, { status: 404 });
  }

  const stage = stageInstances[0];

  // Get workflow instance
  const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter({ 
    id: stage.workflow_instance_id 
  });
  const workflow = workflows[0];

  // Get all tasks from this stage
  const deliverables = await base44.asServiceRole.entities.DeliverableInstance.filter({
    stage_instance_id
  });

  const allTasks = [];
  for (const deliverable of deliverables) {
    const tasks = await base44.asServiceRole.entities.TaskInstance.filter({
      deliverable_instance_id: deliverable.id
    });
    allTasks.push(...tasks);
  }

  // Get field values collected during this stage
  const stageFieldValues = allTasks.map(t => ({
    task: t.name,
    status: t.status,
    field_values: t.field_values || {},
    completed_at: t.completed_at
  }));

  // THINK PHASE: Generate summary with AI
  const summaryPrompt = `You are analyzing a completed workflow stage. Generate a concise summary.

STAGE: ${stage.name}
WORKFLOW: ${workflow.name}
CLIENT_ID: ${workflow.client_id}
STATUS: ${stage.status}

TASKS COMPLETED:
${JSON.stringify(stageFieldValues, null, 2)}

Generate a summary that captures:
1. Overall outcome (Success/Partial/Issues)
2. Key data collected
3. Notable challenges or delays
4. Important context for future stages

Keep it concise (2-3 paragraphs max). Focus on actionable insights.`;

  const summary = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: summaryPrompt,
    add_context_from_internet: false
  });

  // Get client
  const clients = await base44.asServiceRole.entities.Client.filter({ id: workflow.client_id });
  const client = clients[0];

  // Update client insights with rolling summary
  const existingInsights = client.insights || {};
  const stageSummaries = existingInsights.stage_summaries || [];
  
  stageSummaries.push({
    stage_name: stage.name,
    workflow_name: workflow.name,
    summary,
    completed_at: new Date().toISOString(),
    stage_instance_id
  });

  await base44.asServiceRole.entities.Client.update(workflow.client_id, {
    insights: {
      ...existingInsights,
      stage_summaries: stageSummaries,
      last_summary_generated: new Date().toISOString()
    }
  });

  // Log AI action
  const agentConfigs = await base44.asServiceRole.entities.AIAgentConfig.filter({
    role: 'sago_rag_engine'
  });

  if (agentConfigs.length > 0) {
    await base44.asServiceRole.entities.AIAuditLog.create({
      ai_agent_config_id: agentConfigs[0].id,
      input_summary: `Generate summary for stage: ${stage.name}`,
      output_summary: summary.substring(0, 200),
      raw_output: { summary },
      status: 'success',
      duration_ms: 0
    });
  }

  return Response.json({ 
    success: true, 
    summary,
    stage_name: stage.name
  });
});