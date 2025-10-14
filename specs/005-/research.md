# Research: Slack メッセージクリーンアップと通知改善

**Feature**: 005-
**Date**: 2025-10-15
**Status**: Complete

## Overview

This document captures research findings and technical decisions for implementing message cleanup and channel broadcast features in the Slack bot.

## Research Areas

### 1. Slack API for Message Deletion

**Research Question**: What is the correct way to delete bot-posted messages using @slack/bolt?

**Decision**: Use `chat.delete` API method

**Rationale**:
- Slack provides `chat.delete` API for deleting messages posted by the bot
- Requires `chat:write` scope (already present in current bot)
- Method signature: `chat.delete({ channel, ts })`
- Returns success/error response for proper error handling
- Bot can only delete messages it posted (security constraint)

**Implementation Details**:
```typescript
await client.chat.delete({
  channel: string,    // Channel ID where message was posted
  ts: string         // Message timestamp (returned from chat.postMessage)
});
```

**Error Handling**:
- `message_not_found`: Message was already deleted (manual deletion by user)
- `cant_delete_message`: Permission issue or not the message owner
- Best practice: Log errors but don't fail the completion flow (FR-006)

**Alternatives Considered**:
- Manual message tracking without deletion: Rejected because users specifically want clean conversation history
- Third-party Slack libraries: Rejected because @slack/bolt is official and already integrated

**References**:
- Slack API: https://api.slack.com/methods/chat.delete
- @slack/bolt documentation: https://slack.dev/bolt-js/

---

### 2. Slack reply_broadcast Parameter

**Research Question**: How to make thread replies visible in the main channel timeline?

**Decision**: Use `reply_broadcast: true` parameter in chat.postMessage

**Rationale**:
- `reply_broadcast` is a standard parameter in Slack's `chat.postMessage` API
- When set to `true`, thread reply appears in both:
  1. The thread itself (as a normal reply)
  2. The channel's main timeline with "〜さんがスレッドで返信しました" annotation
- Available in all @slack/bolt versions (4.5.0+)
- No additional scopes required beyond `chat:write`

**Implementation Details**:
```typescript
await client.chat.postMessage({
  channel: string,
  thread_ts: string,
  reply_broadcast: true,  // Key parameter
  text: string,
  blocks?: any[]
});
```

**User Experience**:
- Channel members who don't follow the thread still see the completion notification
- Clicking the notification takes them to the thread context
- Maintains thread organization while ensuring visibility

**Alternatives Considered**:
- Posting separate messages (one in thread, one in channel): Rejected because it creates duplicate messages and clutters the channel
- Using Slack workflows: Rejected as overcomplicated for this simple requirement
- Optional flag per request: Rejected - user requirement is to ALWAYS broadcast (FR-005)

**References**:
- Slack API: https://api.slack.com/methods/chat.postMessage
- reply_broadcast documentation: https://api.slack.com/messaging/managing#threading

---

### 3. Database Schema Migration Strategy

**Research Question**: How to add `ack_message_ts` column to existing SQLite database?

**Decision**: Use ALTER TABLE in migration script with backward compatibility

**Rationale**:
- SQLite supports `ALTER TABLE ADD COLUMN` for adding new columns
- Existing migration system uses SQL files in `src/db/migrations/`
- Adding nullable column is non-breaking (existing requests continue to work)
- Migration runs on application startup via `DatabaseService.runMigrations()`

**Implementation Details**:
```sql
-- Migration: 002_add_ack_message_ts.sql
ALTER TABLE requests ADD COLUMN ack_message_ts TEXT;
```

**Migration Strategy**:
- Create new migration file: `src/db/migrations/002_add_ack_message_ts.sql`
- Column is nullable (existing records will have NULL)
- NULL value indicates feature wasn't active when request was created
- Deletion logic should check for NULL before attempting delete

