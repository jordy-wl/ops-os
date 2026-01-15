import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { client_id } = await req.json();

    if (!client_id) {
      return Response.json({ error: 'client_id is required' }, { status: 400 });
    }

    // Fetch client
    const clients = await base44.entities.Client.filter({ id: client_id });
    if (clients.length === 0) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Delete all workflow instances related to this client
    const workflows = await base44.entities.WorkflowInstance.filter({ client_id });
    for (const workflow of workflows) {
      // Delete stages, deliverables, tasks, and documents
      const stages = await base44.entities.StageInstance.filter({ workflow_instance_id: workflow.id });
      for (const stage of stages) {
        const deliverables = await base44.entities.DeliverableInstance.filter({ stage_instance_id: stage.id });
        for (const deliverable of deliverables) {
          const tasks = await base44.entities.TaskInstance.filter({ deliverable_instance_id: deliverable.id });
          for (const task of tasks) {
            await base44.asServiceRole.entities.TaskInstance.delete(task.id);
          }
          const documents = await base44.entities.DocumentInstance.filter({ deliverable_instance_id: deliverable.id });
          for (const doc of documents) {
            await base44.asServiceRole.entities.DocumentInstance.delete(doc.id);
          }
          await base44.asServiceRole.entities.DeliverableInstance.delete(deliverable.id);
        }
        await base44.asServiceRole.entities.StageInstance.delete(stage.id);
      }
      await base44.asServiceRole.entities.WorkflowInstance.delete(workflow.id);
    }

    // Delete communications
    const communications = await base44.entities.CommunicationLog.filter({ source_entity_id: client_id });
    for (const comm of communications) {
      await base44.asServiceRole.entities.CommunicationLog.delete(comm.id);
    }

    // Delete client contacts
    const clientContacts = await base44.entities.ClientContact.filter({ client_id });
    for (const cc of clientContacts) {
      await base44.asServiceRole.entities.ClientContact.delete(cc.id);
    }

    // Delete events related to client
    const events = await base44.entities.Event.filter({ source_entity_id: client_id });
    for (const event of events) {
      await base44.asServiceRole.entities.Event.delete(event.id);
    }

    // Delete client
    await base44.asServiceRole.entities.Client.delete(client_id);

    return Response.json({ 
      success: true, 
      message: 'Client deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting client:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});