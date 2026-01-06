import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { workflow_description, workflow_type = 'linear', category = 'custom' } = await req.json();

  if (!workflow_description) {
    return Response.json({ error: 'Missing workflow_description' }, { status: 400 });
  }

  // Get existing templates for reference
  const existingTemplates = await base44.entities.WorkflowTemplate.list('-created_date', 5);

  const systemPrompt = `You are the Architect - the Workflow Builder AI for Business OS.

Your role: Generate or refine Workflow Templates based on natural language descriptions.
Your goal: Ensure Process Completeness.

WORKFLOW DESIGN PRINCIPLES:
- Workflows have Stages (high-level phases)
- Each Stage has Deliverables (concrete outputs)
- Each Deliverable has Tasks (actions to complete it)
- Tasks can have Subitems (micro-steps)

EXISTING TEMPLATES FOR REFERENCE:
${JSON.stringify(existingTemplates.map(t => ({ name: t.name, type: t.type, category: t.category })), null, 2)}

Generate a complete workflow structure based on the user's description.
Return ONLY a valid JSON object with this structure:
{
  "name": "Workflow Name",
  "description": "Brief description",
  "stages": [
    {
      "name": "Stage Name",
      "sequence_order": 1,
      "deliverables": [
        {
          "name": "Deliverable Name",
          "sequence_order": 1,
          "tasks": [
            {
              "name": "Task Name",
              "description": "What this task accomplishes",
              "instructions": "How to complete this task",
              "sequence_order": 1,
              "priority": "normal"
            }
          ]
        }
      ]
    }
  ]
}`;

  const responseSchema = {
    type: "object",
    properties: {
      name: { type: "string" },
      description: { type: "string" },
      stages: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            sequence_order: { type: "number" },
            deliverables: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  sequence_order: { type: "number" },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        instructions: { type: "string" },
                        sequence_order: { type: "number" },
                        priority: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  // THINK PHASE: Generate workflow structure
  const workflowStructure = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `${systemPrompt}\n\nUSER REQUEST: ${workflow_description}\n\nWorkflow Type: ${workflow_type}\nCategory: ${category}`,
    response_json_schema: responseSchema
  });

  // Create the workflow template
  const template = await base44.asServiceRole.entities.WorkflowTemplate.create({
    name: workflowStructure.name,
    description: workflowStructure.description,
    type: workflow_type,
    category,
    current_version: 1,
    owner_type: 'user',
    owner_id: user.id,
    is_active: true
  });

  // Create version
  const version = await base44.asServiceRole.entities.WorkflowTemplateVersion.create({
    workflow_template_id: template.id,
    version_number: 1,
    name: workflowStructure.name,
    description: workflowStructure.description,
    status: 'draft',
    published_by: user.id
  });

  // Create stages, deliverables, and tasks
  for (const stageData of workflowStructure.stages) {
    const stage = await base44.asServiceRole.entities.StageTemplate.create({
      workflow_template_version_id: version.id,
      name: stageData.name,
      sequence_order: stageData.sequence_order,
      owner_type: 'user',
      owner_id: user.id
    });

    for (const deliverableData of stageData.deliverables) {
      const deliverable = await base44.asServiceRole.entities.DeliverableTemplate.create({
        stage_template_id: stage.id,
        name: deliverableData.name,
        sequence_order: deliverableData.sequence_order,
        owner_type: 'user',
        owner_id: user.id
      });

      for (const taskData of deliverableData.tasks) {
        await base44.asServiceRole.entities.TaskTemplate.create({
          deliverable_template_id: deliverable.id,
          name: taskData.name,
          description: taskData.description,
          instructions: taskData.instructions,
          sequence_order: taskData.sequence_order,
          priority: taskData.priority || 'normal',
          owner_type: 'user',
          owner_id: user.id
        });
      }
    }
  }

  return Response.json({ 
    success: true, 
    template,
    version,
    structure: workflowStructure
  });
});