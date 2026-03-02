-- ============================================================
-- Migration: 20260302000003_workflow_engine
-- Ops OS — Workflow Engine Support
-- Phase 1, Sprint 2 — BE-01
--
-- Adds: attempts column, claim_workflow_job() RPC function
-- ============================================================

-- Add attempt counter. Incremented on each failure; used to enforce 3-strike limit.
ALTER TABLE workflow_jobs ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────
-- claim_workflow_job()
--
-- Atomically claims the next pending job using FOR UPDATE SKIP LOCKED.
-- This prevents two concurrent engine calls from claiming the same job.
--
-- Returns the claimed job row (with status = 'running') or empty set
-- if no jobs are pending or all pending jobs are locked by another caller.
-- ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_workflow_job()
RETURNS SETOF workflow_jobs
LANGUAGE sql
AS $$
  UPDATE workflow_jobs
  SET
    status     = 'running',
    started_at = NOW(),
    updated_at = NOW()
  WHERE id = (
    SELECT id
    FROM   workflow_jobs
    WHERE  status       = 'pending'
      AND  scheduled_at <= NOW()
    ORDER  BY scheduled_at ASC
    LIMIT  1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$;
