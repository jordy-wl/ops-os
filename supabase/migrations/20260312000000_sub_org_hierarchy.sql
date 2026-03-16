-- ============================================================
-- Migration: 20260312000000_sub_org_hierarchy
-- Ops OS — Sub-org Hierarchy Support
-- Phase 3, Sprint 2 — BE-03
--
-- Adds parent_org_id (self-referencing FK) and org_level to orgs
-- table to support 4-level hierarchy:
--   org → suborg → department → team
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- Add columns
-- ─────────────────────────────────────────────────────────

ALTER TABLE orgs
  ADD COLUMN IF NOT EXISTS parent_org_id UUID REFERENCES orgs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS org_level TEXT NOT NULL DEFAULT 'org'
    CHECK (org_level IN ('org', 'suborg', 'department', 'team'));

-- Index for tree traversal queries
CREATE INDEX IF NOT EXISTS idx_orgs_parent_org_id ON orgs(parent_org_id);

-- Index for level-based filtering
CREATE INDEX IF NOT EXISTS idx_orgs_org_level ON orgs(org_level);

-- ─────────────────────────────────────────────────────────
-- Depth constraint function
-- Enforces max 4 levels: org(0) → suborg(1) → department(2) → team(3)
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION check_org_depth()
RETURNS TRIGGER AS $$
DECLARE
  depth INT := 0;
  current_parent UUID := NEW.parent_org_id;
BEGIN
  -- Top-level orgs always valid
  IF current_parent IS NULL THEN
    IF NEW.org_level != 'org' THEN
      RAISE EXCEPTION 'Top-level organisations must have org_level = org';
    END IF;
    RETURN NEW;
  END IF;

  -- Walk up the tree counting depth
  WHILE current_parent IS NOT NULL LOOP
    depth := depth + 1;
    IF depth > 3 THEN
      RAISE EXCEPTION 'Organisation hierarchy cannot exceed 4 levels (org → suborg → department → team)';
    END IF;
    SELECT o.parent_org_id INTO current_parent FROM orgs o WHERE o.id = current_parent;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_org_depth
  BEFORE INSERT OR UPDATE OF parent_org_id ON orgs
  FOR EACH ROW
  EXECUTE FUNCTION check_org_depth();

-- ─────────────────────────────────────────────────────────
-- Hierarchy query helper (recursive CTE)
-- Returns the full sub-tree rooted at a given org
-- ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_org_hierarchy(root_org_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  org_level TEXT,
  parent_org_id UUID,
  depth INT
) AS $$
  WITH RECURSIVE tree AS (
    SELECT o.id, o.name, o.slug, o.org_level, o.parent_org_id, 0 AS depth
    FROM orgs o
    WHERE o.id = root_org_id

    UNION ALL

    SELECT o.id, o.name, o.slug, o.org_level, o.parent_org_id, t.depth + 1
    FROM orgs o
    JOIN tree t ON o.parent_org_id = t.id
    WHERE t.depth < 3  -- safety cap
  )
  SELECT * FROM tree ORDER BY depth, name;
$$ LANGUAGE sql STABLE;
