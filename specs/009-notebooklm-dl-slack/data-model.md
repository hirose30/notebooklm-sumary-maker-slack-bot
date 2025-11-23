# Data Model: NotebookLM Infographic Support

**作成日**: 2025-11-22
**機能**: NotebookLMインフォグラフィックのダウンロードとSlack表示
**バージョン**: 1.0.0

## Overview

この機能では、既存のSQLiteデータベーススキーマを拡張し、インフォグラフィックメディアタイプとSlackファイルメタデータのサポートを追加します。音声・動画サマリーと同様のパターンを維持しながら、Slack固有のファイル情報（file_id, permalink）を追跡できるようにします。

## Schema Changes

### 1. `media` Table Extension

**既存テーブル**: `media` (src/db/migrations/001_initial.sql:26-36)

**追加カラム**:

```sql
-- Migration 005: Add Slack file metadata columns
ALTER TABLE media ADD COLUMN slack_file_id TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN slack_permalink TEXT DEFAULT NULL;
```

**拡張後の完全なテーブル定義**:

```sql
CREATE TABLE media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  media_type TEXT NOT NULL,          -- 'audio', 'video', 'infographic'
  r2_key TEXT NOT NULL,
  r2_url TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  file_size INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  slack_file_id TEXT DEFAULT NULL,   -- [新規] Slack file upload ID
  slack_permalink TEXT DEFAULT NULL, -- [新規] Slack file permalink URL
  FOREIGN KEY (request_id) REFERENCES requests(id)
);

CREATE INDEX IF NOT EXISTS idx_media_request_id ON media(request_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_slack_file_id ON media(slack_file_id); -- [新規]
```

#### カラム詳細

| カラム名 | 型 | NULL許可 | 説明 |
|---------|---|---------|------|
| `slack_file_id` | TEXT | YES | Slackにアップロードされたファイルの一意ID（`files.uploadV2`レスポンスから取得）。インフォグラフィック専用だが、将来的に音声・動画もSlack直接アップロードに移行する場合に備えて全メディアタイプで利用可能 |
| `slack_permalink` | TEXT | YES | Slackファイルのパーマリンク URL。ユーザーがブラウザで直接ファイルを開く際に使用 |

#### データフロー

```
NotebookLM → Playwright Download → Local Buffer
  ↓
R2 Storage Upload (audio/video pattern)
  ↓
[新規] Slack files.uploadV2 (infographic only)
  ↓
media table: INSERT (r2_key, r2_url, slack_file_id, slack_permalink)
```

### 2. Type Definitions Extension

**TypeScript型定義の更新** (src/services/simple-queue.ts相当):

```typescript
// MediaType enum extension
export type MediaType = 'audio' | 'video' | 'infographic'; // [拡張] 'infographic'追加

// MediaRecord interface extension
export interface MediaRecord {
  id?: number;
  request_id: number;
  media_type: MediaType;
  r2_key: string;
  r2_url: string;
  expires_at: number;
  file_size?: number;
  created_at?: number;
  slack_file_id?: string;    // [新規]
  slack_permalink?: string;  // [新規]
}

// Slack file upload result type
export interface SlackFileUploadResult {
  file_id: string;
  permalink: string;
  title?: string;
  created?: number;
}
```

### 3. Migration Script

**ファイルパス**: `src/db/migrations/005_add_infographic_support.sql`

```sql
-- Migration 005: Add Infographic Support
-- Date: 2025-11-22
-- Purpose: Add Slack file metadata columns to support infographic uploads

BEGIN TRANSACTION;

-- Add Slack file metadata columns
ALTER TABLE media ADD COLUMN slack_file_id TEXT DEFAULT NULL;
ALTER TABLE media ADD COLUMN slack_permalink TEXT DEFAULT NULL;

-- Create index for Slack file lookups
CREATE INDEX IF NOT EXISTS idx_media_slack_file_id ON media(slack_file_id);

-- Update schema version
INSERT INTO schema_migrations (version, applied_at)
VALUES (5, strftime('%s', 'now'));

COMMIT;
```

