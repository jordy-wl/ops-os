import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { ai_output, expected_schema, validation_type = 'hallucination_check' } = await req.json();

  if (!ai_output) {
    return Response.json({ error: 'Missing ai_output' }, { status: 400 });
  }

  let validationResult = { is_valid: true, issues: [] };

  // Hallucination detection
  if (validation_type === 'hallucination_check') {
    const outputStr = typeof ai_output === 'string' ? ai_output : JSON.stringify(ai_output);

    // Check for common hallucination patterns
    const hallucinationPatterns = [
      { pattern: /\[INSERT.*?\]/gi, issue: 'Contains placeholder text' },
      { pattern: /TODO|FIXME/gi, issue: 'Contains TODO/FIXME markers' },
      { pattern: /\{\{.*?\}\}/g, issue: 'Contains unresolved template variables' },
      { pattern: /Lorem ipsum/gi, issue: 'Contains Lorem ipsum placeholder' }
    ];

    for (const { pattern, issue } of hallucinationPatterns) {
      if (pattern.test(outputStr)) {
        validationResult.is_valid = false;
        validationResult.issues.push(issue);
      }
    }

    // Check for suspicious phrases that indicate uncertainty
    const uncertainPhrases = [
      'I cannot', 'I am not sure', 'I do not have', 'I apologize',
      'no information', 'not available', 'unable to'
    ];

    for (const phrase of uncertainPhrases) {
      if (outputStr.toLowerCase().includes(phrase.toLowerCase())) {
        validationResult.issues.push(`AI expressed uncertainty: "${phrase}"`);
      }
    }
  }

  // Schema validation
  if (validation_type === 'schema_check' && expected_schema) {
    try {
      const outputObj = typeof ai_output === 'string' ? JSON.parse(ai_output) : ai_output;
      
      // Basic schema validation (check required fields)
      if (expected_schema.required && Array.isArray(expected_schema.required)) {
        for (const requiredField of expected_schema.required) {
          if (!(requiredField in outputObj)) {
            validationResult.is_valid = false;
            validationResult.issues.push(`Missing required field: ${requiredField}`);
          }
        }
      }

      // Check property types if defined
      if (expected_schema.properties) {
        for (const [key, propSchema] of Object.entries(expected_schema.properties)) {
          if (key in outputObj) {
            const actualType = Array.isArray(outputObj[key]) ? 'array' : typeof outputObj[key];
            if (propSchema.type && actualType !== propSchema.type) {
              validationResult.is_valid = false;
              validationResult.issues.push(`Type mismatch for ${key}: expected ${propSchema.type}, got ${actualType}`);
            }
          }
        }
      }
    } catch (error) {
      validationResult.is_valid = false;
      validationResult.issues.push(`JSON parsing error: ${error.message}`);
    }
  }

  // Data integrity validation
  if (validation_type === 'integrity_check') {
    const outputObj = typeof ai_output === 'string' ? JSON.parse(ai_output) : ai_output;
    
    // Check for suspiciously empty values
    const checkEmptyValues = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (value === null || value === undefined || value === '') {
          validationResult.issues.push(`Empty value at ${currentPath}`);
        } else if (typeof value === 'object' && !Array.isArray(value)) {
          checkEmptyValues(value, currentPath);
        }
      }
    };

    try {
      checkEmptyValues(outputObj);
    } catch (error) {
      validationResult.issues.push(`Integrity check error: ${error.message}`);
    }
  }

  // Log validation result
  await base44.asServiceRole.entities.Event.create({
    event_type: 'field_validation_failed',
    source_entity_type: 'ai_output',
    source_entity_id: 'validation',
    actor_type: 'system',
    payload: {
      validation_type,
      is_valid: validationResult.is_valid,
      issues_count: validationResult.issues.length
    },
    occurred_at: new Date().toISOString()
  });

  return Response.json({ 
    success: true, 
    validation: validationResult 
  });
});