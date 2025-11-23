# Technical Research: NotebookLM Infographic Integration

**作成日**: 2025-11-22
**対象機能**: NotebookLMインフォグラフィックのダウンロードとSlack表示
**調査者**: Claude Code

## 1. Executive Summary

本調査では、既存のNotebookLM音声・動画サマリー自動化システムにインフォグラフィックダウンロード機能を追加するための技術的決定事項を分析しました。既存のPlaywrightベースの自動化パターン、Slack Bot API統合、データベーススキーマ、エラーハンドリングパターンを詳細に調査し、一貫性のある実装方針を策定しました。

## 2. Decision 1: インフォグラフィック検出方法

### 選択した方法
**Artifact Card Color-Based Detection（アーティファクトカードの色ベース検出）**

### セレクタ（Chrome DevTools MCP検証済み）
```typescript
const infographicSelector = 'button.artifact-button-content:has(mat-icon.artifact-icon.pink)';
```

### 根拠
既存コードベースの音声・動画検出パターンと完全に一致する実装アプローチ:

**既存パターン（notebooklm-automation.ts:357, 397）:**
- 音声: `button.artifact-button-content:has(mat-icon.artifact-icon.blue)`
- 動画: `button.artifact-button-content:has(mat-icon.artifact-icon.green)`

**実際のNotebookLM UI検証結果（2025-11-22、Chrome DevTools MCP使用）:**
- インフォグラフィック (`stacked_bar_chart` icon): `mat-icon.artifact-icon.pink` ✅
- レポート (`tablet` icon): `mat-icon.artifact-icon.yellow`
- 動画 (`subscriptions` icon): `mat-icon.artifact-icon.green`
- 音声 (`audio_magic_eraser` icon): `mat-icon.artifact-icon.blue`

NotebookLMのUI設計では、各アーティファクトタイプは一貫した色分類を持ち、インフォグラフィックは**pink（ピンク）**色のアイコンで識別されることを実機確認済み。

### 検証完了事項
1. ✅ **実際のインフォグラフィックアイコン色の確認**: Chrome DevTools MCPで実際のNotebookLM UIを調査し、**pink**クラスを使用することを確認
2. **複数インフォグラフィック生成時の挙動**: 仕様（FR-001）では最初の1つのみを処理すると規定されているため、`.first()`ロケータを使用

### 検出コード例
```typescript
// インフォグラフィックカードの検出（pink クラス使用）
const infographicCards = await page.locator(
  'button.artifact-button-content:has(mat-icon.artifact-icon.pink)'
).count();

logger.info(`Infographic artifact cards found: ${infographicCards}`);

// 最初のインフォグラフィックのみを対象（FR-001準拠）
const infographicCard = page.locator(
  'button.artifact-button-content:has(mat-icon.artifact-icon.pink)'
).first();
```

### 代替案として検討した方法
1. **テキストベースセレクタ**: `text="インフォグラフィック"` - 言語依存性が高く、UIバージョン間での一貫性が保証されないため却下
2. **データ属性ベース**: `[data-artifact-type="infographic"]` - 実際のDOM調査が必要だが、NotebookLMが公開APIではないためデータ属性の存在は不確定

## 3. Decision 2: ダウンロード実装方法

### 選択した方法
**Playwright Download Event Pattern（既存の音声・動画と同一パターン）**

### 根拠
既存の`downloadMedia()`メソッド（notebooklm-automation.ts:464-508）と完全に統一されたアプローチを採用:

**既存実装パターン:**
```typescript
async downloadMedia(type: 'audio' | 'video'): Promise<Buffer> {
  const iconClass = type === 'audio' ? 'blue' : 'green';
  const artifactCard = page.locator(
    `button.artifact-button-content:has(mat-icon.artifact-icon.${iconClass})`
  ).first();

  // ハンバーガーメニューをクリック
  await artifactCard.locator('mat-icon:text("more_vert")').click();
  await page.waitForTimeout(500);

  // ダウンロードイベントを待機してダウンロードボタンをクリック
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text="ダウンロード"'),
  ]);

  // バッファに読み込み
  const path = await download.path();
  const buffer = await fs.readFile(path);
  return buffer;
}
```

### 実装する拡張（Chrome DevTools MCP検証済み）
```typescript
async downloadMedia(type: 'audio' | 'video' | 'infographic'): Promise<Buffer> {
  const iconClassMap = {
    audio: 'blue',
    video: 'green',
    infographic: 'pink'  // 新規追加（実機検証済み）
  };
  const iconClass = iconClassMap[type];

  // 以下、既存実装と同一
}
```

