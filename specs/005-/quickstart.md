# Quick Start Guide: Slack メッセージクリーンアップと通知改善

**Feature**: 005-
**Date**: 2025-10-15
**Audience**: Developers implementing this feature

## Overview

This guide helps you implement two Slack message improvements:
1. **Clean history**: Delete acknowledgment messages when processing completes
2. **Channel visibility**: Always broadcast completion messages to channel timeline

**Estimated Time**: 2-3 hours (including manual testing)

## Prerequisites

- [ ] Development environment set up (Node.js 20+, TypeScript 5.3+)
- [ ] Slack bot running and connected to workspace
- [ ] Access to Slack workspace for testing
- [ ] Basic understanding of:
  - @slack/bolt SDK
  - SQLite and better-sqlite3
  - Async/await in TypeScript

## Implementation Checklist

### Phase 1: Database Schema (30 minutes)

#### 1.1 Create Migration File

Create `src/db/migrations/002_add_ack_message_ts.sql`:

```sql
-- Add acknowledgment message timestamp for cleanup feature
-- Nullable to support existing requests created before this feature

ALTER TABLE requests ADD COLUMN ack_message_ts TEXT;
```

**Location**: `/src/db/migrations/002_add_ack_message_ts.sql`

#### 1.2 Implement Versioned Migrations

**Current Issue**: Migration system runs single file repeatedly

**Solution**: Add migration versioning to `src/lib/database.ts`

**Before** (`database.ts:43-54`):
```typescript
private runMigrations(): void {
  const migrationPath = join(__dirname, '../db/migrations/001_initial.sql');
  const migration = readFileSync(migrationPath, 'utf8');
  this.db.exec(migration);
  logger.info('Migrations completed successfully');
}
```

**After**:
```typescript
private runMigrations(): void {
  try {
    // Create schema version table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get current version
    const currentVersion = this.db
      .prepare('SELECT MAX(version) as version FROM schema_version')
      .get() as { version: number | null };

    const appliedVersion = currentVersion?.version || 0;

    // Define all migrations
    const migrations = [
      { version: 1, file: '001_initial.sql' },
      { version: 2, file: '002_add_ack_message_ts.sql' }
    ];

    // Apply pending migrations
    for (const migration of migrations) {
      if (migration.version > appliedVersion) {
        const migrationPath = join(__dirname, `../db/migrations/${migration.file}`);
        const sql = readFileSync(migrationPath, 'utf8');

        this.db.exec(sql);

        this.db
          .prepare('INSERT INTO schema_version (version) VALUES (?)')
          .run(migration.version);

        logger.info('Applied migration', { version: migration.version, file: migration.file });
      }
    }

    logger.info('Migrations completed successfully', { currentVersion: migrations[migrations.length - 1].version });
  } catch (error) {
    logger.error('Migration failed', { error });
    throw error;
  }
}
```

**Test Migration**:
```bash
# Start bot - migration applies automatically
npm run bot:start

# Verify in SQLite
sqlite3 data/bot.db
sqlite> PRAGMA table_info(requests);
# Should show ack_message_ts column

sqlite> SELECT * FROM schema_version;
# Should show version 1 and 2
```

---

### Phase 2: Database Access Layer (30 minutes)

#### 2.1 Add Method to Store Acknowledgment Timestamp

**File**: `src/services/simple-queue.ts`

**Add Method**:
```typescript
/**
 * Store acknowledgment message timestamp for later deletion
 */
updateAckMessageTs(requestId: number, messageTs: string): void {
  // Validate Slack timestamp format (e.g., "1234567890.123456")
  if (!/^\d+\.\d+$/.test(messageTs)) {
    logger.error('Invalid Slack timestamp format', { messageTs, requestId });
    throw new Error(`Invalid Slack timestamp format: ${messageTs}`);
  }

  const stmt = db.prepare('UPDATE requests SET ack_message_ts = ? WHERE id = ?');
  const result = stmt.run(messageTs, requestId);

  if (result.changes === 0) {
    logger.error('Request not found when updating ack_message_ts', { requestId });
    throw new Error(`Request not found: ${requestId}`);
  }

  logger.info('Stored acknowledgment message timestamp', { requestId, messageTs });
}
```

#### 2.2 Add Method to Retrieve Request Details

**File**: `src/services/simple-queue.ts`

**Add Method**:
```typescript
/**
 * Get request by ID including acknowledgment message timestamp
 */
getRequest(requestId: number): any | undefined {
  const stmt = db.prepare('SELECT * FROM requests WHERE id = ?');
  const request = stmt.get(requestId);

  logger.debug('Retrieved request', { requestId, hasAckTs: !!request?.ack_message_ts });

  return request;
}
```

