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
- Tasks can have Subitems (optional micro-steps/checklists)

DESIGN BEST PRACTICES:
- Create 3-7 stages for linear workflows
- Each stage should have 1-4 deliverables
- Each deliverable should have 2-8 tasks
- Include clear, actionable task instructions
- Consider who should own each level (team/department)
- Think about what data each task should collect

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
      "description": "What happens in this stage",
      "sequence_order": 1,
      "estimated_duration_days": 7,
      "deliverables": [
        {
          "name": "Deliverable Name",
          "description": "What this deliverable produces",
          "sequence_order": 1,
          "is_required": true,
          "tasks": [
            {
              "name": "Task Name",
              "description": "What this task accomplishes",
              "instructions": "Step-by-step how to complete this task",
              "sequence_order": 1,
              "priority": "normal",
              "estimated_duration_minutes": 60,
              "subitems": [
                {
                  "name": "Subitem name",
                  "sequence_order": 1
                }
              ]
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
            description: { type: "string" },
            sequence_order: { type: "number" },
            estimated_duration_days: { type: "number" },
            deliverables: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  sequence_order: { type: "number" },
                  is_required: { type: "boolean" },
                  tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        description: { type: "string" },
                        instructions: { type: "string" },
                        sequence_order: { type: "number" },
                        priority: { type: "string" },
                        estimated_duration_minutes: { type: "number" },
                        subitems: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              sequence_order: { type: "number" }
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

  // Create stages, deliverables, tasks, and subitems
  const createdCounts = { stages: 0, deliverables: 0, tasks: 0, subitems: 0 };

  for (const stageData of workflowStructure.stages) {
    const stage = await base44.asServiceRole.entities.StageTemplate.create({
      workflow_template_version_id: version.id,
      name: stageData.name,
      description: stageData.description || '',
      sequence_order: stageData.sequence_order,
      estimated_duration_days: stageData.estimated_duration_days || null,
      owner_type: 'user',
      owner_id: user.id
    });
    createdCounts.stages++;

    for (const deliverableData of stageData.deliverables) {
      const deliverable = await base44.asServiceRole.entities.DeliverableTemplate.create({
        stage_template_id: stage.id,
        name: deliverableData.name,
        description: deliverableData.description || '',
        sequence_order: deliverableData.sequence_order,
        is_required: deliverableData.is_required !== false,
        owner_type: 'user',
        owner_id: user.id
      });
      createdCounts.deliverables++;

      for (const taskData of deliverableData.tasks) {
        const task = await base44.asServiceRole.entities.TaskTemplate.create({
          deliverable_template_id: deliverable.id,
          name: taskData.name,
          description: taskData.description,
          instructions: taskData.instructions,
          sequence_order: taskData.sequence_order,
          priority: taskData.priority || 'normal',
          estimated_duration_minutes: taskData.estimated_duration_minutes || null,
          owner_type: 'user',
          owner_id: user.id
        });
        createdCounts.tasks++;

        // Create subitems if provided
        if (taskData.subitems && taskData.subitems.length > 0) {
          for (const subitemData of taskData.subitems) {
            await base44.asServiceRole.entities.SubitemTemplate.create({
              task_template_id: task.id,
              name: subitemData.name,
              sequence_order: subitemData.sequence_order
            });
            createdCounts.subitems++;
          }
        }
      }
    }
  }

  console.log('Workflow template created:', createdCounts);

  // Create audit log for AI workflow generation
  await base44.asServiceRole.entities.AIAuditLog.create({
    action_type: 'generate_workflow_template',
    actor_type: 'ai',
    actor_id: user.id,
    input_summary: `Generate workflow: ${workflow_description.substring(0, 100)}`,
    output_summary: `Created template "${workflowStructure.name}" with ${createdCounts.stages} stages, ${createdCounts.deliverables} deliverables, ${createdCounts.tasks} tasks`,
    raw_input: { workflow_description, workflow_type, category },
    raw_output: { template_id: template.id, structure: workflowStructure },
    status: 'success'
  });

  return Response.json({ 
    success: true, 
    template,
    version,
    structure: workflowStructure,
    counts: createdCounts
  });
});