-- ============================================================
-- Migration: 20260326000001_org_hierarchy_block_types
-- Ops OS — Org Hierarchy Block Types + get_block_hierarchy RPC
-- Phase 7 — Org Hierarchy as Blocks
--
-- 1. Seeds division, department, team type definitions for all existing orgs
-- 2. Adds team_id field to team_member field_schema
-- 3. Creates get_block_hierarchy() RPC for recursive tree traversal
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- 1. Seed division, department, team types for every existing org
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
    'division',
    'Division',
    'A major division or business unit within the organisation.',
    'building',
    'indigo',
    '{"type":"object","x-org-hierarchy-level":1,"x-org-parent-type":"organisation","x-field-groups":[{"id":"basics","label":"Basics","order":1},{"id":"leadership","label":"Leadership","order":2},{"id":"operations","label":"Operations","order":3}],"properties":{"description":{"type":"string","x-field-type":"rich-text","description":"Division purpose and scope","x-field-group":"basics","x-display-order":1},"parent_org":{"type":"string","description":"Parent organisation block","x-field-type":"relation","x-relation-target":"organisation","x-relation-edge-type":"part_of","x-field-group":"basics","x-display-order":2},"head":{"type":"string","description":"Division head (team member)","x-field-type":"relation","x-relation-target":"team_member","x-relation-edge-type":"has_head","x-field-group":"leadership","x-display-order":1},"location":{"type":"string","description":"Primary office location","x-field-group":"operations","x-display-order":1},"cost_centre":{"type":"string","description":"Cost centre code","x-field-group":"operations","x-display-order":2},"budget":{"type":"number","minimum":0,"description":"Annual budget allocation","x-field-type":"currency","x-field-group":"operations","x-display-order":3}}}'
  ),
  (
    'department',
    'Department',
    'A department within a division.',
    'folders',
    'violet',
    '{"type":"object","x-org-hierarchy-level":2,"x-org-parent-type":"division","x-field-groups":[{"id":"basics","label":"Basics","order":1},{"id":"leadership","label":"Leadership","order":2},{"id":"compliance","label":"Compliance","order":3}],"properties":{"description":{"type":"string","x-field-type":"rich-text","description":"Department purpose and scope","x-field-group":"basics","x-display-order":1},"parent_division":{"type":"string","description":"Parent division","x-field-type":"relation","x-relation-target":"division","x-relation-edge-type":"part_of","x-field-group":"basics","x-display-order":2},"head":{"type":"string","description":"Department head (team member)","x-field-type":"relation","x-relation-target":"team_member","x-relation-edge-type":"has_head","x-field-group":"leadership","x-display-order":1},"deputy_head":{"type":"string","description":"Deputy department head (team member)","x-field-type":"relation","x-relation-target":"team_member","x-relation-edge-type":"has_deputy","x-field-group":"leadership","x-display-order":2},"jurisdiction":{"type":"string","enum":["AU","US","GB","SG","HK","NZ","JP","DE","FR","CA","global"],"description":"Primary jurisdiction","x-field-group":"compliance","x-display-order":1},"compliance_notes":{"type":"string","x-field-type":"rich-text","description":"Compliance requirements and notes","x-field-group":"compliance","x-display-order":2}}}'
  ),
  (
    'team',
    'Team',
    'A team within a department.',
    'users',
    'cyan',
    '{"type":"object","x-org-hierarchy-level":3,"x-org-parent-type":"department","x-field-groups":[{"id":"basics","label":"Basics","order":1},{"id":"leadership","label":"Leadership","order":2},{"id":"capacity","label":"Capacity","order":3}],"properties":{"description":{"type":"string","x-field-type":"rich-text","description":"Team purpose and scope","x-field-group":"basics","x-display-order":1},"parent_department":{"type":"string","description":"Parent department","x-field-type":"relation","x-relation-target":"department","x-relation-edge-type":"part_of","x-field-group":"basics","x-display-order":2},"team_lead":{"type":"string","description":"Team lead (team member)","x-field-type":"relation","x-relation-target":"team_member","x-relation-edge-type":"has_lead","x-field-group":"leadership","x-display-order":1},"members":{"type":"array","items":{"type":"string"},"description":"Team members","x-field-type":"multi-relation","x-relation-target":"team_member","x-relation-edge-type":"has_member","x-field-group":"capacity","x-display-order":1},"capacity_notes":{"type":"string","x-field-type":"rich-text","description":"Current capacity and workload notes","x-field-group":"capacity","x-display-order":2}}}'
  )
) AS t(type_name, display_name, description, icon, color, field_schema)
WHERE o.parent_org_id IS NULL  -- only top-level orgs
ON CONFLICT (org_id, type_name) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- 2. Add team_id field to existing team_member type definitions
-- ─────────────────────────────────────────────────────────

UPDATE block_type_definitions
SET field_schema = jsonb_set(
  field_schema,
  '{properties,team_id}',
  '{"type":"string","description":"Primary team assignment","x-field-type":"relation","x-relation-target":"team","x-relation-edge-type":"member_of","x-field-group":"organisation","x-display-order":3}'::jsonb
)
WHERE type_name = 'team_member' AND is_system = true
  AND field_schema->'properties'->'team_id' IS NULL;

-- ─────────────────────────────────────────────────────────
-- 3. get_block_hierarchy() RPC
-- Recursive CTE traversing block_edges with edge_type = 'part_of'
-- Returns the full org hierarchy tree from the org singleton block.
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_block_hierarchy(p_org_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  block_type TEXT,
  metadata JSONB,
  parent_id UUID,
  depth INT
) AS $$
  WITH RECURSIVE tree AS (
    -- Root: the organisation singleton block
    SELECT b.id, b.name, b.type AS block_type, b.metadata,
           NULL::UUID AS parent_id, 0 AS depth
    FROM blocks b
    WHERE b.org_id = p_org_id
      AND b.type = 'organisation'
      AND b.state = 'active'
    LIMIT 1

    UNION ALL

    -- Children: blocks connected via 'part_of' edges
    -- Edge direction: from_block_id = child, to_block_id = parent
    SELECT b.id, b.name, b.type AS block_type, b.metadata,
           be.to_block_id AS parent_id, t.depth + 1
    FROM blocks b
    JOIN block_edges be ON b.id = be.from_block_id
    JOIN tree t ON be.to_block_id = t.id
    WHERE be.edge_type = 'part_of'
      AND be.org_id = p_org_id
      AND b.state = 'active'
      AND t.depth < 4  -- safety cap: org(0) → division(1) → department(2) → team(3)
  )
  SELECT * FROM tree ORDER BY depth, name;
$$ LANGUAGE sql STABLE;
