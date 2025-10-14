# Implementation Tasks: Slack メッセージクリーンアップと通知改善

**Feature**: 005-
**Branch**: `005-`
**Generated**: 2025-10-15
**Estimated Total Time**: 3-4 hours

## Overview

This feature implements two P1 user stories:
1. **US1 - クリーンな会話履歴の維持**: Delete acknowledgment messages on completion
2. **US2 - チャンネル全体への通知**: Always broadcast completion messages to channel

**Testing Approach**: Manual Slack testing (no automated tests per project standards)

**Implementation Strategy**: Both user stories are tightly coupled and implemented together as they share the same database and message handling modifications.

---

## Phase 1: Setup & Infrastructure (Foundational)

These tasks must complete before user story implementation can begin.

### T001 - Create database migration file [US1]

**File**: `src/db/migrations/002_add_ack_message_ts.sql`
**Action**: Create new migration file
**Story**: US1 - クリーンな会話履歴の維持

**Implementation**:
```sql
-- Add acknowledgment message timestamp for cleanup feature
-- Nullable to support existing requests created before this feature

ALTER TABLE requests ADD COLUMN ack_message_ts TEXT;
```

**Validation**:
- File created at correct path
- SQL syntax is valid
- Column is TEXT type and NULLABLE

**Dependencies**: None
**Estimated Time**: 5 minutes

---

### T002 - Implement versioned migration system [US1]

**File**: `src/lib/database.ts`
**Action**: Modify `runMigrations()` method to support multiple migrations with version tracking
**Story**: US1 - クリーンな会話履歴の維持

**Current Code** (`database.ts:43-54`):
```typescript
private runMigrations(): void {
  const migrationPath = join(__dirname, '../db/migrations/001_initial.sql');
  const migration = readFileSync(migrationPath, 'utf8');
  this.db.exec(migration);
  logger.info('Migrations completed successfully');
}
```

**New Implementation**:
```typescript
private runMigrations(): void {
  try {
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

    logger.info('Migrations completed successfully', {
      currentVersion: migrations[migrations.length - 1].version
    });
  } catch (error) {
    logger.error('Migration failed', { error });
    throw error;
  }
}
```

**Validation**:
- Start bot, check logs for "Applied migration" messages
- Verify `schema_version` table exists: `sqlite3 data/bot.db "SELECT * FROM schema_version;"`
- Should show version 1 and 2
- Verify `ack_message_ts` column added: `sqlite3 data/bot.db "PRAGMA table_info(requests);"`

**Dependencies**: T001 (migration file must exist)
**Estimated Time**: 20 minutes

---

## Phase 2: User Story 1 - クリーンな会話履歴の維持 (P1)

**Goal**: Delete acknowledgment messages when processing completes

**Independent Test Criteria**:
- Post request → acknowledgment appears
- Wait for completion → acknowledgment deleted, only result visible
- Thread history is clean (no intermediate status messages)

### T003 - Add database method to store acknowledgment timestamp [US1]

**File**: `src/services/simple-queue.ts`
**Action**: Add new method `updateAckMessageTs`
**Story**: US1 - クリーンな会話履歴の維持

**Implementation**:
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

**Validation**:
- TypeScript compiles without errors
- Method signature is correct
- Validation logic works (test with invalid timestamp)

**Dependencies**: T002 (database schema must have ack_message_ts column)
**Estimated Time**: 15 minutes

---

### T004 - Add database method to retrieve request with timestamp [US1]

**File**: `src/services/simple-queue.ts`
**Action**: Add new method `getRequest`
**Story**: US1 - クリーンな会話履歴の維持

**Implementation**:
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

**Validation**:
- TypeScript compiles without errors
- Method returns request object with all fields including `ack_message_ts`

**Dependencies**: T002 (database schema must have ack_message_ts column)
**Estimated Time**: 10 minutes

---

### T005 - Modify SlackBot to capture and store acknowledgment timestamp [US1]

**File**: `src/services/slack-bot.ts`
**Action**: Modify `app_mention` event handler to capture `ts` from acknowledgment post
**Story**: US1 - クリーンな会話履歴の維持
**Location**: Around line 98-103

**Current Code**:
```typescript
// Send acknowledgment
await this.replyToThread(
  client,
  event.channel,
  event.ts,
  `✅ リクエストを受け付けました\n\n🔄 処理キューに追加しました (Job ID: ${jobId})\n処理が完了したらこのスレッドに結果を投稿します。`
);
```

