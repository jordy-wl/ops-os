-- Block Type Definitions — P2-S4-BE-02
-- Custom block type schemas with JSON Schema field validation.
-- Each org can define custom block types; system types are seeded per-org.

CREATE TABLE block_type_definitions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES orgs(id),
  type_name    TEXT        NOT NULL,
  display_name TEXT        NOT NULL,
  description  TEXT,
  field_schema JSONB       NOT NULL DEFAULT '{}',
  icon         TEXT        DEFAULT 'box',
  color        TEXT        DEFAULT 'gray',
  is_system    BOOLEAN     DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, type_name)
);

-- RLS (defense-in-depth; API routes enforce org isolation via withAuth)
ALTER TABLE block_type_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON block_type_definitions
  FOR ALL USING (org_id = current_setting('app.current_org_id', true)::uuid);

-- Service role bypasses RLS (used by our API routes)
CREATE POLICY "service_role_bypass" ON block_type_definitions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Index for type lookups
CREATE INDEX idx_btd_org_type ON block_type_definitions(org_id, type_name);
