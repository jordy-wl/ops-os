import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { document_template_id, client_id, override_data } = await req.json();

    if (!document_template_id || !client_id) {
      return Response.json({ 
        error: 'Missing required fields: document_template_id and client_id' 
      }, { status: 400 });
    }

    // Fetch template
    const templates = await base44.asServiceRole.entities.DocumentTemplate.filter({ 
      id: document_template_id 
    });
    const template = templates[0];

    if (!template) {
      return Response.json({ error: 'Document template not found' }, { status: 404 });
    }

    // Fetch client data
    const clients = await base44.asServiceRole.entities.Client.filter({ 
      id: client_id 
    });
    const client = clients[0];

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Build data object for placeholder replacement
    const dataContext = {
      client: {
        ...client,
        metadata: client.metadata || {}
      },
      ...(override_data || {})
    };

    // Replace placeholders in content_template
    let generatedContent = template.content_template || '';
    
    // Match patterns like {{client.name}} or {{client.metadata.company_size}}
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    generatedContent = generatedContent.replace(placeholderRegex, (match, path) => {
      const keys = path.trim().split('.');
      let value = dataContext;
      
      for (const key of keys) {
        value = value?.[key];
        if (value === undefined || value === null) break;
      }
      
      return value !== undefined && value !== null ? String(value) : match;
    });

    // Create DocumentInstance
    const documentInstance = await base44.asServiceRole.entities.DocumentInstance.create({
      document_template_id,
      client_id,
      name: `${template.name} - ${client.name}`,
      generated_content: generatedContent,
      data_snapshot: dataContext,
      status: 'generated',
      generated_at: new Date().toISOString(),
      generated_by: user.id
    });

    // Publish event
    await base44.asServiceRole.entities.Event.create({
      event_type: 'document_generated',
      source_entity_type: 'document_instance',
      source_entity_id: documentInstance.id,
      actor_type: 'user',
      actor_id: user.id,
      payload: {
        template_name: template.name,
        client_name: client.name
      },
      occurred_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      document_instance: documentInstance
    });

  } catch (error) {
    console.error('Generate Document Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});