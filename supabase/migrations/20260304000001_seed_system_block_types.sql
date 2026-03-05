-- Seed system block types for all existing orgs — P2-S4-DE-01
-- New orgs get system types via seedSystemBlockTypes() in resolve-org.ts.
-- This migration backfills existing orgs.

INSERT INTO block_type_definitions (org_id, type_name, display_name, description, field_schema, icon, color, is_system)
SELECT o.id, t.type_name, t.display_name, t.description, t.field_schema::jsonb, t.icon, t.color, true
FROM orgs o
CROSS JOIN (VALUES
  ('client', 'Client', 'A client entity — company or individual your firm services.', '{"type":"object","properties":{"jurisdiction":{"type":"string","enum":["AU","US","GB","SG","HK","NZ","JP","DE","FR","CA"],"description":"Primary jurisdiction (ISO 3166-1 alpha-2)"},"entity_type":{"type":"string","enum":["individual","company","trust","partnership","government"],"description":"Legal entity classification"},"incorporation_date":{"type":"string","description":"Date of incorporation (YYYY-MM-DD)"}}}', 'building', 'blue'),
  ('deal', 'Deal', 'A business deal or opportunity being tracked.', '{"type":"object","properties":{"deal_value":{"type":"number","minimum":0,"description":"Deal value in base currency"},"stage":{"type":"string","enum":["prospect","qualified","proposal","negotiation","closed_won","closed_lost"],"description":"Current deal stage"},"expected_close":{"type":"string","description":"Expected close date (YYYY-MM-DD)"}}}', 'handshake', 'green'),
  ('project', 'Project', 'A project or engagement being delivered.', '{"type":"object","properties":{"status":{"type":"string","enum":["planning","in_progress","on_hold","completed","cancelled"],"description":"Project status"},"priority":{"type":"string","enum":["low","medium","high","critical"],"description":"Priority level"},"due_date":{"type":"string","description":"Due date (YYYY-MM-DD)"}}}', 'folder', 'purple'),
  ('contact', 'Contact', 'A person associated with a client or deal.', '{"type":"object","properties":{"role":{"type":"string","description":"Role or title"},"email":{"type":"string","format":"email","description":"Email address"},"phone":{"type":"string","description":"Phone number"}}}', 'user', 'gray'),
  ('contract', 'Contract', 'A legal contract or agreement.', '{"type":"object","properties":{"contract_type":{"type":"string","enum":["service_agreement","nda","sow","msa","amendment","addendum"],"description":"Type of contract"},"effective_date":{"type":"string","description":"Effective date (YYYY-MM-DD)"},"expiry_date":{"type":"string","description":"Expiry date (YYYY-MM-DD)"},"value":{"type":"number","minimum":0,"description":"Contract value in base currency"}}}', 'file-text', 'amber')
) AS t(type_name, display_name, description, field_schema, icon, color)
ON CONFLICT (org_id, type_name) DO NOTHING;
