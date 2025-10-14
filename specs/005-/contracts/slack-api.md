# Slack API Contracts

**Feature**: 005- Slack メッセージクリーンアップと通知改善
**Date**: 2025-10-15

## Overview

This document defines the Slack API contracts used by this feature. All contracts are external APIs provided by Slack (@slack/bolt SDK).

## Contract 1: Post Acknowledgment Message

**API**: `chat.postMessage` (existing, modified usage)

**Purpose**: Post acknowledgment message and capture timestamp for later deletion

### Request

```typescript
interface ChatPostMessageRequest {
  channel: string;      // Slack channel ID (e.g., "C123456789")
  thread_ts: string;    // Thread timestamp to reply to
  text: string;         // Message text
  // reply_broadcast: NOT used for acknowledgment (thread-only message)
}
```

**Example**:
```typescript
const response = await client.chat.postMessage({
  channel: 'C123456789',
  thread_ts: '1234567890.123456',
  text: '✅ リクエストを受け付けました\n\n🔄 処理キューに追加しました (Job ID: 42)\n処理が完了したらこのスレッドに結果を投稿します。'
});
```

### Response

```typescript
interface ChatPostMessageResponse {
  ok: boolean;         // Success indicator
  ts: string;          // Message timestamp (CRITICAL: needed for deletion)
  channel: string;     // Channel where posted
  message?: {          // Full message object (optional)
    text: string;
    ts: string;
    // ... other fields
  };
  error?: string;      // Error code if ok = false
}
```

**Success Example**:
```typescript
{
  ok: true,
  ts: '1234567891.234567',  // ← Store this for deletion
  channel: 'C123456789',
  message: {
    text: '✅ リクエストを受け付けました...',
    ts: '1234567891.234567'
  }
}
```

**Error Example**:
```typescript
{
  ok: false,
  error: 'channel_not_found'
}
```

### Integration Point

**SlackBot Event Handler** (`src/services/slack-bot.ts:98-103`):

```typescript
// BEFORE (current):
await this.replyToThread(
  client,
  event.channel,
  event.ts,
  `✅ リクエストを受け付けました\n\n🔄 処理キューに追加しました (Job ID: ${jobId})...`
);

// AFTER (modified to capture ts):
const ackResponse = await client.chat.postMessage({
  channel: event.channel,
  thread_ts: event.ts,
  text: `✅ リクエストを受け付けました\n\n🔄 処理キューに追加しました (Job ID: ${jobId})...`
});

// Store timestamp for later deletion
this.queue.updateAckMessageTs(jobId, ackResponse.ts);
```

### Error Handling

**Possible Errors**:
- `channel_not_found`: Invalid channel ID
- `not_in_channel`: Bot not in channel
- `is_archived`: Channel is archived
- `msg_too_long`: Message text exceeds limit
- `rate_limited`: Rate limit exceeded

**Handling Strategy**:
```typescript
try {
  const ackResponse = await client.chat.postMessage({...});
  this.queue.updateAckMessageTs(jobId, ackResponse.ts);
} catch (error) {
  logger.error('Failed to post acknowledgment', { error, jobId });
  // Don't store ack_message_ts (remains NULL)
  // Continue processing - acknowledgment is nice-to-have, not critical
}
```

---

## Contract 2: Delete Acknowledgment Message

**API**: `chat.delete` (new usage)

**Purpose**: Delete acknowledgment message when processing completes

### Request

```typescript
interface ChatDeleteRequest {
  channel: string;  // Channel where message was posted
  ts: string;       // Message timestamp (from ack_message_ts)
}
```

**Example**:
```typescript
await client.chat.delete({
  channel: 'C123456789',
  ts: '1234567891.234567'  // From database: requests.ack_message_ts
});
```

### Response

```typescript
interface ChatDeleteResponse {
  ok: boolean;      // Success indicator
  channel?: string; // Channel where deleted
  ts?: string;      // Deleted message timestamp
  error?: string;   // Error code if ok = false
}
```

**Success Example**:
```typescript
{
  ok: true,
  channel: 'C123456789',
  ts: '1234567891.234567'
}
```

**Error Examples**:
```typescript
// Message already deleted (manually by user)
{
  ok: false,
  error: 'message_not_found'
}

// Bot doesn't own message
{
  ok: false,
  error: 'cant_delete_message'
}

// Channel archived
{
  ok: false,
  error: 'channel_not_found'
}
```

### Integration Point

**SlackBot Completion Handler** (`src/services/slack-bot.ts:208-243`):

