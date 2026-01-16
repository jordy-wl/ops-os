import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { document_id, recipient_email } = await req.json();

    if (!document_id || !recipient_email) {
      return Response.json({ error: 'document_id and recipient_email are required' }, { status: 400 });
    }

    // Get document instance
    const documents = await base44.entities.DocumentInstance.filter({ id: document_id });
    if (documents.length === 0) {
      return Response.json({ error: 'Document not found' }, { status: 404 });
    }
    const document = documents[0];

    // Get client information
    const clients = await base44.entities.Client.filter({ id: document.client_id });
    const clientName = clients.length > 0 ? clients[0].name : 'Client';

    // Send email with document
    await base44.integrations.Core.SendEmail({
      to: recipient_email,
      subject: `Document: ${document.name}`,
      body: `
        <h2>${document.name}</h2>
        <p>Please find the document attached below:</p>
        <br>
        ${document.generated_content ? `<div style="white-space: pre-wrap;">${document.generated_content}</div>` : ''}
        <br>
        ${document.file_url ? `<p><a href="${document.file_url}" style="display: inline-block; padding: 10px 20px; background-color: #00E5FF; color: #121212; text-decoration: none; border-radius: 5px;">Download Document</a></p>` : ''}
        <br>
        <p style="color: #666; font-size: 12px;">Sent from ${clientName}</p>
      `
    });

    // Update document status
    await base44.asServiceRole.entities.DocumentInstance.update(document_id, {
      status: 'sent',
      sent_at: new Date().toISOString()
    });

    // Log communication
    await base44.asServiceRole.entities.CommunicationLog.create({
      client_id: document.client_id,
      type: 'email',
      direction: 'outbound',
      subject: `Document: ${document.name}`,
      content: `Document sent to ${recipient_email}`,
      sent_at: new Date().toISOString(),
      sent_by: user.id,
      recipient: recipient_email,
      metadata: {
        document_id: document_id,
        document_name: document.name
      }
    });

    return Response.json({
      success: true,
      message: 'Document sent successfully'
    });

  } catch (error) {
    console.error('Error sending document:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});