**New Implementation**:
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

**Validation**:
- TypeScript compiles without errors
- In Slack: Post request, check bot logs for "Posted and stored acknowledgment"
- Verify database: `SELECT ack_message_ts FROM requests ORDER BY id DESC LIMIT 1;`
- Should see timestamp like "1234567890.123456"

**Dependencies**: T003 (updateAckMessageTs method must exist)
**Estimated Time**: 15 minutes

---

### T006 - Add deletion logic to success completion handler [US1]

**File**: `src/services/slack-bot.ts`
**Action**: Modify `postCompletionResults` to delete acknowledgment before posting result
**Story**: US1 - クリーンな会話履歴の維持
**Location**: Around line 208-243

**Current Code**:
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

**New Implementation** (Part 1 - Deletion logic):
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

    // Step 2: Build and post completion message (continue in T008)
    // ... (rest of implementation in T008 for US2)
```

**Validation**:
- TypeScript compiles without errors
- Manual test: Post request, wait for completion, verify acknowledgment disappears
- Manual test: Delete acknowledgment manually before completion, verify graceful handling
- Check logs: "Deleted acknowledgment message" or "Acknowledgment already deleted"

**Dependencies**: T004 (getRequest method must exist)
**Estimated Time**: 20 minutes

**Note**: This task implements deletion logic. T008 will complete the method with reply_broadcast for US2.

---

### T007 - Add deletion logic to error completion handler [US1]

**File**: `src/services/slack-bot.ts`
**Action**: Modify `postErrorMessage` to delete acknowledgment before posting error
**Story**: US1 - クリーンな会話履歴の維持
**Location**: Around line 188-202

**Current Code**:
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

**New Implementation** (Part 1 - Deletion logic):
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

    // Step 2: Post error with broadcast (continue in T009 for US2)
    // ... (rest of implementation in T009)
```

**Validation**:
- TypeScript compiles without errors
- Manual test: Post invalid URL, verify acknowledgment deleted before error message
- Check logs for deletion confirmation

**Dependencies**: T004 (getRequest method must exist)
**Estimated Time**: 15 minutes

**Note**: This task implements deletion logic. T009 will complete the method with reply_broadcast for US2.

---

## Phase 3: User Story 2 - チャンネル全体への通知 (P1)

**Goal**: Always broadcast completion messages to channel timeline using `reply_broadcast: true`

**Independent Test Criteria**:
- Post request and wait for completion
- Completion message appears in thread AND channel timeline
- Channel members not in thread receive notification
- Clicking notification navigates to thread

### T008 - Add reply_broadcast to success completion message [US2]

**File**: `src/services/slack-bot.ts`
**Action**: Complete `postCompletionResults` with `reply_broadcast: true`
**Story**: US2 - チャンネル全体への通知
**Location**: Around line 208-243 (continuing from T006)

**Implementation** (Part 2 - Complete the method from T006):
```typescript
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

**Validation**:
- TypeScript compiles without errors
- Manual test: Post request, wait for completion
- Verify result appears in:
  1. Thread (as reply)
  2. Channel timeline (with "replied in thread" annotation)
- Verify channel members receive notification
- Click channel notification → verify navigates to thread

**Dependencies**: T006 (deletion logic from Part 1)
**Estimated Time**: 15 minutes

---

### T009 - Add reply_broadcast to error message [US2]

**File**: `src/services/slack-bot.ts`
**Action**: Complete `postErrorMessage` with `reply_broadcast: true`
**Story**: US2 - チャンネル全体への通知
**Location**: Around line 188-202 (continuing from T007)

**Implementation** (Part 2 - Complete the method from T007):
```typescript
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

**Validation**:
- TypeScript compiles without errors
- Manual test: Post invalid URL, wait for error
- Verify error appears in thread AND channel timeline
- Verify channel members receive error notification

**Dependencies**: T007 (deletion logic from Part 1)
**Estimated Time**: 10 minutes

---

## Phase 4: Testing & Validation

All testing is manual via Slack (no automated tests per project standards).

### T010 - Manual End-to-End Testing [US1 + US2]

**Action**: Comprehensive manual testing in Slack workspace
**Stories**: US1 + US2 (both stories tested together)

