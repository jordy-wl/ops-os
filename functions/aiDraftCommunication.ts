import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id, communication_type, context, tone = 'professional' } = await req.json();

    if (!client_id) {
      return Response.json({ error: 'Missing client_id' }, { status: 400 });
    }

    // Fetch client data
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const client = clients[0];

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch recent context
    const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter(
      { client_id: client.id },
      '-created_date',
      5
    );

    const communications = await base44.asServiceRole.entities.CommunicationLog.filter({
      client_id: client.id
    }, '-occurred_at', 10);

    // Build context for AI
    const context = {
      client_name: client.name,
      industry: client.industry,
      lifecycle_stage: client.lifecycle_stage,
      recent_workflows: (await Promise.all(
        workflows.slice(0, 3).map(async (w) => {
          const template = (await base44.asServiceRole.entities.WorkflowTemplate.filter({ id: w.workflow_template_id }))[0];
          return `${template?.name || 'Workflow'}: ${w.status}`;
        })
      )).join(', '),
      recent_communications: communications.slice(0, 5).map(c => `${c.communication_type} - ${c.subject}`).join('; ')
    };

    const prompt = `You are an AI assistant helping analyze a client relationship. Given the following client context, generate a personalized email draft for ${purpose}.

Client: ${client.name}
Industry: ${client.industry || 'N/A'}
Stage: ${client.lifecycle_stage}

Recent Activity:
${communications.slice(0, 5).map(c => `- ${c.communication_type}: ${c.subject || c.content?.substring(0, 50)}`).join('\n')}

Active Workflows: ${workflows.map(w => w.name).join(', ') || 'None'}

Client Insights: ${client.insights?.summary || 'No insights available'}

Write a professional ${tone} email that ${purpose}. Keep it concise and relevant to their context.`;

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
      email_content: response
    });

  } catch (error) {
    console.error('AI Communication Draft Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});