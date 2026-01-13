import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      audit_log_id,
      feedback_rating,
      feedback_comment,
      was_helpful,
      was_implemented
    } = await req.json();

    if (!audit_log_id) {
      return Response.json({ error: 'audit_log_id required' }, { status: 400 });
    }

    console.log('Submitting AI feedback for audit log:', audit_log_id);

    // Fetch the audit log
    const [auditLog] = await base44.asServiceRole.entities.AIAuditLog.filter({ id: audit_log_id });

    if (!auditLog) {
      return Response.json({ error: 'Audit log not found' }, { status: 404 });
    }

    // Update audit log with feedback
    const updatedLog = await base44.asServiceRole.entities.AIAuditLog.update(audit_log_id, {
      was_approved: was_helpful,
      user_feedback: {
        rating: feedback_rating,
        comment: feedback_comment,
        was_helpful,
        was_implemented,
        feedback_at: new Date().toISOString(),
        feedback_by: user.id
      }
    });

    // Optionally: Aggregate feedback for model improvement
    // In a production system, this data would be used to fine-tune models
    console.log('Feedback recorded successfully');

    return Response.json({
      success: true,
      message: 'Thank you for your feedback! This helps improve our AI suggestions.',
      updated_log: updatedLog
    });

  } catch (error) {
    console.error('Error submitting AI feedback:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});