### 実機検証結果（2025-11-22）
- ✅ **ダウンロードファイル形式**: PNG
- ✅ **ダウンロードファイルサイズ**: 5.6MB（2752 x 1536解像度）
- ✅ **Slackサイズ制限適合性**: 10MB制限内で問題なし

### 利点
1. **一貫性**: 既存の音声・動画ダウンロードと同一のエラーハンドリング、ログ出力、リトライロジック
2. **信頼性**: Playwrightの`download`イベントは自動的にブラウザのダウンロードマネージャーを処理
3. **メンテナンス性**: 単一のメソッドで3種類のメディアタイプを統一的に管理

### 代替案として検討した方法
1. **直接HTTP GET**: ダウンロードURLを抽出してfetchで取得 - NotebookLMの認証トークンやCORS制約により実装困難
2. **CDPベースのダウンロード**: Chrome DevTools Protocolを使用 - Playwrightの抽象化レイヤーを迂回するため保守性が低下

## 4. Decision 3: Slackファイルアップロード方法

### 選択した方法
**Slack WebClient files.uploadV2 API（既存実装への統合）**

### 既存実装分析
現在、Slack投稿は`postCompletionResults()`メソッド（slack-bot.ts:323-400）でR2の署名付きURLリンクのみを投稿:

```typescript
let message = '✅ 処理が完了しました！\n\n';
if (audioMedia) {
  message += `<${audioMedia.r2PublicUrl}|🎵 音声要約> (${audioSize})\n`;
}
if (videoMedia) {
  message += `<${videoMedia.r2PublicUrl}|🎬 動画要約> (${videoSize})\n`;
}
```

### 新規実装アプローチ

**Option A: R2アップロード + URL埋め込み（既存パターン踏襲）**
```typescript
// インフォグラフィックもR2にアップロード
const infographicBuffer = await notebooklm.downloadMedia('infographic');
const infographicKey = await storage.uploadMedia(
  infographicBuffer,
  `infographic-${jobId}.png`,
  'image/png'
);
const infographicUrl = await storage.getPublicUrl(infographicKey);

// Slackメッセージに画像URLを含める
message += `<${infographicUrl}|📊 インフォグラフィック> (${size})\n`;
```

**Option B: 直接Slackファイルアップロード（推奨）**
```typescript
// インフォグラフィックのみSlackに直接アップロード
const client = this.getClientForWorkspace(request.workspaceId);

// ファイルアップロード（Slackのサムネイル生成を活用）
await client.files.uploadV2({
  channel_id: channel,
  thread_ts: threadTs,
  file: infographicBuffer,
  filename: `infographic-${jobId}.png`,
  initial_comment: '📊 インフォグラフィック'
});
```

### 推奨方法: **Option B - 直接Slackファイルアップロード**

### 根拠
1. **仕様要件（FR-004）**: "インフォグラフィックがSlackメッセージスレッド内で表示可能なサムネイルとして表示されることを保証" - Slack APIの自動サムネイル生成機能を活用
2. **ストレージ効率**: R2ストレージコストを削減（インフォグラフィックはSlack側でホスト）
3. **表示品質**: Slackのネイティブ画像レンダリングによる最適な表示

### 実装時の注意点
1. **ファイルサイズ検証（FR-008）**: Slackの制限（通常プラン: 1GB、無料プラン: 最大ファイルサイズはワークスペース設定による）
2. **エラーハンドリング（FR-003）**: アップロード失敗時は即座に失敗扱い、リトライしない
3. **MIME Type**: `image/png`を明示的に指定（NotebookLMはPNG形式で提供）

### 代替案として検討した方法
- **Option A（R2経由）**: 音声・動画との一貫性は高いが、仕様要件のサムネイル表示が保証されない
- **Slack Attachments API**: 非推奨（Slack公式は`files.uploadV2`を推奨）

## 5. Decision 4: データベーススキーマ拡張

### 選択した方法
**既存mediaテーブルのmedia_type ENUMを拡張**

### 既存スキーマ分析（001_initial.sql:20-32）
```sql
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL,
  media_type TEXT NOT NULL, -- audio, video
  filename TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  r2_public_url TEXT NOT NULL,
  file_size INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (request_id) REFERENCES requests(id)
);
```

