import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { recipient_user_id, type, entity_type, entity_id, message, action_url, metadata } = await req.json();

    if (!recipient_user_id || !type || !message) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Don't create notification if user is notifying themselves
    if (recipient_user_id === user.id) {
      return Response.json({ success: true, notification: null });
    }

    const notification = await base44.asServiceRole.entities.Notification.create({
      recipient_user_id,
      sender_user_id: user.id,
      type,
      entity_type,
      entity_id,
      message,
      read_status: false,
      action_url,
      metadata: metadata || {}
    });

    return Response.json({ success: true, notification });
  } catch (error) {
    console.error('Create notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});