```typescript
// BEFORE (current):
async postCompletionResults(channel, threadTs, jobId) {
  const media = this.queue.getMediaForRequest(jobId);
  // ... build message
  await this.replyToThread(this.app.client, channel, threadTs, message);
}

// AFTER (with deletion and broadcast):
async postCompletionResults(channel, threadTs, jobId) {
  // 1. Delete acknowledgment message first
  try {
    const request = this.queue.getRequest(jobId);
    if (request?.ack_message_ts) {
      await this.app.client.chat.delete({
        channel,
        ts: request.ack_message_ts
      });
      logger.info('Deleted acknowledgment message', { jobId });
    }
  } catch (deleteError) {
    logger.warn('Failed to delete acknowledgment', {
      error: deleteError,
      jobId
    });
    // Continue - deletion failure is non-critical (FR-006)
  }

  // 2. Post completion message with broadcast
  const media = this.queue.getMediaForRequest(jobId);
  // ... build message
  await this.app.client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    reply_broadcast: true,  // NEW: Always broadcast to channel
    text: message
  });
}
```

### Error Handling

**Required Scope**: `chat:write` (already present)

**Error Strategy** (per FR-006):
```typescript
try {
  if (request?.ack_message_ts) {
    await client.chat.delete({ channel, ts: request.ack_message_ts });
    logger.info('Deleted acknowledgment message', { jobId });
  }
} catch (deleteError) {
  // Map known errors to appropriate log levels
  const errorCode = deleteError.data?.error;

  if (errorCode === 'message_not_found') {
    logger.info('Acknowledgment already deleted (manual user deletion)', { jobId });
  } else if (errorCode === 'cant_delete_message') {
    logger.warn('Cannot delete message (permission issue)', { jobId, error: deleteError });
  } else {
    logger.warn('Failed to delete acknowledgment message', { jobId, error: deleteError });
  }

  // NEVER throw - deletion failure must not prevent completion message (FR-006)
}
```

**Idempotency**: Deletion is idempotent - calling delete twice results in `message_not_found` on second call, which is handled gracefully.

---

## Contract 3: Post Completion Message with Broadcast

**API**: `chat.postMessage` (modified usage with reply_broadcast)

**Purpose**: Post completion message visible in both thread and channel timeline

### Request

```typescript
interface ChatPostMessageRequest {
  channel: string;          // Slack channel ID
  thread_ts: string;        // Thread to reply in
  reply_broadcast: true;    // NEW: Always true for completion messages (FR-005)
  text: string;             // Message text
  blocks?: Block[];         // Optional rich formatting (existing usage)
}
```

**Example**:
```typescript
await client.chat.postMessage({
  channel: 'C123456789',
  thread_ts: '1234567890.123456',
  reply_broadcast: true,  // MANDATORY for completion messages
  text: '✅ 処理が完了しました！\n\n<https://r2.example.com/audio.mp3|🎵 音声要約> (2.5 MB)\n\n⏰ リンクは7日間有効です'
});
```

### Response

```typescript
interface ChatPostMessageResponse {
  ok: boolean;
  ts: string;           // Message timestamp
  channel: string;      // Posted channel
  message?: {
    text: string;
    ts: string;
    // ... other fields
  };
  error?: string;
}
```

**Success Response**: Same as acknowledgment message, but with additional Slack UI behavior:
- Message appears in thread (standard thread reply)
- Message ALSO appears in channel timeline with "〜さんがスレッドで返信しました" annotation
- Clicking channel notification navigates to thread context

### Integration Points

**1. Success Completion** (`src/services/slack-bot.ts:208-243`):
```typescript
// BEFORE:
await this.replyToThread(this.app.client, channel, threadTs, message);

// AFTER:
await this.app.client.chat.postMessage({
  channel,
  thread_ts: threadTs,
  reply_broadcast: true,  // Always true (FR-005)
  text: message
});
```

**2. Error Completion** (`src/services/slack-bot.ts:188-202`):
```typescript
// BEFORE:
await this.replyToThread(this.app.client, channel, threadTs, message);

// AFTER:
// 1. Delete acknowledgment (if exists)
try {
  const request = this.queue.getRequest(jobId);
  if (request?.ack_message_ts) {
    await this.app.client.chat.delete({ channel, ts: request.ack_message_ts });
  }
} catch (e) {
  logger.warn('Failed to delete ack on error', { jobId, error: e });
}

// 2. Post error with broadcast
await this.app.client.chat.postMessage({
  channel,
  thread_ts: threadTs,
  reply_broadcast: true,  // Always true (FR-005)
  text: `❌ 処理中にエラーが発生しました（Job ID: ${jobId}）...`
});
```

### Behavior Validation

**User Story 2 Acceptance Criteria** (spec.md:34-38):

Test via manual Slack interaction:
1. Post request → acknowledgment appears in thread only
2. Wait for completion → result appears in:
   - Thread (as reply)
   - Channel timeline (with "replied in thread" annotation)
3. Channel members NOT in thread receive notification
4. Clicking channel notification navigates to full thread

**Required Scope**: `chat:write` (already present)

---

## Contract 4: Database - Store Acknowledgment Timestamp

**API**: Internal database method (new)

**Purpose**: Persist acknowledgment message timestamp for later retrieval

### Method Signature

