import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { form_template_id, client_id, recipient_email, expires_in_days = 30 } = await req.json();

    if (!form_template_id || !client_id || !recipient_email) {
      return Response.json({ 
        error: 'Missing required fields: form_template_id, client_id, recipient_email' 
      }, { status: 400 });
    }

    // Fetch form template
    const templates = await base44.asServiceRole.entities.FormTemplate.filter({ 
      id: form_template_id 
    });
    const template = templates[0];

    if (!template) {
      return Response.json({ error: 'Form template not found' }, { status: 404 });
    }

    // Fetch client
    const clients = await base44.asServiceRole.entities.Client.filter({ 
      id: client_id 
    });
    const client = clients[0];

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Generate unique token
    const unique_url_token = crypto.randomUUID();

    // Calculate expiration date
    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + expires_in_days);

    // Create FormInstance
    const formInstance = await base44.asServiceRole.entities.FormInstance.create({
      form_template_id,
      client_id,
      unique_url_token,
      recipient_email,
      status: 'sent',
      sent_at: new Date().toISOString(),
      expires_at: expires_at.toISOString()
    });

    // Construct public URL
    const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://app.base44.com';
    const publicUrl = `${appUrl}/ClientForm?token=${unique_url_token}`;

    // Send email
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: recipient_email,
      subject: `${template.name} - ${client.name}`,
      body: `
Hello,

Please complete the following form: ${template.name}

Click here to access the form: ${publicUrl}

This link will expire on ${expires_at.toLocaleDateString()}.

Thank you!
      `
    });

    // Log communication
    await base44.asServiceRole.entities.CommunicationLog.create({
      client_id,
      communication_type: 'email',
      subject: `Form sent: ${template.name}`,
      content: `Form link sent to ${recipient_email}`,
      direction: 'outbound',
      occurred_at: new Date().toISOString(),
      metadata: {
        form_instance_id: formInstance.id,
        form_url: publicUrl
      }
    });

    return Response.json({
      success: true,
      form_instance: formInstance,
      public_url: publicUrl
    });

  } catch (error) {
    console.error('Create Form Link Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});