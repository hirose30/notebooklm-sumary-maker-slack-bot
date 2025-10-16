-- Migration 003: Multi-workspace support
-- Adds slack_installations table and workspace_id to requests

-- New table: Slack workspace installations (OAuth tokens)
CREATE TABLE IF NOT EXISTS slack_installations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id TEXT NOT NULL,
  team_name TEXT,
  enterprise_id TEXT,
  enterprise_name TEXT,
  bot_token TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  bot_scopes TEXT NOT NULL, -- JSON array
  user_token TEXT,
  user_id TEXT,
  user_scopes TEXT, -- JSON array
  installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, enterprise_id)
);

-- Expand: Add workspace_id to existing requests table
-- Nullable for backward compatibility with existing data
ALTER TABLE requests ADD COLUMN workspace_id TEXT;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_workspace_id ON requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_installations_team_id ON slack_installations(team_id);

-- Note: Foreign key constraint not added (SQLite ALTER TABLE limitation)
-- Application code enforces referential integrity
