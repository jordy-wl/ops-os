import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, communication_type, purpose, additional_context } = await req.json();

    if (!client_id) {
      return Response.json({ error: 'Missing required field: client_id' }, { status: 400 });
    }

    // Fetch client data
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const client = clients[0];

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch recent communications
    const recentComms = await base44.asServiceRole.entities.CommunicationLog.filter(
      { client_id: client.id },
      '-occurred_at',
      5
    );

    // Fetch active workflows
    const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter({
      client_id: client.id,
      status: 'in_progress'
    });

    // Build context for AI
    const context = {
      client: {
        name: client.name,
        industry: client.industry,
        lifecycle_stage: client.lifecycle_stage,
        metadata: client.metadata,
        insights: client.insights,
        sentiment_score: client.sentiment_score
      },
      recent_interactions: recent_comms?.slice(0, 5).map(c => ({
        type: c.communication_type,
        subject: c.subject,
        date: c.occurred_at
      })),
      active_workflows: workflows?.length || 0
    };

    const prompt = `You are drafting a ${template.category} document for ${client.name}.

Template: ${template.name}
Description: ${template.description || 'No description'}

Client Context:
${JSON.stringify(context, null, 2)}

Template Content with Placeholders:
${template.content_template}

Available Placeholders (these are auto-populated from client data):
${(template.placeholder_schema || []).map(p => `- {{${p.key}}}: ${p.label}`).join('\n')}

Instructions:
1. Generate a professional, well-structured document
2. Use the template structure but enhance it with relevant details
3. Replace ALL placeholders with actual client data
4. Add context-aware content based on client information
5. Maintain a professional tone appropriate for ${template.category}
6. Output in ${template.output_format} format

Generate the complete document now.`;

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: false
    });

    // Create DocumentInstance
    const documentInstance = await base44.asServiceRole.entities.DocumentInstance.create({
      document_template_id: template.id,
      client_id,
      name: `${template.name} - ${client.name}`,
      generated_content: response,
      data_snapshot: context,
      status: 'generated',
      generated_at: new Date().toISOString(),
      generated_by: user.id
    });

    // Publish event
    await base44.asServiceRole.entities.Event.create({
      event_type: 'document_generated',
      source_entity_type: 'document_instance',
      source_entity_id: documentInstance.id,
      actor_type: 'ai',
      actor_id: user.id,
      payload: {
        template_name: template.name,
        client_id,
        ai_enhanced: true
      },
      occurred_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      document_instance: documentInstance
    });

  } catch (error) {
    console.error('AI Drafter Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});