### マイグレーションSQL
```sql
-- Migration: 005_add_infographic_support.sql

-- media_typeにinfographicを追加（コメント更新）
-- SQLiteはENUM制約をサポートしないため、アプリケーションレイヤーで検証

-- インフォグラフィック用の新しいカラムを追加（オプション）
ALTER TABLE media ADD COLUMN slack_file_id TEXT;  -- Slackにアップロードした場合のfile ID
ALTER TABLE media ADD COLUMN slack_permalink TEXT;  -- Slack上のファイルパーマリンク

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_media_type ON media(media_type);
CREATE INDEX IF NOT EXISTS idx_media_slack_file_id ON media(slack_file_id);
```

### TypeScript型定義の更新
```typescript
// simple-queue.ts
export interface MediaRecord {
  id?: number;
  requestId: number;
  mediaType: 'audio' | 'video' | 'infographic';  // 拡張
  filename: string;
  r2Key: string;
  r2PublicUrl: string;
  fileSize: number;
  expiresAt: string;
  slackFileId?: string;      // 新規追加
  slackPermalink?: string;   // 新規追加
}
```

### 根拠
1. **最小限の変更**: 既存のテーブル構造を活用し、新規テーブル作成を回避
2. **型安全性**: TypeScriptの型システムでメディアタイプを厳密に管理
3. **拡張性**: 将来的に他のメディアタイプ（例: PDF、スライド）を追加可能

### 代替案として検討した方法
1. **新規infographicsテーブル**: オーバーエンジニアリング、既存のmediaテーブルで十分
2. **JSONカラムで追加メタデータ**: SQLiteのJSON機能は限定的、明示的なカラムの方が保守性が高い

## 6. Decision 5: エラーハンドリングパターン

### 選択した方法
**既存のリトライロジック + 部分的成功パターンの拡張**

### 既存パターン分析

**1. リトライメカニズム（notebooklm-automation.ts:33-67）**
```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 30000,
};

async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = RETRY_CONFIG.maxRetries
): Promise<T> {
  // Exponential backoff: 2s, 4s, 8s...
}
```

**2. 部分的失敗処理（request-processor.ts:169-189）**
```typescript
catch (error) {
  logger.error('Failed to process request', { error, id: job.id });

  this.queue.updateJobStatus(job.id, 'failed', {
    errorMessage: errorObj.message,
  });

  if (this.onJobError) {
    await this.onJobError(job, errorObj);
  }

  // 他のジョブの処理を継続
  logger.info('Continuing to next job after error', { id: job.id });
}
```

### インフォグラフィック統合のエラーハンドリング戦略

**P1: インフォグラフィック生成失敗（仕様 FR-007、User Story 3）**
```typescript
async processRequest(job: QueueJob): Promise<void> {
  let audioBuffer: Buffer | null = null;
  let videoBuffer: Buffer | null = null;
  let infographicBuffer: Buffer | null = null;

  try {
    // 音声・動画生成（既存）
    await notebooklm.generateBothOverviews();
    audioBuffer = await notebooklm.downloadMedia('audio');
    videoBuffer = await notebooklm.downloadMedia('video');

    // インフォグラフィック生成（新規）
    try {
      // タイムアウトは既存の音声・動画と同じ値を使用（FR-006）
      infographicBuffer = await notebooklm.downloadMedia('infographic');
      logger.info('Infographic downloaded successfully');
    } catch (infographicError) {
      // インフォグラフィック失敗は警告レベル、処理継続（FR-007）
      logger.warn('Infographic generation failed, continuing with audio/video', {
        error: infographicError,
        jobId: job.id
      });
    }

    // R2アップロード（音声・動画は必須、インフォグラフィックは任意）
    await this.uploadMedia(job.id, audioBuffer, videoBuffer, infographicBuffer);

    this.queue.updateJobStatus(job.id, 'completed');

  } catch (criticalError) {
    // 音声・動画の失敗は致命的エラー
    this.queue.updateJobStatus(job.id, 'failed');
    if (this.onJobError) {
      await this.onJobError(job, criticalError);
    }
  }
}
```

