-- Migration 005: Add Infographic Support
-- Date: 2025-11-22
-- Purpose: Add Slack file metadata columns to support infographic uploads

-- FORWARD MIGRATION
BEGIN TRANSACTION;

-- Add Slack file metadata columns (NULL allowed, no backfill needed)
ALTER TABLE media ADD COLUMN slack_file_id TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN slack_permalink TEXT DEFAULT NULL;

-- Create index for Slack file lookups
CREATE INDEX IF NOT EXISTS idx_media_slack_file_id ON media(slack_file_id);

COMMIT;

-- ROLLBACK (SQLite 3.35.0+):
-- BEGIN TRANSACTION;
-- DROP INDEX IF EXISTS idx_media_slack_file_id;
-- ALTER TABLE media DROP COLUMN slack_permalink;
-- ALTER TABLE media DROP COLUMN slack_file_id;
-- COMMIT;
