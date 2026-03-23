-- Deduplicate existing edges (keep newest by id)
DELETE FROM block_edges a USING block_edges b
WHERE a.id < b.id
  AND a.org_id = b.org_id
  AND a.from_block_id = b.from_block_id
  AND a.to_block_id = b.to_block_id
  AND a.edge_type = b.edge_type;

-- Unique constraint for field-driven edge upsert
ALTER TABLE block_edges
  ADD CONSTRAINT block_edges_unique_triple
  UNIQUE (org_id, from_block_id, to_block_id, edge_type);

-- Track which relation field created this edge (NULL = manually created)
ALTER TABLE block_edges
  ADD COLUMN IF NOT EXISTS source_field TEXT DEFAULT NULL;

-- Index for fast cleanup when a relation field is cleared
CREATE INDEX IF NOT EXISTS idx_block_edges_source_field
  ON block_edges(from_block_id, source_field)
  WHERE source_field IS NOT NULL;