**P2: Slackアップロード失敗（仕様 FR-003）**
```typescript
// Slackファイルアップロード（リトライなし）
try {
  if (infographicBuffer) {
    await client.files.uploadV2({
      channel_id: channel,
      thread_ts: threadTs,
      file: infographicBuffer,
      filename: `infographic-${jobId}.png`,
    });
    logger.info('Infographic uploaded to Slack');
  }
} catch (uploadError) {
  // アップロード失敗は即座に失敗扱い（FR-003）
  logger.error('Infographic Slack upload failed, posting without image', {
    error: uploadError,
    jobId
  });
  // 音声・動画のみでメッセージ投稿を継続
}
```

**P3: ファイルサイズ超過（仕様 FR-008）**
```typescript
// ダウンロード後の検証
if (infographicBuffer) {
  const MAX_SLACK_FILE_SIZE = 1024 * 1024 * 1024; // 1GB（通常プラン）

  if (infographicBuffer.length > MAX_SLACK_FILE_SIZE) {
    logger.warn('Infographic exceeds Slack size limit, skipping upload', {
      size: infographicBuffer.length,
      limit: MAX_SLACK_FILE_SIZE,
      jobId
    });
    infographicBuffer = null; // アップロードをスキップ
  }
}
```

### 根拠
1. **仕様準拠**: FR-003（アップロード失敗時即座に失敗）、FR-007（音声・動画投稿をブロックしない）
2. **既存パターンとの整合性**: `withRetry()`の再利用、部分的成功の許容
3. **ユーザー体験**: インフォグラフィック失敗でも音声・動画は確実に配信

### ログレベルガイドライン
```typescript
// 成功: INFO
logger.info('Infographic downloaded successfully', { size, jobId });

// 部分的失敗（継続可能）: WARN
logger.warn('Infographic generation failed, continuing with audio/video');

// 致命的失敗: ERROR
logger.error('Failed to process request', { error, jobId });
```

## 7. 既存のパターンに従うべき実装詳細

### 7.1 ファイル命名規則
**既存パターン（request-processor.ts:111, 135）:**
```typescript
const audioFilename = `audio-${job.id}.m4a`;
const videoFilename = `video-${job.id}.mp4`;
```

**インフォグラフィック:**
```typescript
const infographicFilename = `infographic-${job.id}.png`;
```

### 7.2 ログ出力パターン
**既存パターン（notebooklm-automation.ts:497-501）:**
```typescript
logger.info('Media downloaded successfully', {
  type,
  size: buffer.length,
  filename: download.suggestedFilename(),
});
```

**インフォグラフィック:**
```typescript
logger.info('Infographic downloaded successfully', {
  type: 'infographic',
  size: buffer.length,
  filename: download.suggestedFilename(),
});
```

### 7.3 R2ストレージパス
**既存パターン（cloudflare-storage.ts:47-49）:**
```typescript
const timestamp = Date.now();
const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
const key = `media/${timestamp}-${sanitizedFilename}`;
```

インフォグラフィックも同一パスパターン: `media/1700000000000-infographic-123.png`

### 7.4 Workspace Context統合
**既存パターン（request-processor.ts:47-51）:**
```typescript
const userDataDir = workspace?.workspaceKey
  ? `./user-data-${workspace.workspaceKey}`
  : './user-data';
const uiVersion = workspace?.uiVersion || 'old';
const notebooklm = new NotebookLMAutomation(userDataDir, uiVersion);
```

インフォグラフィックダウンロードも同一のWorkspace Context内で実行されるため、追加の統合は不要。

### 7.5 進捗状況トラッキング
**既存パターン（request-processor.ts:82-86）:**
```typescript
this.queue.updateJobStatus(job.id, 'processing', {
  progress: 40,
  currentStep: 'Generating audio and video',
});
```

**インフォグラフィック統合:**
```typescript
// 生成フェーズ
this.queue.updateJobStatus(job.id, 'processing', {
  progress: 40,
  currentStep: 'Generating audio, video, and infographic',
});

// ダウンロードフェーズ
this.queue.updateJobStatus(job.id, 'processing', {
  progress: 75,
  currentStep: 'Downloading infographic',
});
```

## 8. 統合ポイント

### 8.1 NotebookLMAutomation Service
**ファイル**: `src/services/notebooklm-automation.ts`

**変更箇所:**
1. `downloadMedia()`メソッドの拡張:
   ```typescript
   async downloadMedia(type: 'audio' | 'video' | 'infographic'): Promise<Buffer>
   ```

