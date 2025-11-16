-- Migration 004: Add ui_version column to slack_installations table
-- Feature 008-notebooklm-ui-ui: Support per-workspace UI version configuration

-- Add ui_version column to slack_installations table
-- Default to 'old' for backward compatibility (FR-008)
ALTER TABLE slack_installations ADD COLUMN ui_version TEXT DEFAULT 'old' CHECK (ui_version IN ('old', 'new'));

-- Update existing rows to have 'old' as default
UPDATE slack_installations SET ui_version = 'old' WHERE ui_version IS NULL;
