-- ============================================================
-- Migration: 20260312000001_seed_new_block_types
-- Ops OS — Seed 5 New System Block Types for Existing Orgs
-- Phase 3, Sprint 2 — BE-04
--
-- Inserts solution, product, service, team_member, policy
-- into block_type_definitions for all existing orgs.
-- Uses ON CONFLICT DO NOTHING for idempotency.
--
-- Also updates contact type with enriched field_schema for
-- existing orgs (BE-02).
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- Insert 5 new types for every existing org
-- ─────────────────────────────────────────────────────────

INSERT INTO block_type_definitions (org_id, type_name, display_name, description, icon, color, is_system, field_schema)
SELECT
  o.id,
  t.type_name,
  t.display_name,
  t.description,
  t.icon,
  t.color,
  true,
  t.field_schema::jsonb
FROM orgs o
CROSS JOIN (VALUES
  (
    'solution',
    'Solution',
    'A packaged solution combining products and services for a client need.',
    'lightbulb',
    'blue',
    '{"type":"object","properties":{"status":{"type":"string","enum":["draft","active","deprecated","archived"],"description":"Solution lifecycle status"},"category":{"type":"string","description":"Solution category (e.g., compliance, advisory)"},"target_industry":{"type":"string","description":"Primary target industry vertical"},"key_features":{"type":"array","items":{"type":"string"},"description":"Key features or capabilities"},"pricing_model":{"type":"string","enum":["fixed","hourly","retainer","subscription","hybrid"],"description":"Pricing model for this solution"},"product_refs":{"type":"array","items":{"type":"string"},"description":"Block IDs of included products"},"service_refs":{"type":"array","items":{"type":"string"},"description":"Block IDs of included services"}}}'
  ),
  (
    'product',
    'Product',
    'A tangible or digital product offered by the organisation.',
    'package',
    'green',
    '{"type":"object","properties":{"version":{"type":"string","description":"Product version or edition"},"status":{"type":"string","enum":["draft","active","discontinued","archived"],"description":"Product lifecycle status"},"sku":{"type":"string","description":"Stock keeping unit or product code"},"category":{"type":"string","description":"Product category"},"unit_price":{"type":"number","minimum":0,"description":"Unit price in base currency"},"currency":{"type":"string","maxLength":3,"description":"ISO 4217 currency code (e.g., AUD, USD)"},"availability_date":{"type":"string","description":"Available from date (YYYY-MM-DD)"}}}'
  ),
  (
    'service',
    'Service',
    'A professional service offered by the organisation.',
    'wrench',
    'purple',
    '{"type":"object","properties":{"service_type":{"type":"string","enum":["consulting","advisory","managed","implementation","support","training"],"description":"Type of service"},"delivery_model":{"type":"string","enum":["onsite","remote","hybrid"],"description":"Service delivery model"},"sla_tier":{"type":"string","enum":["standard","premium","enterprise"],"description":"Service level agreement tier"},"hourly_rate":{"type":"number","minimum":0,"description":"Hourly rate in base currency"},"currency":{"type":"string","maxLength":3,"description":"ISO 4217 currency code (e.g., AUD, USD)"},"engagement_type":{"type":"string","enum":["project","retainer","ad_hoc","subscription"],"description":"Engagement billing model"}}}'
  ),
  (
    'team_member',
    'Team Member',
    'A person who is part of the organisation team.',
    'user-circle',
    'orange',
    '{"type":"object","properties":{"email":{"type":"string","format":"email","description":"Work email address"},"role_title":{"type":"string","description":"Job title or role name"},"department":{"type":"string","description":"Department or division"},"reporting_to":{"type":"string","description":"Block ID of the manager (team_member block)"},"start_date":{"type":"string","description":"Start date (YYYY-MM-DD)"},"status":{"type":"string","enum":["active","on_leave","offboarding","inactive"],"description":"Employment status"},"clerk_user_id":{"type":"string","description":"Clerk user ID for auth linkage"}}}'
  ),
  (
    'policy',
    'Policy',
    'An organisational policy governing routing, compliance, or operational rules.',
    'shield',
    'red',
    '{"type":"object","properties":{"policy_type":{"type":"string","enum":["routing","compliance","operational","security","approval"],"description":"Type of policy"},"effective_date":{"type":"string","description":"Effective from date (YYYY-MM-DD)"},"review_date":{"type":"string","description":"Next review date (YYYY-MM-DD)"},"status":{"type":"string","enum":["draft","active","under_review","superseded","archived"],"description":"Policy status"},"approval_required":{"type":"boolean","description":"Whether actions under this policy require approval"},"jurisdiction":{"type":"string","enum":["AU","US","GB","SG","HK","NZ","JP","DE","FR","CA","global"],"description":"Applicable jurisdiction (ISO 3166-1 alpha-2 or global)"},"thresholds":{"type":"object","properties":{"confidence_min":{"type":"number","minimum":0,"maximum":1,"description":"Minimum AI confidence for auto-routing"},"risk_max":{"type":"string","enum":["low","medium","high","critical"],"description":"Maximum risk level for auto-routing"}},"description":"Policy thresholds for routing decisions"},"routing_rules":{"type":"array","items":{"type":"object","properties":{"risk_level":{"type":"string","enum":["low","medium","high","critical"]},"routing_mode":{"type":"string","enum":["human","agent","auto"]}}},"description":"Risk-to-routing mapping rules"}}}'
  )
) AS t(type_name, display_name, description, icon, color, field_schema)
ON CONFLICT (org_id, type_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- Update contact field_schema for existing orgs (BE-02)
-- Adds: response_time_sla, communication_preference,
--        signature_template, preferred_contact_method,
--        timezone, notes
-- ─────────────────────────────────────────────────────────

UPDATE block_type_definitions
SET field_schema = '{
  "type": "object",
  "properties": {
    "role": {"type": "string", "description": "Role or title"},
    "email": {"type": "string", "format": "email", "description": "Email address"},
    "phone": {"type": "string", "description": "Phone number"},
    "response_time_sla": {"type": "string", "enum": ["1h", "4h", "8h", "24h", "48h"], "description": "Expected response time SLA"},
    "communication_preference": {"type": "string", "enum": ["email", "phone", "slack", "teams"], "description": "Preferred communication channel"},
    "signature_template": {"type": "string", "maxLength": 2000, "description": "Email signature template (HTML or markdown)"},
    "preferred_contact_method": {"type": "string", "enum": ["email", "phone", "in_person", "video_call"], "description": "Preferred method of contact"},
    "timezone": {"type": "string", "maxLength": 50, "description": "IANA timezone (e.g. Australia/Sydney)"},
    "notes": {"type": "string", "maxLength": 5000, "description": "Free-form notes about this contact"}
  }
}'::jsonb
WHERE type_name = 'contact' AND is_system = true;
