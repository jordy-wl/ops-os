import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { 
    ai_agent_config_id,
    strategy_action_id,
    trigger_message_id,
    input_summary,
    output_summary,
    raw_input,
    raw_output,
    status = 'success',
    duration_ms = 0
  } = await req.json();

  if (!ai_agent_config_id) {
    return Response.json({ error: 'Missing ai_agent_config_id' }, { status: 400 });
  }

  // Create audit log entry
  const auditLog = await base44.asServiceRole.entities.AIAuditLog.create({
    ai_agent_config_id,
    strategy_action_id,
    trigger_message_id,
    input_summary: input_summary || 'No summary',
    output_summary: output_summary || 'No summary',
    raw_input: raw_input || {},
    raw_output: raw_output || {},
    status,
    duration_ms
  });

  // If error, create system event
  if (status === 'error') {
    await base44.asServiceRole.entities.Event.create({
      event_type: 'ai_reasoning_triggered',
      source_entity_type: 'ai_agent_config',
      source_entity_id: ai_agent_config_id,
      actor_type: 'system',
      payload: {
        status: 'error',
        error: output_summary
      },
      occurred_at: new Date().toISOString()
    });
  }

  return Response.json({ 
    success: true, 
    audit_log: auditLog 
  });
});