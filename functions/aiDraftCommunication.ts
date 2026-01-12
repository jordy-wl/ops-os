import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, user_request_text, communication_type = 'email', context } = await req.json();

    if (!client_id || !user_request_text) {
      return Response.json({ 
        error: 'Missing required fields: client_id, user_request_text' 
      }, { status: 400 });
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
      10
    );

    // Fetch contacts
    const clientContacts = await base44.asServiceRole.entities.ClientContact.filter({ 
      client_id: client.id 
    });
    const contactIds = clientContacts.map(cc => cc.contact_id);
    const contacts = contactIds.length > 0 
      ? await base44.asServiceRole.entities.Contact.filter({ 
          id: { $in: contactIds } 
        })
      : [];

    // Fetch active workflows
    const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter({
      client_id: client.id,
      status: 'in_progress'
    }, '-created_date', 5);

    // Build comprehensive context
    const clientContext = {
      name: client.name,
      industry: client.industry,
      lifecycle_stage: client.lifecycle_stage,
      recent_communications: recentComms.slice(0, 5).map(c => ({
        type: c.communication_type,
        subject: c.subject,
        date: c.occurred_at
      })),
      active_workflows: workflows.map(w => w.name),
      insights: client.insights,
      sentiment: client.sentiment_score,
      contacts: contacts.map(c => ({
        name: `${c.first_name} ${c.last_name}`,
        email: c.email,
        role: c.job_title
      }))
    };

    const prompt = `You are an AI assistant helping draft professional ${communication_type} communications for business relationships.

User Request: ${user_request_text}

Client Context:
- Name: ${client.name}
- Industry: ${client.industry || 'Not specified'}
- Stage: ${client.lifecycle_stage}
- Sentiment: ${client.sentiment_score || 'Neutral'}

Recent Communication History:
${recentComms.slice(0, 5).map(c => `- ${c.communication_type}: ${c.subject || c.content?.substring(0, 100)}`).join('\n')}

Active Workflows:
${workflows.length > 0 ? workflows.map(w => `- ${w.name} (${w.status})`).join('\n') : '- None'}

Key Contacts:
${contacts.slice(0, 3).map(c => `- ${c.first_name} ${c.last_name} (${c.job_title || 'Contact'})`).join('\n')}

${client.insights?.summary ? `Client Insights: ${client.insights.summary}` : ''}

${context?.additional_context ? `Additional Context: ${context.additional_context}` : ''}

Draft a professional ${communication_type} that addresses the user's request. Be specific, contextual, and professional. Include a compelling subject line if this is an email.

Output as JSON with 'subject' and 'body' fields.`;

    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          subject: { type: "string" },
          body: { type: "string" }
        }
      }
    });

    return Response.json({
      success: true,
      drafted_communication: response,
      client_context: clientContext
    });

  } catch (error) {
    console.error('AI Draft Communication Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});