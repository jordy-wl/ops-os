import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { client_id } = await req.json();

  if (!client_id) {
    return Response.json({ error: 'Missing client_id' }, { status: 400 });
  }

  // Get client
  const clients = await base44.entities.Client.filter({ id: client_id });
  if (clients.length === 0) {
    return Response.json({ error: 'Client not found' }, { status: 404 });
  }

  const client = clients[0];

  // Get all field values for this client
  const fieldValues = await base44.entities.FieldValue.filter({
    object_type: 'client',
    object_id: client_id
  });

  // Get field definitions
  const enrichedData = {};
  
  for (const fv of fieldValues) {
    const fieldDefs = await base44.entities.FieldDefinition.filter({ id: fv.field_definition_id });
    if (fieldDefs.length > 0) {
      const fieldDef = fieldDefs[0];
      enrichedData[fieldDef.code] = {
        name: fieldDef.name,
        value: fv.value?.data,
        source_type: fv.source_type,
        updated_at: fv.updated_date
      };
    }
  }

  // Get active workflows
  const activeWorkflows = await base44.entities.WorkflowInstance.filter({
    client_id,
    status: 'in_progress'
  });

  // Get contacts
  const clientContacts = await base44.entities.ClientContact.filter({ client_id });
  const contactIds = clientContacts.map(cc => cc.contact_id);
  
  const contacts = [];
  for (const contactId of contactIds) {
    const contactData = await base44.entities.Contact.filter({ id: contactId });
    if (contactData.length > 0) {
      contacts.push(contactData[0]);
    }
  }

  return Response.json({
    success: true,
    client,
    enriched_data: enrichedData,
    active_workflows: activeWorkflows,
    contacts
  });
});