**Test**:
```typescript
// In test script or REPL
const queue = new SimpleQueue();
const jobId = queue.addJob('https://test.com', 'C123', '123.456', 'U123');

queue.updateAckMessageTs(jobId, '1234567890.123456');

const request = queue.getRequest(jobId);
console.log(request.ack_message_ts); // Should be "1234567890.123456"
```

---

### Phase 3: Slack Bot Modifications (60 minutes)

#### 3.1 Capture Acknowledgment Timestamp

**File**: `src/services/slack-bot.ts`

**Location**: Event handler around line 98-103

**Before**:
```typescript
// Send acknowledgment
await this.replyToThread(
  client,
  event.channel,
  event.ts,
  `✅ リクエストを受け付けました\n\n🔄 処理キューに追加しました (Job ID: ${jobId})\n処理が完了したらこのスレッドに結果を投稿します。`
);
```

**After**:
```typescript
// Send acknowledgment and capture timestamp
try {
  const ackResponse = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.ts,
    text: `✅ リクエストを受け付けました\n\n🔄 処理キューに追加しました (Job ID: ${jobId})\n処理が完了したらこのスレッドに結果を投稿します。`
  });

  // Store timestamp for later deletion
  this.queue.updateAckMessageTs(jobId, ackResponse.ts);
  logger.info('Posted and stored acknowledgment', { jobId, ackTs: ackResponse.ts });
} catch (ackError) {
  logger.error('Failed to post acknowledgment', { error: ackError, jobId });
  // Continue processing - acknowledgment is nice-to-have
  // ack_message_ts will remain NULL, deletion will be skipped
}
```

**Why this change**:
- `replyToThread` is a wrapper that doesn't return response
- Need direct `client.chat.postMessage` to capture `ts`
- Timestamp is critical for deletion in Phase 3.2

#### 3.2 Delete Acknowledgment Before Completion

**File**: `src/services/slack-bot.ts`

**Location**: `postCompletionResults` method around line 208

**Before**:
```typescript
async postCompletionResults(
  channel: string,
  threadTs: string,
  jobId: number
): Promise<void> {
  try {
    const media = this.queue.getMediaForRequest(jobId);
    // ... build message
    await this.replyToThread(this.app.client, channel, threadTs, message);
    logger.info('Posted completion results', { jobId, channel });
  } catch (error) {
    logger.error('Failed to post completion results', { error, jobId });
    throw error;
  }
}
```

**After**:
```typescript
async postCompletionResults(
  channel: string,
  threadTs: string,
  jobId: number
): Promise<void> {
  try {
    // Step 1: Delete acknowledgment message (if exists)
    try {
      const request = this.queue.getRequest(jobId);

      if (request?.ack_message_ts) {
        await this.app.client.chat.delete({
          channel,
          ts: request.ack_message_ts
        });
        logger.info('Deleted acknowledgment message', { jobId, ackTs: request.ack_message_ts });
      } else {
        logger.debug('No acknowledgment to delete', { jobId });
      }
    } catch (deleteError: any) {
      // Map known errors to appropriate log levels
      const errorCode = deleteError?.data?.error;

      if (errorCode === 'message_not_found') {
        logger.info('Acknowledgment already deleted (manual user deletion)', { jobId });
      } else if (errorCode === 'cant_delete_message') {
        logger.warn('Cannot delete message (permission issue)', { jobId, error: deleteError });
      } else {
        logger.warn('Failed to delete acknowledgment message', { jobId, error: deleteError });
      }

      // CRITICAL: Don't throw - deletion failure must not prevent completion (FR-006)
    }

    // Step 2: Build and post completion message with broadcast
    const media = this.queue.getMediaForRequest(jobId);

    if (media.length === 0) {
      throw new Error('No media found for completed job');
    }

    const audioMedia = media.find((m) => m.mediaType === 'audio');
    const videoMedia = media.find((m) => m.mediaType === 'video');

    let message = '✅ 処理が完了しました！\n\n';

    if (audioMedia) {
      const audioSize = formatFileSize(audioMedia.fileSize);
      message += `<${audioMedia.r2PublicUrl}|🎵 音声要約> (${audioSize})\n`;
    }

    if (videoMedia) {
      const videoSize = formatFileSize(videoMedia.fileSize);
      message += `<${videoMedia.r2PublicUrl}|🎬 動画要約> (${videoSize})\n`;
    }

    message += `\n⏰ リンクは7日間有効です`;

    // CRITICAL: Use reply_broadcast for channel visibility (FR-005)
    await this.app.client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      reply_broadcast: true,  // Always true - mandatory requirement
      text: message
    });

    logger.info('Posted completion results with broadcast', { jobId, channel });
  } catch (error) {
    logger.error('Failed to post completion results', { error, jobId });
    throw error;
  }
}
```

#### 3.3 Update Error Handler

