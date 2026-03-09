-- ============================================================
-- Migration: 20260309000000_create_block_with_event
-- Atomic block creation with audit event.
-- Ensures a block is never created without its audit trail.
-- ============================================================

CREATE OR REPLACE FUNCTION create_block_with_event(
  p_org_id     UUID,
  p_type       TEXT,
  p_name       TEXT,
  p_metadata   JSONB,
  p_actor_id   TEXT,
  p_actor_type TEXT DEFAULT 'human'
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_block  blocks%ROWTYPE;
  v_event  events%ROWTYPE;
BEGIN
  INSERT INTO blocks (org_id, type, name, metadata)
  VALUES (p_org_id, p_type, p_name, p_metadata)
  RETURNING * INTO v_block;

  INSERT INTO events (org_id, block_id, type, actor_id, actor_type, payload)
  VALUES (
    p_org_id,
    v_block.id,
    'block.created',
    p_actor_id,
    p_actor_type,
    jsonb_build_object('block_type', v_block.type, 'name', v_block.name)
  )
  RETURNING * INTO v_event;

  RETURN jsonb_build_object(
    'block', row_to_json(v_block)::jsonb,
    'event', row_to_json(v_event)::jsonb
  );
END;
$$;
