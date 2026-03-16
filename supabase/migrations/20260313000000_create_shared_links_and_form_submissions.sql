-- Phase 4, Sprint 10: Client Portal + Interactive Forms
-- Creates shared_links for token-authenticated public access
-- and form_submissions for storing form responses

-- ===== shared_links =====
CREATE TABLE IF NOT EXISTS shared_links (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  block_id      uuid        NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  token         text        NOT NULL UNIQUE,
  share_type    text        NOT NULL CHECK (share_type IN ('view', 'submit', 'sign')),
  permissions   jsonb       NOT NULL DEFAULT '{}',
  form_schema   jsonb,
  expires_at    timestamptz NOT NULL,
  created_by    text        NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shared_links_org ON shared_links(org_id);
CREATE INDEX idx_shared_links_block ON shared_links(block_id);
CREATE INDEX idx_shared_links_token ON shared_links(token);

ALTER TABLE shared_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage shared_links"
  ON shared_links FOR ALL
  USING (true)
  WITH CHECK (true);

-- ===== form_submissions =====
CREATE TABLE IF NOT EXISTS form_submissions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  shared_link_id  uuid        NOT NULL REFERENCES shared_links(id) ON DELETE CASCADE,
  block_id        uuid        NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  contact_id      uuid        REFERENCES blocks(id) ON DELETE SET NULL,
  field_data      jsonb       NOT NULL DEFAULT '{}',
  respondent_name text,
  respondent_email text,
  ip_address      text,
  submitted_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_submissions_org ON form_submissions(org_id);
CREATE INDEX idx_form_submissions_link ON form_submissions(shared_link_id);
CREATE INDEX idx_form_submissions_block ON form_submissions(block_id);

ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage form_submissions"
  ON form_submissions FOR ALL
  USING (true)
  WITH CHECK (true);
