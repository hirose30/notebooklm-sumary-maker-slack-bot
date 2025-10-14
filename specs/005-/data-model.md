# Data Model: Slack メッセージクリーンアップと通知改善

**Feature**: 005-
**Date**: 2025-10-15
**Status**: Draft

## Overview

This feature extends the existing `requests` table to track acknowledgment message timestamps for deletion purposes. No new entities are introduced.

## Entity: Request (Modified)

**Description**: Represents a single NotebookLM processing request from Slack. Extended to include acknowledgment message tracking.

### Fields

| Field Name | Type | Constraints | Description |
|------------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique request identifier |
| `url` | TEXT | NOT NULL | Source URL to process |
| `slack_channel` | TEXT | NOT NULL | Slack channel ID where request originated |
| `slack_thread_ts` | TEXT | NOT NULL | Thread timestamp for posting replies |
| `slack_user` | TEXT | NOT NULL | User who made the request |
| `status` | TEXT | NOT NULL, DEFAULT 'pending' | Current status: pending, processing, completed, failed |
| `progress` | INTEGER | DEFAULT 0 | Processing progress (0-100) |
| `current_step` | TEXT | NULLABLE | Current processing step description |
| `error_message` | TEXT | NULLABLE | Error details if status = 'failed' |
| `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Request creation time |
| `started_at` | DATETIME | NULLABLE | Processing start time |
| `completed_at` | DATETIME | NULLABLE | Processing completion time |
| **`ack_message_ts`** | **TEXT** | **NULLABLE** | **[NEW] Acknowledgment message timestamp for deletion** |

### New Field Details

**`ack_message_ts`**:
- **Type**: TEXT (Slack timestamps are strings like "1234567890.123456")
- **Nullable**: Yes (NULL for requests created before this feature)
- **Purpose**: Stores the `ts` value returned from `chat.postMessage` when posting acknowledgment
- **Usage**: Retrieved during completion to delete the acknowledgment message
- **Validation**: Must match Slack timestamp format (digits.digits)
- **Lifecycle**:
  1. Initially NULL when request created
  2. Set after acknowledgment message posted
  3. Used once for deletion during completion
  4. Remains in database for audit trail

### State Transitions

Request states remain unchanged, but acknowledgment message lifecycle is now tracked:

```
[Request Created]
    ↓
[Acknowledgment Posted] → ack_message_ts = "1234567890.123456"
    ↓
[Processing...]
    ↓
[Completion] → Delete message with ack_message_ts
    ↓
[Completion Message Posted with reply_broadcast: true]
```

### Validation Rules

From functional requirements (FR-002, FR-007):

1. **FR-007 Compliance**: `ack_message_ts` MUST be stored in database when acknowledgment posted
2. **Timestamp Format**: Must be valid Slack timestamp (regex: `^\d+\.\d+$`)
3. **Uniqueness**: Each request has at most one acknowledgment message
4. **Nullability**: NULL is valid for:
   - Requests created before feature deployment
   - Requests where acknowledgment posting failed
5. **Immutability**: Once set, `ack_message_ts` should not change (single acknowledgment per request)

### Relationships

No changes to existing relationships:

- **Request → Media**: One-to-many (unchanged)
- Acknowledgment message is ephemeral - deleted before completion, not permanently stored

## Entity: Media (Unchanged)

**Description**: Tracks generated audio/video files. No changes required for this feature.

### Fields (Reference Only)

| Field Name | Type | Description |
|------------|------|-------------|
| `id` | INTEGER | Primary key |
| `request_id` | INTEGER | Foreign key to requests(id) |
| `media_type` | TEXT | 'audio' or 'video' |
| `filename` | TEXT | Generated filename |
| `r2_key` | TEXT | Cloudflare R2 storage key |
| `r2_public_url` | TEXT | Public URL for download |
| `file_size` | INTEGER | File size in bytes |
| `created_at` | DATETIME | Creation timestamp |
| `expires_at` | DATETIME | Expiration (7 days) |

## Schema Migration

### Migration: 002_add_ack_message_ts.sql

```sql
-- Add acknowledgment message timestamp for cleanup feature
-- Nullable to support existing requests created before this feature

ALTER TABLE requests ADD COLUMN ack_message_ts TEXT;

