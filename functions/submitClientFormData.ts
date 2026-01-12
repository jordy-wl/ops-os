import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { unique_url_token, submitted_data } = await req.json();

    if (!unique_url_token || !submitted_data) {
      return Response.json({ 
        error: 'Missing required fields: unique_url_token, submitted_data' 
      }, { status: 400 });
    }

    // Fetch FormInstance using service role (public endpoint)
    const instances = await base44.asServiceRole.entities.FormInstance.filter({ 
      unique_url_token 
    });
    const formInstance = instances[0];

    if (!formInstance) {
      return Response.json({ error: 'Form not found or invalid token' }, { status: 404 });
    }

    // Check if already completed
    if (formInstance.status === 'completed') {
      return Response.json({ error: 'Form already submitted' }, { status: 400 });
    }

    // Check if expired
    const now = new Date();
    const expiresAt = new Date(formInstance.expires_at);
    if (now > expiresAt) {
      await base44.asServiceRole.entities.FormInstance.update(formInstance.id, {
        status: 'expired'
      });
      return Response.json({ error: 'Form has expired' }, { status: 400 });
    }

    // Fetch form template
    const templates = await base44.asServiceRole.entities.FormTemplate.filter({ 
      id: formInstance.form_template_id 
    });
    const template = templates[0];

    if (!template) {
      return Response.json({ error: 'Form template not found' }, { status: 404 });
    }

    // Update FormInstance
    await base44.asServiceRole.entities.FormInstance.update(formInstance.id, {
      status: 'completed',
      submitted_data,
      submitted_at: new Date().toISOString()
    });

    // Apply client_data_map to update Client entity
    if (template.client_data_map) {
      const clients = await base44.asServiceRole.entities.Client.filter({ 
        id: formInstance.client_id 
      });
      const client = clients[0];

      if (client) {
        const updates = {};
        
        for (const [formKey, clientPath] of Object.entries(template.client_data_map)) {
          const value = submitted_data[formKey];
          if (value !== undefined && value !== null) {
            // Handle nested paths like "metadata.company_size"
            if (clientPath.startsWith('metadata.')) {
              const metadataKey = clientPath.replace('metadata.', '');
              updates.metadata = {
                ...(client.metadata || {}),
                [metadataKey]: value
              };
            } else {
              updates[clientPath] = value;
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.Client.update(formInstance.client_id, updates);
        }
      }
    }

    // Log communication
    await base44.asServiceRole.entities.CommunicationLog.create({
      client_id: formInstance.client_id,
      communication_type: 'other',
      subject: `Form completed: ${template.name}`,
      content: `Client submitted form data`,
      direction: 'inbound',
      occurred_at: new Date().toISOString(),
      metadata: {
        form_instance_id: formInstance.id,
        submitted_data
      }
    });

    // Publish event
    await base44.asServiceRole.entities.Event.create({
      event_type: 'field_updated',
      source_entity_type: 'client',
      source_entity_id: formInstance.client_id,
      actor_type: 'system',
      payload: {
        form_template_name: template.name,
        fields_updated: Object.keys(submitted_data)
      },
      occurred_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      message: template.thank_you_message || 'Thank you for your submission!'
    });

  } catch (error) {
    console.error('Submit Form Data Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});