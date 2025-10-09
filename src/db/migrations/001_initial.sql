-- Initial database schema for NotebookLM Slack Bot
-- SQLite database for request tracking and simple queue

-- Requests table: Track all NotebookLM processing requests
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  slack_channel TEXT NOT NULL,
  slack_thread_ts TEXT NOT NULL,
  slack_user TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  progress INTEGER DEFAULT 0, -- 0-100
  current_step TEXT,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME
);

-- Media table: Track generated audio/video files
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  media_type TEXT NOT NULL, -- audio, video
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  r2_public_url TEXT NOT NULL,
  file_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME, -- 7 days from creation
  FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_media_request_id ON media(request_id);
CREATE INDEX IF NOT EXISTS idx_media_expires_at ON media(expires_at);
