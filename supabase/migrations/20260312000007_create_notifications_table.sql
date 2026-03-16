-- Migration: create_notifications_table
-- Phase 3 Sprint 7 — Notification system foundation (P3-S7-BE-02)

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  block_id uuid REFERENCES blocks(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Composite index for efficient listing: user's unread notifications, sorted by recency
CREATE INDEX idx_notifications_user ON notifications(org_id, user_id, read);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can view notifications in their own org
CREATE POLICY "Users can view own org notifications"
  ON notifications FOR SELECT
  USING (org_id IN (SELECT id FROM orgs));

-- Users can update (mark read) notifications in their own org
CREATE POLICY "Users can update own org notifications"
  ON notifications FOR UPDATE
  USING (org_id IN (SELECT id FROM orgs));

-- System/service role can insert notifications (no user-facing INSERT)
CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);