**File**: `src/services/slack-bot.ts`

**Location**: `postErrorMessage` method around line 188

**Before**:
```typescript
private async postErrorMessage(
  channel: string,
  threadTs: string,
  jobId: number
): Promise<void> {
  try {
    const message = `❌ 処理中にエラーが発生しました（Job ID: ${jobId}）\n\nURLが正しいか、再度お試しください。`;

    await this.replyToThread(this.app.client, channel, threadTs, message);

    logger.info('Posted error message', { jobId, channel });
  } catch (error) {
    logger.error('Failed to post error message', { error, jobId });
  }
}
```

**After**:
```typescript
private async postErrorMessage(
  channel: string,
  threadTs: string,
  jobId: number
): Promise<void> {
  try {
    // Step 1: Delete acknowledgment (same as completion)
    try {
      const request = this.queue.getRequest(jobId);

      if (request?.ack_message_ts) {
        await this.app.client.chat.delete({
          channel,
          ts: request.ack_message_ts
        });
        logger.info('Deleted acknowledgment before error message', { jobId });
      }
    } catch (deleteError: any) {
      logger.warn('Failed to delete acknowledgment on error', {
        jobId,
        error: deleteError,
        errorCode: deleteError?.data?.error
      });
      // Continue - deletion failure is non-critical
    }

    // Step 2: Post error with broadcast
    const message = `❌ 処理中にエラーが発生しました（Job ID: ${jobId}）\n\nURLが正しいか、再度お試しください。`;

    await this.app.client.chat.postMessage({
      channel,
      thread_ts: threadTs,
      reply_broadcast: true,  // Errors also broadcast to channel
      text: message
    });

    logger.info('Posted error message with broadcast', { jobId, channel });
  } catch (error) {
    logger.error('Failed to post error message', { error, jobId });
    // Don't throw - error posting is best-effort
  }
}
```

---

### Phase 4: Testing (60 minutes)

#### 4.1 Database Migration Test

```bash
# 1. Backup existing database
cp data/bot.db data/bot.db.backup

# 2. Start bot
npm run bot:start

# 3. Verify migration
sqlite3 data/bot.db

sqlite> PRAGMA table_info(requests);
# Look for: ack_message_ts | TEXT | 0 | | 0

sqlite> SELECT * FROM schema_version;
# Should show: 1 | <timestamp> and 2 | <timestamp>

sqlite> .exit
```

**Expected**: Both migrations applied, ack_message_ts column exists

#### 4.2 End-to-End Feature Test

**Test Case 1: Successful Processing**

1. **Setup**: Open Slack workspace, navigate to test channel
2. **Action**: Post URL and mention bot in thread
3. **Observe**:
   - ✅ Acknowledgment appears: "✅ リクエストを受け付けました..."
   - Check database: `SELECT ack_message_ts FROM requests ORDER BY id DESC LIMIT 1;`
   - Should see timestamp like "1234567890.123456"
4. **Wait**: For processing to complete (~10-15 minutes)
5. **Observe**:
   - ✅ Acknowledgment disappears (deleted)
   - ✅ Completion message appears in thread
   - ✅ Completion message appears in channel timeline with "replied in thread"
   - ✅ Clicking channel notification navigates to thread

**Test Case 2: Manual Acknowledgment Deletion**

1. Post request → acknowledgment appears
2. Manually delete acknowledgment message via Slack UI
3. Wait for completion
4. **Expected**:
   - ✅ No error in bot logs (graceful handling)
   - ✅ Completion message posted successfully
   - ✅ Log shows: "Acknowledgment already deleted (manual user deletion)"

**Test Case 3: Error Scenario**

1. Post invalid URL and mention bot
2. **Observe**:
   - ✅ Acknowledgment appears
   - Wait for error (~2-3 minutes)
   - ✅ Acknowledgment disappears
   - ✅ Error message appears in both thread and channel
   - ✅ Error message uses reply_broadcast

**Test Case 4: Backward Compatibility**

1. Find old request in database (created before feature):
   ```sql
   SELECT id, ack_message_ts FROM requests WHERE ack_message_ts IS NULL LIMIT 1;
   ```
2. Manually update status to trigger completion handler:
   ```sql
   UPDATE requests SET status = 'processing' WHERE id = <old_id>;
   -- Then update to 'completed' to trigger handler
   ```
3. **Expected**:
   - ✅ No deletion attempt (NULL check works)
   - ✅ Completion message posted successfully
   - ✅ No errors in logs

#### 4.3 Validation Checklist

**Database**:
- [ ] Migration 002 applied successfully
- [ ] `schema_version` table exists with version 2
- [ ] New requests have `ack_message_ts` populated
- [ ] Old requests have `ack_message_ts = NULL`

