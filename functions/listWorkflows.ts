import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { client_id, status_filter, limit = 50 } = await req.json();

  let query = {};
  if (client_id) query.client_id = client_id;
  if (status_filter) query.status = status_filter;

  const workflows = await base44.entities.WorkflowInstance.filter(query, '-created_date', limit);

  return Response.json({ success: true, workflows });
});