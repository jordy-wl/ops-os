-- Fix: performance_snapshots was missing RLS
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "performance_snapshots_all" ON performance_snapshots
  FOR ALL USING (true) WITH CHECK (true);
