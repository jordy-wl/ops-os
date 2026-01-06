import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { client_id } = await req.json();

  if (!client_id) {
    return Response.json({ error: 'Missing client_id' }, { status: 400 });
  }

  // LOOK PHASE: Get comprehensive client context
  const clientDataRes = await base44.asServiceRole.functions.invoke('getClientData', { client_id });
  const clientData = clientDataRes.data;

  // Get active workflows
  const activeWorkflows = await base44.asServiceRole.entities.WorkflowInstance.filter({
    client_id,
    status: 'in_progress'
  });

  // Get available workflow templates (potential next workflows)
  const availableTemplates = await base44.asServiceRole.entities.WorkflowTemplate.filter({
    is_active: true
  }, '-created_date', 10);

  // Get recent events for this client
  const recentEvents = await base44.asServiceRole.entities.Event.filter({
    payload: { client_id }
  }, '-occurred_at', 10);

  // THINK PHASE: Determine next best action using SAGO-RAG
  const reasoningPrompt = `You are analyzing a client record to determine the Next Best Action.

CLIENT DATA:
${JSON.stringify(clientData, null, 2)}

ACTIVE WORKFLOWS:
${JSON.stringify(activeWorkflows, null, 2)}

AVAILABLE WORKFLOW TEMPLATES:
${JSON.stringify(availableTemplates.map(t => ({ 
  id: t.id, 
  name: t.name, 
  category: t.category, 
  type: t.type 
})), null, 2)}

RECENT ACTIVITY:
${JSON.stringify(recentEvents.slice(0, 5), null, 2)}

Based on:
1. CURRENT STATE: Client's lifecycle stage, active workflows, enriched data
2. DESIRED STATE: Typical progression paths for similar clients
3. GAP ANALYSIS: What's missing or what should happen next

Determine the single best next action for this client. Consider:
- Are there workflows that should be started?
- Are there gaps in data that need filling?
- Are there risks that need addressing?
- What's the natural next step in their journey?

Provide a clear, actionable recommendation (1-2 sentences).`;

  const nextAction = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: reasoningPrompt,
    add_context_from_internet: false
  });

  // Update client record
  await base44.asServiceRole.entities.Client.update(client_id, {
    next_best_action: nextAction
  });

  // Log AI action
  const agentConfigs = await base44.asServiceRole.entities.AIAgentConfig.filter({
    role: 'sago_rag_engine'
  });

  if (agentConfigs.length > 0) {
    await base44.asServiceRole.entities.AIAuditLog.create({
      ai_agent_config_id: agentConfigs[0].id,
      input_summary: `Generate next best action for client ${client_id}`,
      output_summary: nextAction,
      status: 'success'
    });
  }

  return Response.json({ 
    success: true, 
    next_best_action: nextAction 
  });
});