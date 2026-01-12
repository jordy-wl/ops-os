import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      client_id, 
      recipient_email, 
      subject, 
      body, 
      communication_type = 'email',
      is_ai_drafted = false,
      ai_prompt = null,
      ai_response_raw = null,
      contact_id = null,
      workflow_instance_id = null
    } = await req.json();

    if (!client_id || !recipient_email || !body) {
      return Response.json({ 
        error: 'Missing required fields: client_id, recipient_email, body' 
      }, { status: 400 });
    }

    // Fetch client
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const client = clients[0];

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Send email if communication_type is email
    if (communication_type === 'email') {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: recipient_email,
        subject: subject || 'Message from your team',
        body
      });
    }

    // Create communication log
    const commLog = await base44.asServiceRole.entities.CommunicationLog.create({
      client_id,
      communication_type,
      subject,
      content: body,
      contact_id,
      workflow_instance_id,
      direction: 'outbound',
      occurred_at: new Date().toISOString(),
      is_ai_drafted,
      ai_prompt,
      ai_response_raw,
      metadata: {
        sent_by: user.email,
        recipient: recipient_email
      }
    });

    // Publish event
    await base44.asServiceRole.entities.Event.create({
      event_type: 'client_record_enriched',
      source_entity_type: 'client',
      source_entity_id: client_id,
      actor_type: 'user',
      actor_id: user.id,
      payload: {
        action: 'communication_sent',
        communication_type,
        is_ai_drafted
      },
      occurred_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      communication_log: commLog
    });

  } catch (error) {
    console.error('Send Communication Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});