-- Portal Builder: template support + form_template_ids
-- Phase 7B: Portal Builder UX Redesign

-- 1. Make client_block_id nullable (templates have no client)
ALTER TABLE portal_configurations ALTER COLUMN client_block_id DROP NOT NULL;

-- 2. Template flag
ALTER TABLE portal_configurations ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

-- 3. Form template IDs (templates can't use block_edges since no client yet)
ALTER TABLE portal_configurations ADD COLUMN IF NOT EXISTS form_template_ids uuid[] DEFAULT NULL;

-- 4. Replace UNIQUE(org_id, client_block_id) with partial index
ALTER TABLE portal_configurations DROP CONSTRAINT IF EXISTS portal_configurations_org_id_client_block_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_portal_config_org_client
  ON portal_configurations (org_id, client_block_id) WHERE client_block_id IS NOT NULL;

-- 5. Template lookup index
CREATE INDEX IF NOT EXISTS idx_portal_configurations_template
  ON portal_configurations (org_id) WHERE is_template = true;
