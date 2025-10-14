-- Add acknowledgment message timestamp for cleanup feature
-- Nullable to support existing requests created before this feature

ALTER TABLE requests ADD COLUMN ack_message_ts TEXT;