2. インフォグラフィック生成検出ロジック:
   ```typescript
   async generateAllOverviews(): Promise<void> {
     // 音声・動画・インフォグラフィックを並列生成
     await page.locator(selectors.generateNotebook).click();  // 音声
     await page.locator('div.green.create-artifact-button-container:has-text("動画解説")').click();  // 動画
     // インフォグラフィック生成ボタンのセレクタを追加（UI調査後）

     // 完了待機
     await Promise.all([
       page.waitForSelector(':text("音声解説を生成しています")', { state: 'hidden' }),
       page.waitForSelector(':text("動画解説を生成しています")', { state: 'hidden' }),
       page.waitForSelector(':text("インフォグラフィックを生成しています")', { state: 'hidden' }),
     ]);
   }
   ```

### 8.2 Request Processor
**ファイル**: `src/services/request-processor.ts`

**変更箇所:**
1. インフォグラフィックダウンロード追加（L89-103付近）:
   ```typescript
   // Download infographic (optional)
   let infographicBuffer: Buffer | null = null;
   try {
     this.queue.updateJobStatus(job.id, 'processing', {
       progress: 75,
       currentStep: 'Downloading infographic',
     });

     infographicBuffer = await notebooklm.downloadMedia('infographic');
   } catch (infographicError) {
     logger.warn('Infographic download failed, continuing without it', {
       error: infographicError,
       jobId: job.id
     });
   }
   ```

2. R2アップロード（オプション、Option Aの場合）またはSlackアップロード前のバッファ保持

### 8.3 Slack Bot Service
**ファイル**: `src/services/slack-bot.ts`

**変更箇所:**
1. `postCompletionResults()`メソッド内（L323-400）:
   ```typescript
   async postCompletionResults(channel, threadTs, jobId) {
     const media = this.queue.getMediaForRequest(jobId);
     const infographicMedia = media.find(m => m.mediaType === 'infographic');

     // インフォグラフィックが存在する場合、Slackに直接アップロード
     if (infographicMedia && infographicMedia.slackFileId) {
       // 既にアップロード済み（Option B）
     } else if (infographicBuffer) {
       // ファイルアップロード
       try {
         const uploadResult = await client.files.uploadV2({
           channel_id: channel,
           thread_ts: threadTs,
           file: infographicBuffer,
           filename: `infographic-${jobId}.png`,
           initial_comment: '📊 インフォグラフィック'
         });

         // slack_file_idとpermalinkをDBに保存
         this.queue.updateMediaSlackInfo(
           infographicMediaId,
           uploadResult.file.id,
           uploadResult.file.permalink
         );
       } catch (uploadError) {
         logger.error('Infographic upload failed', { error: uploadError, jobId });
       }
     }

     // 既存のテキストメッセージ投稿（音声・動画リンク）
   }
   ```

### 8.4 Simple Queue Service
**ファイル**: `src/services/simple-queue.ts`

**変更箇所:**
1. `MediaRecord`型の拡張（L25-34）
2. 新規メソッド追加:
   ```typescript
   updateMediaSlackInfo(mediaId: number, slackFileId: string, slackPermalink: string): void {
     const stmt = db.prepare(`
       UPDATE media
       SET slack_file_id = ?, slack_permalink = ?
       WHERE id = ?
     `);
     stmt.run(slackFileId, slackPermalink, mediaId);
   }
   ```

### 8.5 UI Selectors
**ファイル**: `src/lib/ui-selectors/old-ui.ts`, `new-ui.ts`

**変更箇所:**
1. `UISelector`インターフェース拡張（types.ts）:
   ```typescript
   export interface UISelector {
     // 既存フィールド...
     generateInfographic: string;  // 新規追加
   }
   ```

2. 各UIバージョンでセレクタ定義（実際のUI調査後）:
   ```typescript
   // old-ui.ts
   generateInfographic: 'div.purple.create-artifact-button-container:has-text("インフォグラフィック")',

   // new-ui.ts
   generateInfographic: 'div.purple.create-artifact-button-container:has-text("インフォグラフィック")',
   ```

### 8.6 Database Migration
**新規ファイル**: `src/db/migrations/005_add_infographic_support.sql`

**内容**: セクション5参照

### 8.7 Configuration
**ファイル**: `src/lib/config.ts`（変更不要の可能性が高い）

既存のR2設定、Slack設定をそのまま使用。必要に応じてインフォグラフィック固有の設定（サイズ上限など）を追加。

## 9. 実装フェーズ