-- Optional: Add comment explaining purpose (SQLite doesn't support comments in schema)
-- This column stores the Slack message timestamp of the acknowledgment message
-- so it can be deleted when processing completes, keeping conversation history clean
```

### Migration Execution

**Timing**: Applied during application startup via `DatabaseService.runMigrations()`

**Backward Compatibility**:
- ✅ Non-breaking change (ADD COLUMN with NULLABLE)
- ✅ Existing records continue to work (ack_message_ts = NULL)
- ✅ No data migration required
- ✅ Application startup succeeds even with old schema (migration auto-applies)

**Rollback Strategy**:
If needed, rollback via:
```sql
-- SQLite doesn't support DROP COLUMN directly
-- Workaround: Create new table without column, copy data, rename
-- Not recommended unless absolutely necessary
```

**Testing Migration**:
1. Start application with old schema → migration applies automatically
2. Verify column exists: `PRAGMA table_info(requests);`
3. Create new request → ack_message_ts starts as NULL
4. Post acknowledgment → ack_message_ts populated
5. Complete processing → message deleted successfully

## Database Access Patterns

### New Operations Required

**1. Store Acknowledgment Timestamp** (after posting acknowledgment):
```typescript
// In SimpleQueue class
updateAckMessageTs(requestId: number, messageTs: string): void {
  db.prepare('UPDATE requests SET ack_message_ts = ? WHERE id = ?')
    .run(messageTs, requestId);

  logger.info('Stored acknowledgment message timestamp', { requestId, messageTs });
}
```

**2. Retrieve Acknowledgment Timestamp** (before completion):
```typescript
// In SimpleQueue class
getRequest(requestId: number): Request | undefined {
  return db.prepare(`
    SELECT * FROM requests WHERE id = ?
  `).get(requestId);
}
```

**3. Clear Acknowledgment Timestamp** (optional cleanup after deletion):
```typescript
// Optional: Clear timestamp after successful deletion
clearAckMessageTs(requestId: number): void {
  db.prepare('UPDATE requests SET ack_message_ts = NULL WHERE id = ?')
    .run(requestId);
}
```

### Modified Operations

No modifications to existing operations required. All current queries continue to work:
- ✅ `getNextPendingJob()` - unchanged (doesn't need ack_message_ts)
- ✅ `updateJobStatus()` - unchanged (updates status only)
- ✅ `getMediaForRequest()` - unchanged (retrieves media files)

### Query Performance

**Impact**: Minimal
- New column is nullable and not indexed (no query overhead)
- No joins or aggregations required
- Single UPDATE and SELECT by primary key (already indexed)

**Indexes**: No new indexes required
- `ack_message_ts` is only accessed via primary key lookup (id)
- No filtering or sorting by `ack_message_ts` needed

## Data Integrity

### Constraints

**Foreign Keys**: None (ack_message_ts is not a foreign key)

**Check Constraints**: None enforced in SQLite (validation in application layer)

**Application-Level Validation**:
```typescript
function isValidSlackTimestamp(ts: string): boolean {
  return /^\d+\.\d+$/.test(ts);
}

// Before storing
if (!isValidSlackTimestamp(messageTs)) {
  throw new Error('Invalid Slack timestamp format');
}
```

### Orphaned Data Handling

**Scenario**: Request deleted but acknowledgment message still in Slack

**Resolution**: Not applicable - acknowledgment messages are ephemeral:
- Deleted on completion (success or error)
- If request deleted from DB, message remains in Slack (harmless)
- No cleanup process required for orphaned acknowledgments

## Example Data Flow

### Successful Request Flow

```sql
-- 1. Request created (ack_message_ts = NULL)
INSERT INTO requests (url, slack_channel, slack_thread_ts, slack_user, status)
VALUES ('https://example.com', 'C123456', '1234567890.123456', 'U987654', 'pending');
-- Returns: id = 42

-- 2. Acknowledgment posted, timestamp stored
UPDATE requests SET ack_message_ts = '1234567891.234567' WHERE id = 42;

-- 3. Processing starts
UPDATE requests SET status = 'processing', started_at = CURRENT_TIMESTAMP WHERE id = 42;

-- 4. Processing completes
UPDATE requests SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = 42;

-- 5. Retrieve for completion handler
SELECT * FROM requests WHERE id = 42;
-- Returns: { ..., ack_message_ts: '1234567891.234567', ... }

-- 6. Delete acknowledgment message via Slack API
-- (using ack_message_ts from query result)

-- 7. Post completion message with reply_broadcast: true
-- (separate Slack API call, not stored in DB)
```

### Error Request Flow

```sql
-- 1-2. Same as successful flow (request created, ack posted)

-- 3. Processing fails
UPDATE requests
SET status = 'failed',
    error_message = 'URL not accessible',
    completed_at = CURRENT_TIMESTAMP
WHERE id = 42;

-- 4. Retrieve for error handler
SELECT * FROM requests WHERE id = 42;

-- 5. Delete acknowledgment message (same as success case)

-- 6. Post error message with reply_broadcast: true
```

### Backward Compatibility (Old Request)

```sql
-- Request created before migration (ack_message_ts = NULL)
SELECT * FROM requests WHERE id = 10;
-- Returns: { ..., ack_message_ts: null, ... }

-- Completion handler checks NULL
if (request.ack_message_ts) {
  // Delete acknowledgment - skipped for old requests
}

// Post completion message - works normally
```

## Schema Versioning

### Current Version: 1
- Schema: `001_initial.sql`
- Tables: `requests` (11 columns), `media` (9 columns)

### New Version: 2
- Schema: `002_add_ack_message_ts.sql`
- Tables: `requests` (12 columns), `media` (9 columns)
- Change: Added `requests.ack_message_ts` column

### Version Tracking (Proposed)

```sql
-- Track applied migrations
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- After applying migration 002
INSERT INTO schema_version (version) VALUES (2);
```

## Summary

### Changes Required

1. **Database Schema**:
   - Add `ack_message_ts TEXT NULLABLE` to `requests` table
   - Create migration `002_add_ack_message_ts.sql`
   - Implement versioned migration system (optional but recommended)

2. **Database Access**:
   - Add `SimpleQueue.updateAckMessageTs(requestId, messageTs)` method
   - Add `SimpleQueue.getRequest(requestId)` method (or enhance existing)
   - Modify completion handlers to retrieve and use `ack_message_ts`

3. **Data Integrity**:
   - Application-level validation for timestamp format
   - NULL handling for backward compatibility
   - Error handling for deletion failures (don't block completion)

### No Changes Required

- Existing tables (media) - unchanged
- Existing relationships - unchanged
- Existing indexes - unchanged
- Existing queries - continue to work without modification
