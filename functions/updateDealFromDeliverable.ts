import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request payload
    const { deliverableInstanceId, workflowInstanceId, clientId } = await req.json();

    // Validate required parameters
    if (!deliverableInstanceId || !workflowInstanceId || !clientId) {
      return Response.json({ 
        error: 'Missing required parameters: deliverableInstanceId, workflowInstanceId, clientId' 
      }, { status: 400 });
    }

    // 1. Fetch DeliverableInstance
    const deliverableInstances = await base44.entities.DeliverableInstance.filter({ 
      id: deliverableInstanceId 
    });
    const deliverableInstance = deliverableInstances[0];
    
    if (!deliverableInstance) {
      return Response.json({ error: 'DeliverableInstance not found' }, { status: 404 });
    }

    // 2. Fetch DeliverableTemplate for metadata (contains trigger config and critical fields)
    const deliverableTemplates = await base44.entities.DeliverableTemplate.filter({ 
      id: deliverableInstance.deliverable_template_id 
    });
    const deliverableTemplate = deliverableTemplates[0];
    
    // Check if entity update is enabled for this deliverable
    if (!deliverableTemplate?.trigger_entity_update_enabled) {
      return Response.json({ 
        success: false, 
        message: 'Entity update trigger not enabled for this deliverable' 
      });
    }
    
    const targetEntity = deliverableTemplate.target_entity_name || 'Deal';

    // 3. Fetch StageInstance to determine Deal status
    const stageInstances = await base44.entities.StageInstance.filter({
      id: deliverableInstance.stage_instance_id
    });
    const stageInstance = stageInstances[0];

    // 4. Fetch all completed TaskInstances for this workflow
    const taskInstances = await base44.entities.TaskInstance.filter({
      workflow_instance_id: workflowInstanceId,
      status: 'completed'
    });

    // 5. Consolidate field_values from all completed tasks
    const consolidatedData = {};
    
    for (const task of taskInstances) {
      if (task.field_values) {
        // Merge field values, handling arrays appropriately
        for (const [key, value] of Object.entries(task.field_values)) {
          if (Array.isArray(value)) {
            if (!consolidatedData[key]) {
              consolidatedData[key] = [];
            }
            // Deduplicate arrays
            consolidatedData[key] = [...new Set([...consolidatedData[key], ...value])];
          } else if (value !== null && value !== undefined && value !== '') {
            consolidatedData[key] = value;
          }
        }
      }
    }

    // 6. Map consolidated data to Deal entity fields
    const dealData = {
      client_id: clientId,
      name: consolidatedData.deal_name || consolidatedData.opportunity_name || 'Untitled Deal',
      deal_category: consolidatedData.deal_category || 'new_business',
      opportunity_type: consolidatedData.opportunity_type,
      solution: consolidatedData.solution,
      projected_revenue: consolidatedData.projected_revenue,
      currency: consolidatedData.currency || 'USD',
      expected_close_date: consolidatedData.expected_close_date,
      status: consolidatedData.deal_status || 'prospecting',
      pain_points: consolidatedData.pain_points || [],
      desired_outcomes: consolidatedData.desired_outcomes || [],
      current_providers: consolidatedData.current_providers || {},
      market_access_requirements: consolidatedData.market_access_requirements,
      client_price_expectations: consolidatedData.client_price_expectations,
      regulatory_tax_compliance_learnings: consolidatedData.regulatory_tax_compliance_learnings,
      industry_intel: consolidatedData.industry_intel,
      trading_infrastructure_vendor: consolidatedData.trading_infrastructure_vendor,
      decision_makers: consolidatedData.decision_makers || [],
      decision_timeline: consolidatedData.decision_timeline,
      additional_stakeholders: consolidatedData.additional_stakeholders || [],
      key_risks_to_winning: consolidatedData.key_risks_to_winning || [],
      mitigation_strategies: consolidatedData.mitigation_strategies || [],
      client_risk_appetite: consolidatedData.client_risk_appetite,
      contingency_plans: consolidatedData.contingency_plans,
      risk_score: consolidatedData.risk_score,
      competitive_names: consolidatedData.competitive_names || [],
      competitive_strengths: consolidatedData.competitive_strengths || [],
      competitive_weaknesses: consolidatedData.competitive_weaknesses || [],
      value_proposition: consolidatedData.value_proposition,
      our_weakness: consolidatedData.our_weakness || [],
      sales_lead_id: consolidatedData.sales_lead_id,
      proposition_lead_id: consolidatedData.proposition_lead_id,
      subject_matter_experts_assigned: consolidatedData.subject_matter_experts_assigned || [],
      key_internal_risks: consolidatedData.key_internal_risks || [],
      internal_teams: consolidatedData.internal_teams || [],
      business_sponsor_id: consolidatedData.business_sponsor_id,
      enterprise_team_id: consolidatedData.enterprise_team_id,
      key_milestones: consolidatedData.key_milestones || [],
      critical_next_steps: consolidatedData.critical_next_steps,
      communication_plan: consolidatedData.communication_plan,
      stakeholder_update_plan: consolidatedData.stakeholder_update_plan,
      timeline_for_action_items: consolidatedData.timeline_for_action_items,
      next_action_item: consolidatedData.next_action_item,
      competitor_learnings: consolidatedData.competitor_learnings,
      playbook_additions: consolidatedData.playbook_additions,
      consulting_requirements: consolidatedData.consulting_requirements,
      bespoke_customisation_requirements: consolidatedData.bespoke_customisation_requirements,
      other_notes: consolidatedData.other_notes,
      lost_reason: consolidatedData.lost_reason,
      feedback_from_client: consolidatedData.feedback_from_client,
    };

    // Remove undefined/null values to avoid overwriting existing data with nulls
    Object.keys(dealData).forEach(key => {
      if (dealData[key] === undefined || dealData[key] === null) {
        delete dealData[key];
      }
    });

    // 7. Check if entity already exists for this client and workflow
    const existingEntities = await base44.entities[targetEntity].filter({
      client_id: clientId,
      'metadata.workflow_instance_id': workflowInstanceId
    });

    let entity;
    if (existingEntities.length > 0) {
      // Update existing entity - only update fields with new data
      const updateData = {};
      Object.entries(dealData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && 
            (Array.isArray(value) ? value.length > 0 : value !== '')) {
          updateData[key] = value;
        }
      });
      
      entity = await base44.entities[targetEntity].update(existingEntities[0].id, {
        ...updateData,
        metadata: {
          ...existingEntities[0].metadata,
          workflow_instance_id: workflowInstanceId,
          last_updated_from_deliverable: deliverableInstanceId,
          last_updated_at: new Date().toISOString(),
          stage_name: stageInstance?.name
        }
      });
    } else {
      // Create new entity
      entity = await base44.entities[targetEntity].create({
        ...dealData,
        metadata: {
          workflow_instance_id: workflowInstanceId,
          created_from_deliverable: deliverableInstanceId,
          created_at: new Date().toISOString(),
          stage_name: stageInstance?.name
        }
      });
    }

    // 8. Identify missing critical fields
    const criticalFields = deliverableTemplate.critical_fields || [
      'name', 'deal_category', 'opportunity_type', 'solution', 
      'projected_revenue', 'expected_close_date', 'pain_points', 
      'desired_outcomes', 'decision_makers'
    ];

    const missingFields = criticalFields.filter(field => {
      const value = entity[field];
      return !value || (Array.isArray(value) && value.length === 0);
    });

    if (missingFields.length > 0 && targetEntity === 'Deal') {
      await base44.entities[targetEntity].update(entity.id, {
        missing_data_fields: missingFields
      });
    }

    return Response.json({
      success: true,
      entity,
      entityType: targetEntity,
      missingFields,
      tasksProcessed: taskInstances.length,
      message: existingEntities.length > 0 ? `${targetEntity} updated successfully` : `${targetEntity} created successfully`
    });

  } catch (error) {
    console.error('Error in updateDealFromDeliverable:', error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});