### Phase 1: UI調査とセレクタ定義（優先度: Critical）
1. Chrome DevTools MCPでNotebookLMの実際のインフォグラフィック生成UI要素を調査
2. アイコン色（purple想定）、ボタンセレクタ、ダウンロードメニュー構造を確認
3. `ui-selectors/old-ui.ts`と`ui-selectors/new-ui.ts`にセレクタを追加

### Phase 2: データベーススキーマ拡張（優先度: High）
1. マイグレーションSQL作成（005_add_infographic_support.sql）
2. TypeScript型定義更新（simple-queue.ts）
3. マイグレーション実行とテスト

### Phase 3: NotebookLM自動化拡張（優先度: High）
1. `downloadMedia()`メソッドにインフォグラフィック対応を追加
2. インフォグラフィック生成ボタンのクリック処理実装
3. 並列生成待機ロジックの調整（`generateAllOverviews()`メソッド新規作成）

### Phase 4: Request Processor統合（優先度: Medium）
1. インフォグラフィックダウンロードロジックの追加（try-catchで部分的失敗許容）
2. 進捗状況トラッキングの更新
3. エラーハンドリングの実装

### Phase 5: Slack Bot統合（優先度: Medium）
1. `files.uploadV2` APIによるファイルアップロード実装
2. ファイルサイズ検証ロジック追加
3. アップロード失敗時のフォールバック処理

### Phase 6: End-to-End Testing（優先度: High）
1. 正常系テスト: 音声・動画・インフォグラフィック全て成功
2. 部分的失敗テスト: インフォグラフィック生成失敗、音声・動画は成功
3. サイズ超過テスト: インフォグラフィックがSlack制限を超える場合

## 10. リスクと軽減策

### Risk 1: インフォグラフィックアイコン色が想定と異なる
**確率**: Medium
**影響度**: High
**軽減策**: Phase 1のUI調査で早期に確認、実際の色に基づいてセレクタを調整

### Risk 2: NotebookLMがインフォグラフィックを生成しない場合
**確率**: Low
**影響度**: Medium
**軽減策**: 仕様（FR-007）に従い、インフォグラフィック不在は警告ログのみ、音声・動画は正常配信

### Risk 3: Slackファイルアップロードの権限不足
**確率**: Low
**影響度**: High
**軽減策**: ボットのOAuthスコープに`files:write`が含まれることを事前確認、不足時はエラーメッセージで明示

### Risk 4: ファイルサイズが予想以上に大きい
**確率**: Medium
**影響度**: Low
**軽減策**: FR-008に従いサイズ検証を実装、超過時はアップロードをスキップして処理継続

## 11. 検証が必要な技術的仮定

### 1. インフォグラフィック生成の非同期性
**仮定**: インフォグラフィックは音声・動画と並列生成され、個別のボタンで開始できる
**検証方法**: 実際のNotebookLM UIで生成ボタンの配置と挙動を確認

### 2. ダウンロードファイル形式
**仮定**: NotebookLMはPNG形式でインフォグラフィックを提供（仕様の明確化事項より）
**検証方法**: ダウンロードファイルのMIME Typeと拡張子を確認

### 3. Slackのサムネイル自動生成
**仮定**: `files.uploadV2`でアップロードしたPNG画像は自動的にサムネイル表示される
**検証方法**: テストワークスペースで実際にPNGファイルをアップロードして表示を確認

### 4. 複数インフォグラフィック生成の挙動
**仮定**: 複数生成される場合、`.first()`で最初の1つを確実に取得できる
**検証方法**: 実際のNotebookLM UIで複数インフォグラフィックが生成されるケースを再現

## 12. 参考資料

### 既存コードベース
- NotebookLM Automation: `/src/services/notebooklm-automation.ts`
- Request Processor: `/src/services/request-processor.ts`
- Slack Bot: `/src/services/slack-bot.ts`
- Simple Queue: `/src/services/simple-queue.ts`
- UI Selectors: `/src/lib/ui-selectors/`
- Database Migrations: `/src/db/migrations/`

### 外部API仕様
- Slack Web API `files.uploadV2`: https://api.slack.com/methods/files.uploadV2
- Playwright Download API: https://playwright.dev/docs/downloads
- AWS S3/R2 SDK: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/

### プロジェクトドキュメント
- 機能仕様書: `/specs/009-notebooklm-dl-slack/spec.md`
- CLAUDE.md開発ガイドライン: `/CLAUDE.md`

---

**調査完了日**: 2025-11-22
**次のアクション**: Phase 1（UI調査）をChrome DevTools MCPで実施