**Data Type**:
- Use `TEXT` for message timestamp (Slack timestamps are strings like "1234567890.123456")
- Matches Slack API timestamp format
- Consistent with existing `slack_thread_ts` column

**Backward Compatibility**:
- Old requests (created before migration) will have `ack_message_ts = NULL`
- Completion handler checks: `if (ack_message_ts) { await delete() }`
- No data loss or migration errors for existing records

**Alternatives Considered**:
- Separate table for acknowledgment messages: Rejected as over-engineered (1:1 relationship)
- In-memory storage: Rejected because bot restarts would lose tracking data
- Using existing columns: Rejected because message timestamps are different from thread timestamps

**References**:
- SQLite ALTER TABLE: https://sqlite.org/lang_altertable.html
- better-sqlite3 migrations: Current codebase pattern in `database.ts:43-54`

---

### 4. Migration System Enhancement

**Research Question**: Current migration system runs single file - how to support multiple migrations?

**Decision**: Implement migration versioning with `schema_version` table

**Rationale**:
- Current system: Single migration file (`001_initial.sql`) runs every time
- Need: Sequential execution of multiple migration files
- Solution: Track applied migrations in database table
- Standard pattern: `schema_version` table stores last applied migration

**Implementation Details**:
```typescript
// Modified DatabaseService.runMigrations()
private runMigrations(): void {
  // Create schema_version table if not exists
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get current version
  const currentVersion = this.db
    .prepare('SELECT MAX(version) as version FROM schema_version')
    .get()?.version || 0;

  // Apply pending migrations
  const migrations = [
    { version: 1, file: '001_initial.sql' },
    { version: 2, file: '002_add_ack_message_ts.sql' }
  ];

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      const sql = readFileSync(
        join(__dirname, `../db/migrations/${migration.file}`),
        'utf8'
      );
      this.db.exec(sql);
      this.db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(migration.version);
      logger.info('Applied migration', { version: migration.version });
    }
  }
}
```

**Benefits**:
- Migrations run once and only once
- Supports multiple sequential migrations
- Rollback capability (version tracking)
- Standard database migration pattern

**Alternatives Considered**:
- File-based tracking: Rejected because it doesn't survive across environments
- Always run all migrations: Current approach - works but inefficient with many migrations
- Third-party migration tool (Knex, TypeORM): Rejected to avoid adding dependencies

---

### 5. Message Timestamp Storage Flow

**Research Question**: When and how to capture acknowledgment message timestamp?

**Decision**: Capture `ts` from `chat.postMessage` response and store immediately