```typescript
interface SimpleQueue {
  updateAckMessageTs(requestId: number, messageTs: string): void;
}
```

### Implementation

```typescript
// In src/services/simple-queue.ts
updateAckMessageTs(requestId: number, messageTs: string): void {
  // Validate Slack timestamp format
  if (!/^\d+\.\d+$/.test(messageTs)) {
    throw new Error(`Invalid Slack timestamp format: ${messageTs}`);
  }

  const stmt = db.prepare(
    'UPDATE requests SET ack_message_ts = ? WHERE id = ?'
  );

  const result = stmt.run(messageTs, requestId);

  if (result.changes === 0) {
    throw new Error(`Request not found: ${requestId}`);
  }

  logger.info('Stored acknowledgment timestamp', { requestId, messageTs });
}
```

### Error Handling

**Errors**:
- Invalid timestamp format: Throw error (programming error, not user error)
- Request not found: Throw error (programming error - job should exist)
- Database error: Propagate error (system failure)

**Call Site** (SlackBot):
```typescript
try {
  const ackResponse = await client.chat.postMessage({...});
  this.queue.updateAckMessageTs(jobId, ackResponse.ts);
} catch (error) {
  logger.error('Failed to store ack timestamp', { error, jobId });
  // Continue processing - timestamp storage failure is not critical
  // ack_message_ts will remain NULL, deletion will be skipped
}
```

---

## Contract 5: Database - Retrieve Request with Timestamp

**API**: Internal database method (modified)

**Purpose**: Get request details including acknowledgment timestamp for deletion

### Method Signature

```typescript
interface SimpleQueue {
  getRequest(requestId: number): Request | undefined;
}

interface Request {
  id: number;
  url: string;
  slack_channel: string;
  slack_thread_ts: string;
  slack_user: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  current_step: string | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  ack_message_ts: string | null;  // NEW field
}
```

### Implementation

```typescript
// In src/services/simple-queue.ts
getRequest(requestId: number): Request | undefined {
  const stmt = db.prepare('SELECT * FROM requests WHERE id = ?');
  return stmt.get(requestId) as Request | undefined;
}
```

### Usage Example

```typescript
// In completion handler
const request = this.queue.getRequest(jobId);

if (request?.ack_message_ts) {
  // Delete acknowledgment message
  await client.chat.delete({
    channel: request.slack_channel,
    ts: request.ack_message_ts
  });
}
```

### Backward Compatibility

**Old Requests** (created before migration):
```typescript
const request = this.queue.getRequest(oldJobId);
// request.ack_message_ts === null

if (request?.ack_message_ts) {
  // Skipped for old requests (NULL check)
}
```

---

## Summary

### External API Dependencies

| API Method | Scope Required | Purpose | Error Handling |
|------------|----------------|---------|----------------|
| `chat.postMessage` (ack) | `chat:write` | Post acknowledgment, capture ts | Log error, continue (optional) |
| `chat.delete` | `chat:write` | Delete acknowledgment | Log warning, continue (FR-006) |
| `chat.postMessage` (completion) | `chat:write` | Post result with broadcast | Throw error (critical) |

### Internal API Contracts

| Method | Purpose | Error Handling |
|--------|---------|----------------|
| `updateAckMessageTs` | Store message timestamp | Throw error (programming error) |
| `getRequest` | Retrieve request with timestamp | Return undefined if not found |

### Scope Verification

**Current Bot Scopes**: `chat:write`, `app_mentions:read` (existing)

**Required for Feature**: `chat:write` only

**Action Required**: None (already authorized)

### Contract Testing Strategy

**Manual Testing** (no automated Slack API tests available):

1. **Post Acknowledgment**:
   - Verify message appears in thread
   - Verify `ts` captured and stored in database
   - Check database: `SELECT ack_message_ts FROM requests WHERE id = ?`

2. **Delete Acknowledgment**:
   - Verify message disappears from thread
   - Test error case: manually delete message, verify graceful handling
   - Check logs: `logger.warn` for `message_not_found`

3. **Post with Broadcast**:
   - Verify message appears in thread
   - Verify message appears in channel timeline
   - Verify non-thread members see notification
   - Click notification → verify navigates to thread

4. **End-to-End Flow**:
   - Submit request → see acknowledgment
   - Wait for completion → acknowledgment disappears, result appears
   - Check channel timeline → result visible with "replied in thread"
   - Check thread → only result visible, acknowledgment gone

### Deployment Checklist

- [ ] Database migration applied (`002_add_ack_message_ts.sql`)
- [ ] `updateAckMessageTs` method implemented in SimpleQueue
- [ ] `getRequest` method returns new field
- [ ] SlackBot captures `ts` from acknowledgment post
- [ ] SlackBot deletes message before completion
- [ ] SlackBot uses `reply_broadcast: true` for all completions
- [ ] Error handlers also delete acknowledgment and broadcast
- [ ] Logging added for deletion success/failure
- [ ] Manual testing completed (4 test scenarios above)