## Data Validation Rules

### 1. media_type Constraint

```typescript
const VALID_MEDIA_TYPES: MediaType[] = ['audio', 'video', 'infographic'];

function validateMediaType(type: string): asserts type is MediaType {
  if (!VALID_MEDIA_TYPES.includes(type as MediaType)) {
    throw new Error(`Invalid media_type: ${type}`);
  }
}
```

### 2. Slack File Metadata Validation

```typescript
interface SlackFileValidation {
  // File ID format: F + 10文字の英数字
  file_id_pattern: /^F[A-Z0-9]{10}$/;

  // Permalink format: https://workspace.slack.com/files/...
  permalink_pattern: /^https:\/\/[a-z0-9-]+\.slack\.com\/files\/.+$/;
}

function validateSlackFileId(fileId: string): boolean {
  return /^F[A-Z0-9]{10}$/.test(fileId);
}

function validateSlackPermalink(permalink: string): boolean {
  return /^https:\/\/[a-z0-9-]+\.slack\.com\/files\/.+$/.test(permalink);
}
```

### 3. File Size Constraints (FR-008)

```typescript
const FILE_SIZE_LIMITS = {
  slack_max: 1024 * 1024 * 1024,  // 1GB (Slack有料プラン上限)
  slack_free: 5 * 1024 * 1024,     // 5MB (Slack無料プラン上限)
  expected_infographic: 10 * 1024 * 1024,  // 10MB (前提条件より)
};

function validateFileSize(size: number, workspacePlan: 'free' | 'paid'): boolean {
  const limit = workspacePlan === 'free'
    ? FILE_SIZE_LIMITS.slack_free
    : FILE_SIZE_LIMITS.slack_max;

  if (size > limit) {
    logger.warn('File size exceeds Slack limit', { size, limit, workspacePlan });
    return false;
  }
  return true;
}
```

## State Transitions

### Media Record Lifecycle

```
[1] NotebookLM Generation Detected
  ↓
[2] Download to Buffer (Playwright)
  ↓
[3] Upload to R2 Storage
  ↓ INSERT INTO media (request_id, media_type='infographic', r2_key, r2_url, ...)
[4] media record created (slack_file_id=NULL, slack_permalink=NULL)
  ↓
[5] Slack files.uploadV2 API call
  ↓
  ├─ SUCCESS → UPDATE media SET slack_file_id=?, slack_permalink=? WHERE id=?
  │            [6] Complete state: All fields populated
  └─ FAILURE → [7] Partial state: slack_file_id=NULL, slack_permalink=NULL
               (FR-003: リトライなし、音声・動画のみ投稿)
```

### Query Patterns

```sql
-- インフォグラフィック検索
SELECT * FROM media
WHERE media_type = 'infographic'
  AND request_id = ?;

-- Slack投稿済みインフォグラフィック検索
SELECT * FROM media
WHERE media_type = 'infographic'
  AND slack_file_id IS NOT NULL;

-- 特定リクエストの全メディア取得（音声・動画・インフォグラフィック）
SELECT * FROM media
WHERE request_id = ?
ORDER BY
  CASE media_type
    WHEN 'audio' THEN 1
    WHEN 'video' THEN 2
    WHEN 'infographic' THEN 3
  END;

-- Slack投稿失敗したインフォグラフィック検索（デバッグ用）
SELECT m.*, r.url as source_url
FROM media m
JOIN requests r ON m.request_id = r.id
WHERE m.media_type = 'infographic'
  AND m.slack_file_id IS NULL
  AND m.created_at > strftime('%s', 'now', '-7 days');
```

## Relationships

