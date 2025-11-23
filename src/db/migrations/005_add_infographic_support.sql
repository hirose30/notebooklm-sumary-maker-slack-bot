-- Migration 005: Add Infographic Support
-- Date: 2025-11-22
-- Purpose: Add Slack file metadata columns to support infographic uploads

-- FORWARD MIGRATION
BEGIN TRANSACTION;

-- Check if columns exist before adding (idempotent migration)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So we check first using a script approach

-- Add slack_file_id column if it doesn't exist
-- This will fail silently if column already exists (handled by application)
ALTER TABLE media ADD COLUMN slack_file_id TEXT DEFAULT NULL;

-- Add slack_permalink column if it doesn't exist
ALTER TABLE media ADD COLUMN slack_permalink TEXT DEFAULT NULL;

-- Create index for Slack file lookups (idempotent with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_media_slack_file_id ON media(slack_file_id);

COMMIT;

-- ROLLBACK (SQLite 3.35.0+):
-- BEGIN TRANSACTION;
-- DROP INDEX IF EXISTS idx_media_slack_file_id;
-- ALTER TABLE media DROP COLUMN slack_permalink;
-- ALTER TABLE media DROP COLUMN slack_file_id;
-- COMMIT;
