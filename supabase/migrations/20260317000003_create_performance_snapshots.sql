-- Performance snapshots: weekly aggregated metrics per user per org
-- Used by the performance dashboard + team utilization APIs

CREATE TABLE IF NOT EXISTS performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  tasks_completed INTEGER NOT NULL DEFAULT 0,
  tasks_on_time INTEGER NOT NULL DEFAULT 0,
  tasks_overdue INTEGER NOT NULL DEFAULT 0,
  total_time_seconds INTEGER NOT NULL DEFAULT 0,
  billable_time_seconds INTEGER NOT NULL DEFAULT 0,
  workflows_completed INTEGER NOT NULL DEFAULT 0,
  workflows_failed INTEGER NOT NULL DEFAULT 0,
  avg_task_completion_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One snapshot per user per week per org
CREATE UNIQUE INDEX idx_perf_snapshots_unique
  ON performance_snapshots(org_id, user_id, period_start);

CREATE INDEX idx_perf_snapshots_lookup
  ON performance_snapshots(org_id, user_id, period_start DESC);

-- Task deadlines view: extracts deadline metadata from task_queue_item blocks
CREATE OR REPLACE VIEW task_deadlines_v AS
SELECT
  id,
  org_id,
  metadata->>'assigned_to' AS assigned_to,
  metadata->>'status' AS status,
  (metadata->>'deadline')::timestamptz AS deadline_at,
  created_at,
  updated_at
FROM blocks
WHERE type = 'task_queue_item'
  AND metadata->>'deadline' IS NOT NULL;