**Rationale**:
- Slack's `chat.postMessage` returns `{ ok: true, ts: "1234567890.123456", ... }`
- Timestamp must be captured when acknowledgment message is posted
- Store in database before processing begins (ensures it's available for deletion)

**Implementation Flow**:
```typescript
// In SlackBot.app.event('app_mention')
const jobId = this.queue.addJob(url, channel, threadTs, userId);

// Post acknowledgment and capture timestamp
const ackResponse = await client.chat.postMessage({
  channel,
  thread_ts: threadTs,
  text: `✅ リクエストを受け付けました...`
});

// Store timestamp in database
this.queue.updateAckMessageTs(jobId, ackResponse.ts);
```

**Database Update Method**:
```typescript
// In SimpleQueue class
updateAckMessageTs(requestId: number, messageTs: string): void {
  db.prepare('UPDATE requests SET ack_message_ts = ? WHERE id = ?')
    .run(messageTs, requestId);
}
```

**Error Handling**:
- If `chat.postMessage` fails, no timestamp is stored (NULL in database)
- Deletion logic checks for NULL: `if (ackMessageTs) { await delete() }`
- Processing continues normally even if acknowledgment fails

**Alternatives Considered**:
- Store timestamp in separate table: Rejected (1:1 relationship, unnecessary complexity)
- Store in memory: Rejected (lost on restart)
- Capture timestamp at deletion time: Rejected (timestamp must be known from post time)

---

### 6. Error Handling for Message Deletion

**Research Question**: How to handle failures in message deletion without affecting user experience?

**Decision**: Log deletion errors but always post completion message (FR-006)

**Rationale**:
- User priority: Seeing completion results > clean history
- Deletion failure scenarios:
  1. User manually deleted acknowledgment message
  2. Network error during delete API call
  3. Slack API rate limit exceeded
  4. Permission change (scope revoked)
- None of these should prevent completion notification

**Implementation Pattern**:
```typescript
async function postCompletionWithCleanup(
  channel: string,
  threadTs: string,
  jobId: number
): Promise<void> {
  // 1. Always delete acknowledgment first (if exists)
  try {
    const request = this.queue.getRequest(jobId);
    if (request.ack_message_ts) {
      await this.app.client.chat.delete({
        channel,
        ts: request.ack_message_ts
      });
      logger.info('Deleted acknowledgment message', { jobId });
    }
  } catch (deleteError) {
    logger.warn('Failed to delete acknowledgment message', {
      error: deleteError,
      jobId
    });
    // Continue - deletion failure is not critical
  }

  // 2. Always post completion (even if deletion failed)
  await this.app.client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    reply_broadcast: true,  // Always broadcast to channel
    text: '✅ 処理が完了しました！'
  });
}
```

**Logging Strategy**:
- Success: `logger.info` with jobId and timestamp
- Failure: `logger.warn` with error details (not `error` level since it's non-critical)
- Metrics: Track deletion success rate for monitoring

**User Impact**:
- Best case: Clean conversation history with completion message
- Failure case: Both acknowledgment and completion visible (slightly cluttered but functional)
- No user-facing error messages for deletion failures

**Alternatives Considered**:
- Retry deletion on failure: Rejected (adds complexity, delay, and may fail again)
- Fail completion if deletion fails: Rejected (violates FR-006 requirement)
- Silent failure without logging: Rejected (need observability for debugging)

---

## Implementation Checklist

Based on research findings, implementation requires:

- [ ] **Database Migration**
  - [ ] Create `src/db/migrations/002_add_ack_message_ts.sql`
  - [ ] Implement versioned migration system in `database.ts`
  - [ ] Add `schema_version` table for tracking

- [ ] **SlackBot Modifications**
  - [ ] Capture `ts` from acknowledgment message post
  - [ ] Store timestamp via new database method
  - [ ] Add deletion logic to completion handlers
  - [ ] Add `reply_broadcast: true` to all completion messages
  - [ ] Implement error handling for deletion failures

- [ ] **SimpleQueue Enhancements**
  - [ ] Add `updateAckMessageTs(requestId, messageTs)` method
  - [ ] Add `getRequest(id)` method to retrieve request with ack_message_ts

- [ ] **Testing Strategy**
  - [ ] Manual test: Verify message deletion on successful completion
  - [ ] Manual test: Verify message deletion on error completion
  - [ ] Manual test: Verify reply_broadcast appears in channel timeline
  - [ ] Manual test: Verify behavior when acknowledgment manually deleted by user
  - [ ] Manual test: Check NULL ack_message_ts for old requests (backward compatibility)

---

## Open Questions

**None** - All technical questions resolved through research.

---

## References

- [Slack API: chat.delete](https://api.slack.com/methods/chat.delete)
- [Slack API: chat.postMessage](https://api.slack.com/methods/chat.postMessage)
- [Slack Threading Documentation](https://api.slack.com/messaging/managing#threading)
- [SQLite ALTER TABLE](https://sqlite.org/lang_altertable.html)
- [@slack/bolt Documentation](https://slack.dev/bolt-js/)
- Project codebase:
  - `src/services/slack-bot.ts` (existing implementation)
  - `src/lib/database.ts` (migration system)
  - `src/db/migrations/001_initial.sql` (schema reference)
