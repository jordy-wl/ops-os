-- Phase 4, Sprint 10: E-signature audit trail
-- Stores immutable signature events for click-to-sign compliance (ETA 1999, ASIC)

CREATE TABLE IF NOT EXISTS signature_events (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  document_id           uuid        NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  shared_link_id        uuid        REFERENCES shared_links(id) ON DELETE SET NULL,
  signer_contact_id     uuid        REFERENCES blocks(id) ON DELETE SET NULL,
  signer_email          text,
  signer_name           text,
  event_type            text        NOT NULL CHECK (event_type IN ('viewed', 'consented', 'signed', 'declined')),
  document_hash_sha256  text        NOT NULL,
  consent_text          text,
  ip_address            text,
  user_agent            text,
  occurred_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_signature_events_org ON signature_events(org_id);
CREATE INDEX idx_signature_events_document ON signature_events(document_id);
CREATE INDEX idx_signature_events_link ON signature_events(shared_link_id);

-- Immutable — no UPDATE or DELETE allowed (append-only audit trail)
ALTER TABLE signature_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can insert signature_events"
  ON signature_events FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can select signature_events"
  ON signature_events FOR SELECT
  USING (true);
