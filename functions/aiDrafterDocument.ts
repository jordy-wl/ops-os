import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { document_template_id, client_id, workflow_instance_id, deliverable_instance_id } = await req.json();

  if (!document_template_id || !client_id) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Get document template
  const templates = await base44.entities.DocumentTemplate.filter({ id: document_template_id });
  if (templates.length === 0) {
    return Response.json({ error: 'Document template not found' }, { status: 404 });
  }

  const template = templates[0];

  // Get client data with enriched fields
  const clientDataRes = await base44.functions.invoke('getClientData', { client_id });
  const clientData = clientDataRes.data;

  // THINK PHASE: Fill template placeholders and generate content
  const generationPrompt = `You are the Drafter - the Document Engine AI for Business OS.

Your role: Fill document templates with data and generate prose for missing sections.
Your goal: Zero Manual Assembly.

DOCUMENT TEMPLATE: ${template.name}
CATEGORY: ${template.category}

CLIENT DATA:
${JSON.stringify(clientData, null, 2)}

TEMPLATE CONTENT:
${template.content || 'No template content - generate appropriate document structure'}

PLACEHOLDERS TO FILL:
${JSON.stringify(template.placeholders || [], null, 2)}

Generate the complete document content by:
1. Replacing all placeholders with actual client data
2. Writing professional prose for any missing sections
3. Ensuring the document is coherent and production-ready

Output the final document content in markdown format.`;

  const generatedContent = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: generationPrompt,
    add_context_from_internet: false
  });

  // Publish DOCUMENT_GENERATION_REQUESTED event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'document_generation_requested',
    source_entity_type: 'document_template',
    source_entity_id: document_template_id,
    actor_type: 'user',
    actor_id: user.id,
    payload: { client_id },
    occurred_at: new Date().toISOString()
  });

  // Create document instance
  const documentInstance = await base44.asServiceRole.entities.DocumentInstance.create({
    document_template_id,
    client_id,
    workflow_instance_id,
    deliverable_instance_id,
    name: `${template.name} - ${clientData.client?.name || 'Client'}`,
    content: generatedContent,
    status: 'generated',
    generated_at: new Date().toISOString(),
    generated_by: user.id
  });

  // Publish DOCUMENT_GENERATED event
  await base44.asServiceRole.entities.Event.create({
    event_type: 'document_generated',
    source_entity_type: 'document_instance',
    source_entity_id: documentInstance.id,
    actor_type: 'ai',
    payload: { 
      template_name: template.name,
      client_id 
    },
    occurred_at: new Date().toISOString()
  });

  // Log AI action
  const agentConfigs = await base44.asServiceRole.entities.AIAgentConfig.filter({
    role: 'deliverable_generator'
  });

  if (agentConfigs.length > 0) {
    await base44.asServiceRole.entities.AIAuditLog.create({
      ai_agent_config_id: agentConfigs[0].id,
      input_summary: `Generate document: ${template.name}`,
      output_summary: `Document created for client ${client_id}`,
      raw_output: { document_id: documentInstance.id },
      status: 'success'
    });
  }

  return Response.json({ 
    success: true, 
    document: documentInstance
  });
});