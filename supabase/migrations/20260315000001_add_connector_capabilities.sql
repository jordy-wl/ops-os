-- ============================================================
-- Migration: 20260315000001_add_connector_capabilities
-- Add capabilities, health_status, and last_health_check to
-- integration_connectors for health monitoring and capability model.
-- Phase 5, Sprint 17 — BE-02
-- ============================================================

ALTER TABLE integration_connectors
  ADD COLUMN capabilities     JSONB       DEFAULT '{}',
  ADD COLUMN health_status    TEXT        DEFAULT 'unknown',
  ADD COLUMN last_health_check TIMESTAMPTZ;

-- Constrain health_status values
ALTER TABLE integration_connectors
  ADD CONSTRAINT integration_connectors_health_check
    CHECK (health_status IN ('healthy', 'degraded', 'unhealthy', 'unknown'));
