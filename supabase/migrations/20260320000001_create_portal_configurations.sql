-- Portal Configurations: per-client portal setup linking to shared_links
-- Phase 7A: Portal Foundation

-- 1. Create portal_configurations table
CREATE TABLE IF NOT EXISTS portal_configurations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  client_block_id     uuid NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  name                text NOT NULL,
  dashboard_enabled   boolean NOT NULL DEFAULT true,
  documents_enabled   boolean NOT NULL DEFAULT true,
  requests_enabled    boolean NOT NULL DEFAULT true,
  forms_enabled       boolean NOT NULL DEFAULT true,
  exposed_block_types text[] NOT NULL DEFAULT '{}',
  exposed_block_ids   uuid[] DEFAULT NULL,
  branding_overrides  jsonb DEFAULT NULL,
  shared_link_id      uuid REFERENCES shared_links(id) ON DELETE SET NULL,
  is_active           boolean NOT NULL DEFAULT true,
  created_by          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, client_block_id)
);

-- 2. Add portal_config_id to shared_links
ALTER TABLE shared_links ADD COLUMN IF NOT EXISTS portal_config_id uuid REFERENCES portal_configurations(id) ON DELETE SET NULL;

-- 3. Update shared_links share_type CHECK to include 'portal'
ALTER TABLE shared_links DROP CONSTRAINT IF EXISTS shared_links_share_type_check;
ALTER TABLE shared_links ADD CONSTRAINT shared_links_share_type_check CHECK (share_type IN ('view', 'submit', 'sign', 'portal'));

-- 4. Add form_template_id to form_submissions
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS form_template_id uuid REFERENCES blocks(id) ON DELETE SET NULL;

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_portal_configurations_org ON portal_configurations(org_id);
CREATE INDEX IF NOT EXISTS idx_portal_configurations_client ON portal_configurations(client_block_id);
CREATE INDEX IF NOT EXISTS idx_portal_configurations_link ON portal_configurations(shared_link_id);

-- 6. RLS
ALTER TABLE portal_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "portal_configurations_all" ON portal_configurations FOR ALL USING (true) WITH CHECK (true);
