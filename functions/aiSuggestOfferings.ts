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

    // Fetch client data
    const [client] = await base44.entities.Client.filter({ id: client_id });
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // Fetch ALL active offerings with comprehensive data
    const [products, services, businessConcepts] = await Promise.all([
      base44.asServiceRole.entities.Product.filter({ is_active: true }),
      base44.asServiceRole.entities.Service.filter({ is_active: true }),
      base44.asServiceRole.entities.BusinessConcept.list()
    ]);

    // Fetch active pricing rules for context
    const pricingRules = await base44.asServiceRole.entities.PricingRule.filter({ is_active: true });

    // Fetch current client offerings to avoid recommending what they already have
    const currentOfferings = await base44.asServiceRole.entities.ClientOffering.filter({ 
      client_id: client_id,
      status: 'active'
    });
    const currentOfferingIds = currentOfferings.map(o => o.offering_id);

    // Fetch client's workflow history for deeper context
    const workflowInstances = await base44.asServiceRole.entities.WorkflowInstance.filter(
      { client_id: client_id },
      '-created_date',
      10
    );

    // Build comprehensive context for AI
    const offeringsContext = [
      ...products.map(p => ({
        id: p.id,
        type: 'product',
        name: p.name,
        description: p.description,
        short_description: p.short_description,
        features: p.features || [],
        target_audience: p.target_audience || [],
        category: p.category,
        base_price: p.base_price,
        pricing_model: p.pricing_model,
        upsell_opportunities: p.upsell_opportunities || [],
        cross_sell_opportunities: p.cross_sell_opportunities || []
      })),
      ...services.map(s => ({
        id: s.id,
        type: 'service',
        name: s.name,
        description: s.description,
        short_description: s.short_description,
        features: s.features || [],
        target_audience: s.target_audience || [],
        category: s.category,
        base_price: s.base_price,
        pricing_model: s.pricing_model,
        upsell_opportunities: s.upsell_opportunities || [],
        cross_sell_opportunities: s.cross_sell_opportunities || []
      })),
      ...businessConcepts.map(c => ({
        id: c.id,
        type: 'concept',
        name: c.name,
        description: c.description,
        category: c.category,
        target_audience: c.target_audience || []
      }))
    ].filter(o => !currentOfferingIds.includes(o.id));

    // Build pricing context
    const pricingContext = pricingRules.map(rule => ({
      name: rule.name,
      description: rule.description,
      calculation_method: rule.calculation_method,
      fee_value: rule.fee_value,
      fee_unit: rule.fee_unit,
      frequency: rule.frequency,
      applies_to_offerings: rule.applies_to_offering_ids || [],
      conditions: rule.conditions || {}
    }));

    // Build client context
    const clientContext = {
      name: client.name,
      industry: client.industry,
      region: client.region,
      lifecycle_stage: client.lifecycle_stage,
      value: client.value,
      metadata: client.metadata || {},
      risk_score: client.risk_score,
      sentiment_score: client.sentiment_score,
      insights: client.insights || {},
      summary_history: (client.summary_history || []).slice(-5)
    };

    const workflowContext = workflowInstances.map(w => ({
      workflow_name: w.workflow_name,
      status: w.status,
      created_date: w.created_date
    }));

    // AI Prompt for offering recommendations
    const aiPrompt = `You are an AI business analyst specializing in solution matching and revenue optimization.

**CLIENT PROFILE:**
${JSON.stringify(clientContext, null, 2)}

**WORKFLOW HISTORY:**
${JSON.stringify(workflowContext, null, 2)}

**AVAILABLE OFFERINGS (Products, Services, Concepts):**
${JSON.stringify(offeringsContext.slice(0, 20), null, 2)}

**PRICING RULES CONTEXT:**
${JSON.stringify(pricingContext, null, 2)}

**YOUR TASK:**
Analyze the client's profile, industry, metadata, workflow history, and current lifecycle stage. Then:

1. Identify 3-5 offerings (products/services/concepts) that are HIGHLY RELEVANT to this client
2. For each recommendation, provide:
   - offering_id (from the available offerings)
   - offering_name
   - offering_type (product/service/concept)
   - fit_score (0-100, how well it matches client needs)
   - priority (high/medium/low)
   - reasoning (2-3 sentences explaining WHY this offering fits the client)
   - recommended_action (specific next step, e.g., "Schedule demo", "Send proposal")
   - estimated_value (optional, if you can estimate based on pricing rules and client data)

3. Provide an overall summary (2-3 sentences) explaining the strategic rationale for these recommendations

**CRITERIA FOR RECOMMENDATIONS:**
- Match target_audience to client's industry, size, region
- Consider client's lifecycle_stage (e.g., don't recommend onboarding services to active clients)
- Look for pain points in metadata or insights
- Consider upsell/cross-sell opportunities based on what they DON'T have
- Factor in pricing models that suit their value/budget
- Be specific and actionable

Return your analysis as structured JSON.`;

    const llmResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: aiPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                offering_id: { type: "string" },
                offering_name: { type: "string" },
                offering_type: { type: "string" },
                fit_score: { type: "number" },
                priority: { type: "string" },
                reasoning: { type: "string" },
                recommended_action: { type: "string" },
                estimated_value: { type: "number" }
              }
            }
          },
          offering_summary: { type: "string" }
        },
        required: ["recommendations", "offering_summary"]
      }
    });

    // Update client insights with recommendations
    const updatedInsights = {
      ...(client.insights || {}),
      offering_recommendations: llmResponse.recommendations,
      offering_summary: llmResponse.offering_summary,
      offering_analysis_date: new Date().toISOString()
    };

    await base44.asServiceRole.entities.Client.update(client_id, {
      insights: updatedInsights
    });

    return Response.json({
      success: true,
      recommendations: llmResponse.recommendations,
      summary: llmResponse.offering_summary,
      analyzed_offerings_count: offeringsContext.length
    });

  } catch (error) {
    console.error('AI Suggest Offerings Error:', error);
    return Response.json({ 
      error: error.message,
      details: error.stack 
    }, { status: 500 });
  }
});