**Message Flow**:
- [ ] Acknowledgment posted and timestamp stored
- [ ] Acknowledgment deleted on successful completion
- [ ] Acknowledgment deleted on error completion
- [ ] Completion message uses `reply_broadcast: true`
- [ ] Error message uses `reply_broadcast: true`

**Error Handling**:
- [ ] Manual deletion of acknowledgment handled gracefully
- [ ] Deletion failures don't prevent completion message
- [ ] Appropriate log levels used (info/warn, not error for deletion failures)

**User Experience**:
- [ ] Thread shows only final result (acknowledgment removed)
- [ ] Channel timeline shows completion notification
- [ ] Channel members receive notification
- [ ] Clicking notification navigates to thread

---

## Troubleshooting

### Issue: Migration doesn't run

**Symptom**: `ack_message_ts` column missing in database

**Solution**:
```bash
# Check migration system logs
npm run bot:start 2>&1 | grep -i migration

# Manually verify
sqlite3 data/bot.db "PRAGMA table_info(requests);"

# If column missing, manually apply:
sqlite3 data/bot.db "ALTER TABLE requests ADD COLUMN ack_message_ts TEXT;"
```

### Issue: "Invalid Slack timestamp format" error

**Symptom**: Error when storing acknowledgment timestamp

**Cause**: `ackResponse.ts` is undefined or malformed

**Solution**:
```typescript
// Add validation in SlackBot
const ackResponse = await client.chat.postMessage({...});

if (!ackResponse.ts) {
  logger.error('No timestamp in ack response', { ackResponse });
  return; // Skip storing
}

if (!/^\d+\.\d+$/.test(ackResponse.ts)) {
  logger.error('Invalid timestamp format', { ts: ackResponse.ts });
  return; // Skip storing
}

this.queue.updateAckMessageTs(jobId, ackResponse.ts);
```

### Issue: Deletion fails with "cant_delete_message"

**Symptom**: Warning in logs about permission to delete

**Cause**: Bot trying to delete message it didn't post

**Solution**:
- Verify bot posted the acknowledgment (check Slack UI)
- Verify `chat:write` scope is granted
- Check if message timestamp matches stored value

### Issue: Completion message doesn't appear in channel

**Symptom**: Message only in thread, not in channel timeline

**Cause**: `reply_broadcast: true` not set

**Solution**:
```typescript
// Verify in code
await this.app.client.chat.postMessage({
  channel,
  thread_ts: threadTs,
  reply_broadcast: true,  // MUST be present
  text: message
});

// Check Slack API response
const response = await this.app.client.chat.postMessage({...});
console.log('Posted with broadcast:', response);
```

---

## Next Steps

After implementation and testing:

1. **Code Review**:
   - [ ] Review database migration code
   - [ ] Review error handling logic
   - [ ] Verify logging is appropriate

2. **Documentation**:
   - [ ] Update CLAUDE.md if needed
   - [ ] Document any deviations from spec

3. **Deployment**:
   - [ ] Test in staging environment
   - [ ] Verify migration runs cleanly
   - [ ] Monitor logs for deletion errors
   - [ ] Collect user feedback on clean conversation experience

4. **Monitoring**:
   - Track metrics:
     - Deletion success rate
     - `message_not_found` frequency (user deletions)
     - `cant_delete_message` errors (permission issues)

---

## Quick Reference

### Key Files Modified

| File | Changes |
|------|---------|
| `src/db/migrations/002_add_ack_message_ts.sql` | NEW: Migration to add column |
| `src/lib/database.ts` | MODIFY: Implement versioned migrations |
| `src/services/simple-queue.ts` | ADD: `updateAckMessageTs`, `getRequest` methods |
| `src/services/slack-bot.ts` | MODIFY: Capture ts, delete ack, use reply_broadcast |

### Slack API Methods Used

| Method | Purpose | Error Handling |
|--------|---------|----------------|
| `chat.postMessage` (ack) | Post and capture timestamp | Log error, continue |
| `chat.delete` | Delete acknowledgment | Log warning, continue (FR-006) |
| `chat.postMessage` (completion) | Post with broadcast | Throw error (critical) |

### Database Schema

```sql
-- New column
ALTER TABLE requests ADD COLUMN ack_message_ts TEXT;

-- New table for migration tracking
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Testing Commands

```bash
# Start bot
npm run bot:start

# Check database
sqlite3 data/bot.db "SELECT * FROM schema_version;"
sqlite3 data/bot.db "SELECT id, ack_message_ts FROM requests ORDER BY id DESC LIMIT 5;"

# Check logs
tail -f logs/bot.log | grep -i "ack\|broadcast\|delete"
```

---

**Implementation Time Estimate**: 2-3 hours
**Testing Time Estimate**: 1 hour (including waiting for NotebookLM processing)
**Total Estimated Time**: 3-4 hours