```
requests (1) ──────── (N) media
   ↑                       ↑
   │                       │
   │                   media_type ∈ {'audio', 'video', 'infographic'}
   │                       │
   └─ url (source)     ├─ audio: R2 only
                       ├─ video: R2 only
                       └─ infographic: R2 + Slack (slack_file_id, slack_permalink)
```

## Migration Rollback Plan

```sql
-- Rollback Migration 005
BEGIN TRANSACTION;

-- Drop indexes
DROP INDEX IF EXISTS idx_media_slack_file_id;

-- Remove columns (SQLite limitation: requires table recreation)
CREATE TABLE media_backup AS SELECT
  id, request_id, media_type, r2_key, r2_url,
  expires_at, file_size, created_at
FROM media;

DROP TABLE media;

ALTER TABLE media_backup RENAME TO media;

-- Recreate original indexes
CREATE INDEX IF NOT EXISTS idx_media_request_id ON media(request_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);

-- Rollback schema version
DELETE FROM schema_migrations WHERE version = 5;

COMMIT;
```

## Performance Considerations

### Index Strategy

```sql
-- 既存インデックス（変更なし）
CREATE INDEX idx_media_request_id ON media(request_id); -- リクエスト単位のメディア検索
CREATE INDEX idx_media_type ON media(media_type);       -- メディアタイプ別集計

-- 新規インデックス
CREATE INDEX idx_media_slack_file_id ON media(slack_file_id); -- Slack file ID検索
```

**インデックス選択根拠**:
- `slack_file_id`インデックス: Slackからのイベント（ファイル削除通知など）で逆引きが必要な場合に備える
- `slack_permalink`はインデックス不要: URL検索は想定されず、フルテキスト検索が必要な場合は別途FTSテーブルを検討

### Storage Estimates

```
既存:
  - requests: 約200 bytes/row
  - media: 約150 bytes/row (audio/video)

追加（インフォグラフィック）:
  - media: 約200 bytes/row (slack_file_id, slack_permalink追加)

1000リクエスト/日 × 30日 × 3メディアタイプ = 90,000 rows
90,000 × 200 bytes ≈ 18MB/month

SQLite性能: 18MBは十分小さく、パフォーマンス問題なし
```

## Backward Compatibility

### 既存データへの影響

```sql
-- Migration実行前の既存mediaレコード
SELECT id, media_type, slack_file_id, slack_permalink FROM media;
/*
  id | media_type | slack_file_id | slack_permalink
  ---+------------+---------------+----------------
  1  | audio      | NULL          | NULL
  2  | video      | NULL          | NULL
  ...
*/
```

**互換性保証**:
1. `ALTER TABLE ADD COLUMN ... DEFAULT NULL` により、既存レコードは自動的にNULLが設定される
2. 既存のaudio/videoレコードは`slack_file_id=NULL`のまま動作継続（R2 URLベースのフロー）
3. 新規インフォグラフィックのみSlackファイル情報を持つ（オプトイン方式）

### TypeScript型の後方互換性

```typescript
// Before (既存)
interface MediaRecord {
  id?: number;
  request_id: number;
  media_type: 'audio' | 'video';
  r2_key: string;
  r2_url: string;
  expires_at: number;
  file_size?: number;
  created_at?: number;
}

// After (拡張)
interface MediaRecord {
  id?: number;
  request_id: number;
  media_type: 'audio' | 'video' | 'infographic'; // [拡張]
  r2_key: string;
  r2_url: string;
  expires_at: number;
  file_size?: number;
  created_at?: number;
  slack_file_id?: string;    // [新規] Optional - 既存コード影響なし
  slack_permalink?: string;  // [新規] Optional - 既存コード影響なし
}

// 既存コードは引き続き動作
const audioRecord: MediaRecord = {
  request_id: 1,
  media_type: 'audio',  // OK
  r2_key: 'audio/123.mp3',
  r2_url: 'https://...',
  expires_at: Date.now(),
  // slack_file_id, slack_permalink は省略可能
};
```
