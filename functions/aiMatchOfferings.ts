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
      return Response.json({ error: 'Missing client_id' }, { status: 400 });
    }

    // Fetch client data
    const clients = await base44.asServiceRole.entities.Client.filter({ id: client_id });
    const client = clients[0];

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch all offerings (concepts, products, services)
    const [concepts, products, services] = await Promise.all([
      base44.asServiceRole.entities.BusinessConcept.filter({ is_active: true }),
      base44.asServiceRole.entities.Product.filter({ is_active: true }),
      base44.asServiceRole.entities.Service.filter({ is_active: true }),
    ]);

    // Fetch client's workflow history and summaries for context
    const workflows = await base44.asServiceRole.entities.WorkflowInstance.filter(
      { client_id },
      '-updated_date',
      5
    );

    const clientContext = {
      name: client.name,
      industry: client.industry,
      lifecycle_stage: client.lifecycle_stage,
      region: client.region,
      value: client.value,
      summary_history: client.summary_history || [],
      insights: client.insights || {},
      recent_workflows: workflows.map(w => w.name)
    };

    // Build offerings catalog for AI
    const offeringsCatalog = {
      concepts: concepts.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        category: c.category,
        target_industries: c.target_industries,
        maturity_level: c.maturity_level
      })),
      products: products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        pricing_model: p.pricing_model,
        target_market: p.target_market
      })),
      services: services.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        pricing_model: s.pricing_model,
        delivery_model: s.delivery_model
      }))
    };

    // Call AI to match offerings
    const systemPrompt = `You are The Strategist's Offering Matcher for Business OS.

Your role: Analyze client context and recommend the most relevant offerings (concepts, products, services).

**Client Context:**
${JSON.stringify(clientContext, null, 2)}

**Available Offerings:**
${JSON.stringify(offeringsCatalog, null, 2)}

**Instructions:**
- Analyze the client's industry, lifecycle stage, and historical context
- Recommend offerings that would provide the most value
- Consider timing and readiness based on lifecycle stage
- Provide reasoning for each recommendation
- Rank recommendations by fit score (0-100)`;

    const aiResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `${systemPrompt}\n\nProvide your recommendations:`,
      response_json_schema: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                offering_type: {
                  type: "string",
                  enum: ["concept", "product", "service"]
                },
                offering_id: { type: "string" },
                offering_name: { type: "string" },
                fit_score: { type: "number" },
                reasoning: { type: "string" },
                priority: {
                  type: "string",
                  enum: ["high", "medium", "low"]
                },
                recommended_action: { type: "string" }
              }
            }
          },
          summary: { type: "string" }
        },
        required: ["recommendations", "summary"]
      }
    });

    // Update client insights with offering recommendations
    const updatedInsights = {
      ...(client.insights || {}),
      offering_recommendations: aiResponse.recommendations,
      offering_analysis_date: new Date().toISOString(),
      offering_summary: aiResponse.summary
    };

    await base44.asServiceRole.entities.Client.update(client_id, {
      insights: updatedInsights
    });

    // Create audit log
    await base44.asServiceRole.entities.AIAuditLog.create({
      action_type: 'offering_matching',
      actor_type: 'ai',
      actor_id: 'strategist_agent',
      input_summary: `Match offerings for client: ${client.name}`,
      output_summary: `${aiResponse.recommendations.length} recommendations generated`,
      raw_input: { client_id, clientContext },
      raw_output: aiResponse,
      status: 'success'
    });

    return Response.json({
      success: true,
      client_name: client.name,
      recommendations: aiResponse.recommendations,
      summary: aiResponse.summary
    });

  } catch (error) {
    console.error('AI Match Offerings Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});