**Test Case 1: Successful Processing with US1 + US2**
1. Open Slack test channel
2. Post URL and mention bot in thread
3. **Observe US1**: Acknowledgment appears: "✅ リクエストを受け付けました..."
4. Check database: `SELECT ack_message_ts FROM requests ORDER BY id DESC LIMIT 1;`
   - Should see timestamp like "1234567890.123456"
5. Wait for processing to complete (~10-15 minutes)
6. **Validate US1**:
   - ✅ Acknowledgment disappears (deleted)
   - ✅ Only completion message visible in thread
7. **Validate US2**:
   - ✅ Completion message appears in thread
   - ✅ Completion message appears in channel timeline with "replied in thread"
   - ✅ Channel members not in thread receive notification
   - ✅ Clicking notification navigates to thread

**Test Case 2: Manual Acknowledgment Deletion (US1 Edge Case)**
1. Post request → acknowledgment appears
2. Manually delete acknowledgment message via Slack UI (before completion)
3. Wait for completion
4. **Validate**:
   - ✅ No error in bot logs (graceful handling)
   - ✅ Completion message posted successfully (US2)
   - ✅ Log shows: "Acknowledgment already deleted (manual user deletion)"

**Test Case 3: Error Scenario with US1 + US2**
1. Post invalid/inaccessible URL and mention bot
2. **Observe US1**: Acknowledgment appears
3. Wait for error (~2-3 minutes)
4. **Validate US1**:
   - ✅ Acknowledgment disappears (deleted)
   - ✅ Only error message visible
5. **Validate US2**:
   - ✅ Error message appears in thread
   - ✅ Error message appears in channel timeline
   - ✅ Channel members receive error notification

**Test Case 4: Backward Compatibility (US1)**
1. Find old request in database (created before migration):
   ```sql
   SELECT id, ack_message_ts FROM requests WHERE ack_message_ts IS NULL LIMIT 1;
   ```
2. If no old requests exist, this test is optional (new deployments)
3. **Validate**:
   - ✅ Old requests with NULL ack_message_ts don't cause errors
   - ✅ Completion messages still use reply_broadcast (US2)
   - ✅ No deletion attempt (NULL check works)

**Validation Checklist**:
- [ ] **US1 - Message Cleanup**:
  - [ ] Acknowledgment posted and timestamp stored in database
  - [ ] Acknowledgment deleted on successful completion
  - [ ] Acknowledgment deleted on error completion
  - [ ] Manual deletion handled gracefully
  - [ ] Deletion failures don't prevent completion messages
  - [ ] Appropriate log levels (info/warn, not error for deletion failures)
  - [ ] Old requests with NULL timestamp handled correctly
- [ ] **US2 - Channel Broadcast**:
  - [ ] Completion message uses `reply_broadcast: true`
  - [ ] Error message uses `reply_broadcast: true`
  - [ ] Messages appear in both thread and channel timeline
  - [ ] Channel members receive notifications
  - [ ] Clicking notification navigates to thread
- [ ] **Combined User Experience**:
  - [ ] Thread shows only final result (clean history from US1)
  - [ ] Channel timeline shows completion (visibility from US2)
  - [ ] No user-facing errors for edge cases
  - [ ] All functional requirements satisfied (FR-001 through FR-007)

**Dependencies**: T001-T009 (all implementation tasks)
**Estimated Time**: 1 hour (including waiting for NotebookLM processing)

---

## Task Summary

### Total Tasks: 10
- **Setup/Foundational**: 2 tasks (T001-T002)
- **User Story 1 (P1)**: 5 tasks (T003-T007)
- **User Story 2 (P1)**: 2 tasks (T008-T009)
- **Testing**: 1 task (T010)

### Task Breakdown by User Story

| User Story | Tasks | Estimated Time |
|------------|-------|----------------|
| Setup & Infrastructure | T001-T002 | 25 min |
| US1 - クリーンな会話履歴の維持 | T003-T007 | 75 min |
| US2 - チャンネル全体への通知 | T008-T009 | 25 min |
| Testing & Validation | T010 | 60 min |
| **Total** | **10 tasks** | **185 min (3+ hours)** |

### Parallel Execution Opportunities

Due to the sequential nature of this feature (US2 depends on US1's deletion logic being in place), most tasks must be executed sequentially:

**Sequential Dependencies**:
- T001 → T002 (migration file → migration system)
- T002 → T003, T004 (schema → database methods)
- T003 → T005 (updateAckMessageTs → capture timestamp)
- T004 → T006, T007 (getRequest → deletion logic)
- T006 → T008 (deletion → broadcast for success)
- T007 → T009 (deletion → broadcast for error)
- T001-T009 → T010 (all implementation → testing)

**Potential Parallel Work**:
- T003 and T004 can be implemented in parallel [P] (different methods, no dependencies)
- T006 and T007 can be implemented in parallel [P] after T004 (different methods)
- T008 and T009 can be implemented in parallel [P] after T006/T007 (different methods)

**Execution Strategy**:
```
Phase 1 (Foundational):
  T001 (5m) → T002 (20m)

Phase 2 (US1):
  [P] T003 (15m) + T004 (10m) → T005 (15m) → [P] T006 (20m) + T007 (15m)

Phase 3 (US2):
  [P] T008 (15m) + T009 (10m)

Phase 4 (Testing):
  T010 (60m)

Total: ~3 hours implementation + 1 hour testing = 4 hours
```

---

## Dependencies Graph

```
T001 (Migration File)
  ↓
T002 (Migration System)
  ↓
  ├→ T003 (updateAckMessageTs) ──→ T005 (Capture timestamp)
  │                                   ↓
  └→ T004 (getRequest) ──────────→ T006 (Delete on success) ──→ T008 (Broadcast success) ──┐
                                     ↓                                                        │
                                   T007 (Delete on error) ──→ T009 (Broadcast error) ────────┤
                                                                                              ↓
                                                                                            T010 (Testing)
```

---

## Implementation Strategy

### MVP Scope (Both User Stories)

Both US1 and US2 are P1 and tightly coupled - they should be implemented together:
- **US1 (Clean History)**: Core functionality - delete acknowledgment messages
- **US2 (Channel Visibility)**: Core functionality - broadcast to channel

Both stories require the same code modifications and share the same completion handlers. Implementing them separately would require refactoring.

**Recommended MVP**: Implement all 10 tasks (T001-T010) as a single unit.

### Incremental Delivery

If incremental delivery is required:

**Milestone 1** (1 hour): Database foundation
- T001-T002: Migration system ready
- T003-T004: Database methods ready
- Checkpoint: Database schema updated, methods available

**Milestone 2** (1 hour): US1 message cleanup
- T005: Capture timestamps
- T006-T007: Delete messages
- Checkpoint: Acknowledgments are deleted (but no channel broadcast yet)

**Milestone 3** (30 min): US2 channel broadcast
- T008-T009: Add reply_broadcast
- Checkpoint: Full feature complete, ready for testing

**Milestone 4** (1 hour): Validation
- T010: Complete manual testing
- Checkpoint: All acceptance criteria validated

### Rollback Strategy

If issues occur:
1. **Database migration issue**: Schema change is additive (non-breaking)
   - Rollback: Not required - NULL values handled gracefully
2. **Deletion failures**: Already handled gracefully (FR-006)
   - Rollback: Not required - failures logged but don't block completion
3. **Broadcast issues**: Standard Slack API parameter
   - Rollback: Remove `reply_broadcast: true`, revert to thread-only messages

---

## Success Criteria Validation

After completing all tasks, verify:

- ✅ **SC-001**: 処理完了後、スレッド内には結果メッセージのみが残り、受領確認メッセージは削除されている（100%のケース）
  - Test: T010 Test Cases 1, 2, 3

- ✅ **SC-002**: 処理完了メッセージは100%のケースでチャンネルのメインタイムラインにも表示される（`reply_broadcast: true` により）
  - Test: T010 Test Cases 1, 3

- ✅ **SC-003**: 受領確認メッセージの削除失敗がユーザー体験に影響を与えない（処理完了メッセージは常に投稿される）
  - Test: T010 Test Case 2 (manual deletion scenario)

- ✅ **SC-004**: ユーザーがスレッドの会話履歴をレビューする際、中間ステータスメッセージに妨げられることなく結果を確認できる
  - Test: T010 Test Case 1 (clean thread history)

---

## Notes

- **No automated tests**: Per project standards, all testing is manual via Slack
- **Coupled user stories**: US1 and US2 are implemented together as they modify the same code paths
- **Error handling**: Deletion failures are non-critical per FR-006 - always post completion
- **Backward compatibility**: NULL ack_message_ts for old requests is handled gracefully
- **Logging strategy**: Use appropriate log levels (info for success, warn for non-critical failures)

---

**Ready for implementation**: All design artifacts complete, task breakdown ready, estimated time 3-4 hours total.
