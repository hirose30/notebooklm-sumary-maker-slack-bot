# Quickstart Guide: NotebookLM Infographic Integration

**作成日**: 2025-11-22
**対象ユーザー**: 開発者、QAエンジニア
**推定所要時間**: 15分（初回セットアップ）

## Overview

このガイドでは、NotebookLMインフォグラフィック機能を既存のSlackボット環境で有効化し、エンドツーエンドでテストする方法を説明します。

## Prerequisites

### Required

- ✅ Node.js 20+ インストール済み
- ✅ 既存のボット環境が動作中（`npm run bot:start:ws1` または `npm run bot:start:ws2`）
- ✅ NotebookLM Pro アカウント（インフォグラフィック生成機能にアクセス可能）
- ✅ Slack Workspace管理者権限（OAuth scopesの確認・追加用）

### Verification

```bash
# Node.jsバージョン確認
node --version  # v20.x.x 以上であること

# 既存ボットが動作しているか確認
npm run test:slack
# ✅ 既存の音声・動画サマリー機能が正常に動作すること
```

## Step 1: Database Migration

### 1.1 Migration Script 実行

```bash
# マイグレーションスクリプトを実行（未実装の場合は手動SQL実行）
sqlite3 data/bot.db < src/db/migrations/005_add_infographic_support.sql

# または、既存のマイグレーション仕組みがあればそれを使用
npm run db:migrate  # (存在する場合)
```

### 1.2 Migration 検証

```bash
# Slackメタデータカラムが追加されたことを確認
sqlite3 data/bot.db "PRAGMA table_info(media);" | grep slack
# 出力例:
# 9|slack_file_id|TEXT|0||0
# 10|slack_permalink|TEXT|0||0
```

## Step 2: Slack OAuth Scopes Verification

### 2.1 必要なスコープ

インフォグラフィックアップロードには、以下のSlack OAuth scopesが必要です:

**Bot Token Scopes** (Slack App設定 → OAuth & Permissions):
- `files:write` - ファイルアップロード権限
- `files:read` - ファイルメタデータ読み取り（検証用）
- `chat:write` - メッセージ投稿権限（既存）
- `channels:read` - チャネル情報読み取り（既存）
- `groups:read` - プライベートチャネル情報読み取り（既存）

### 2.2 スコープ確認方法

```bash
# Slack App Management画面にアクセス
# https://api.slack.com/apps/<YOUR_APP_ID>/oauth

# または、環境変数確認
echo $SLACK_BOT_TOKEN  # xoxb-で始まるトークン

# トークンのスコープをSlack APIで確認
curl -H "Authorization: Bearer $SLACK_BOT_TOKEN" \
  https://slack.com/api/auth.test | jq '.scopes'
```

### 2.3 スコープ追加（必要な場合）

1. Slack App Management → **OAuth & Permissions**
2. **Scopes** → **Bot Token Scopes** セクション
3. `files:write` を追加
4. **Reinstall to Workspace** をクリック
5. `.env` ファイルの `SLACK_BOT_TOKEN` を新しいトークンで更新

## Step 3: Code Changes Deployment

### 3.1 TypeScript Build

```bash
# TypeScript コンパイル
npm run build

# ビルド成功確認
ls -l dist/services/notebooklm-automation.js
ls -l dist/services/slack-bot.js
```

### 3.2 Hot Reload (開発環境)

```bash
# 開発環境では tsx watch が自動的にリロード
# ボットを再起動する必要はない（既に npm run bot:start:ws1 実行中の場合）

# ログで変更検出を確認
tail -f logs/ws1-$(date +%Y-%m-%d).log
# → "NotebookLMAutomation initialized" with infographic support
```

### 3.3 Production Restart (本番環境)

```bash
# 本番環境ではプロセス再起動が必要
pkill -f "tsx src/index.ts"  # または pm2 restart など

# 再起動
npm run bot:start:ws1
```

## Step 4: End-to-End Test

### 4.1 Test URL Preparation

NotebookLMでインフォグラフィックが生成されることが確認されているテストURLを用意します。

推奨テストURL例:
- ビジュアルデータが多い記事（チャート、グラフ、統計データを含む）
- 長文記事（NotebookLMが要約してインフォグラフィックを生成しやすい）

```bash
# 環境変数設定（テスト用）
export TEST_URL="https://example.com/article-with-visuals"
```

### 4.2 Slack経由でテスト送信

1. Slackワークスペースを開く
2. ボットがインストールされているチャネルに移動
3. テストURLを投稿:

```
https://example.com/article-with-visuals
```

### 4.3 期待される動作

```
[Phase 1] ボットがURLを認識
  ├─ ✅ Reaction "eyes" が追加される
  └─ ✅ "Processing your request..." 応答メッセージ

[Phase 2] NotebookLM処理
  ├─ ✅ 音声サマリー生成待機
  ├─ ✅ 動画サマリー生成待機
  └─ ✅ [新規] インフォグラフィック生成待機

[Phase 3] ダウンロード
  ├─ ✅ 音声ファイルダウンロード → R2アップロード
  ├─ ✅ 動画ファイルダウンロード → R2アップロード
  └─ ✅ [新規] インフォグラフィックダウンロード → R2アップロード → Slackアップロード

[Phase 4] Slack投稿
  ├─ ✅ 完了メッセージ投稿（音声・動画のR2リンク付き）
  └─ ✅ [新規] インフォグラフィック画像が添付され、サムネイル表示される
```

### 4.4 成功基準

- [ ] インフォグラフィックサムネイルがSlackメッセージ内に表示される
- [ ] サムネイルをクリックするとフル解像度画像が開く
- [ ] ログに `Infographic detected: true` が記録される
- [ ] ログに `Slack file uploaded successfully` が記録される
- [ ] データベースに `slack_file_id` と `slack_permalink` が保存される

## Step 5: Verification & Monitoring

### 5.1 Database Verification

```bash
# インフォグラフィックレコード確認
sqlite3 data/bot.db "
SELECT
  r.id as request_id,
  r.url,
  m.media_type,
  m.slack_file_id,
  m.slack_permalink,
  datetime(m.created_at, 'unixepoch') as created_at
FROM media m
JOIN requests r ON m.request_id = r.id
WHERE m.media_type = 'infographic'
ORDER BY m.created_at DESC
LIMIT 5;
"
```

**期待される出力**:
```
request_id|url|media_type|slack_file_id|slack_permalink|created_at
123|https://example.com/article|infographic|F01234ABCDE|https://workspace.slack.com/files/.../infographic.png|2025-11-22 10:30:45
```

### 5.2 Log Analysis

```bash
# インフォグラフィック関連ログ抽出
tail -f logs/ws1-$(date +%Y-%m-%d).log | grep -i infographic

# 期待されるログ例:
# [INFO] Infographic detected: true (count: 1)
# [INFO] Downloading infographic... (attempt: 1/3)
# [INFO] Infographic download successful (size: 2.1MB)
# [INFO] Uploading infographic to Slack...
# [INFO] Slack file uploaded successfully (file_id: F01234ABCDE)
```

### 5.3 Error Monitoring

```bash
# エラーログ監視
tail -f logs/ws1-$(date +%Y-%m-%d).log | grep -i error

# よくあるエラーと対処法:
# [ERROR] Infographic not detected → NotebookLM UI調査が必要（セレクタ確認）
# [ERROR] File size exceeds limit → FR-008に従い失敗として扱う（正常動作）
# [ERROR] Slack upload failed (missing_scope) → OAuth scopesを確認
```

## Step 6: Failure Scenarios Testing (Optional)

### 6.1 Partial Failure Test (FR-007検証)

インフォグラフィック生成が失敗しても、音声・動画は正常に投稿されることを確認:

```bash
# モックテスト用のURL（インフォグラフィック非生成想定）
export TEST_URL_NO_INFOGRAPHIC="https://example.com/text-only-article"
```

**期待される動作**:
- ✅ 音声・動画サマリーは正常に投稿される
- ✅ ログに "Infographic not generated - proceeding with audio/video only" 記録
- ✅ データベースに `media_type='infographic'` レコードは作成されない

### 6.2 File Size Limit Test (FR-008検証)

```bash
# 大きなインフォグラフィックが生成されるURL（10MB超想定）
# 実際のURLがない場合は、モックテストコード作成が必要
```

**期待される動作**:
- ✅ サイズ検証でリジェクト
- ✅ ログに "File size (15MB) exceeds Slack limit (10MB)" 記録
- ✅ 音声・動画は正常に投稿される（インフォグラフィックなし）

## Troubleshooting

### Issue 1: インフォグラフィックが検出されない

**Symptoms**:
- ログに "Infographic detected: false"
- NotebookLM UIでは視覚的にインフォグラフィックが表示される

**Diagnosis**:
```bash
# Chrome DevTools MCPで実際のセレクタ確認
# ⚠️ 2025-11-22検証済み: 正しいセレクタは mat-icon.artifact-icon.pink
```

**Solution**:
1. `src/lib/ui-selectors/new-ui.ts` で **pink** クラスが使用されていることを確認
2. ログに実際のDOM構造を出力して確認
3. NotebookLM UIが更新された場合、Chrome DevTools MCPツールで再検証

### Issue 2: Slack OAuth Error (missing_scope)

**Symptoms**:
- ログに "Slack API error: missing_scope (files:write)"

**Solution**:
1. Step 2.3の手順でスコープ追加
2. ボット再インストール
3. `.env` トークン更新
4. ボット再起動

### Issue 3: Database Migration Not Applied

**Symptoms**:
- エラー "no such column: slack_file_id"

**Solution**:
```bash
# マイグレーションステータス確認
sqlite3 data/bot.db "SELECT * FROM schema_migrations ORDER BY version DESC LIMIT 3;"

# バージョン5が存在しない場合
sqlite3 data/bot.db < src/db/migrations/005_add_infographic_support.sql
```

## Performance Benchmarks

### Expected Metrics (SC-001 ~ SC-005)

| Metric | Target | Measurement Command |
|--------|--------|---------------------|
| Infographic download time | <30秒 | `grep "Infographic download successful" logs/*.log \| awk '{print $NF}'` |
| Slack upload time | <5秒（サムネイル表示） | ログタイムスタンプ差分確認 |
| Success rate | ≥95% | `sqlite3 data/bot.db "SELECT COUNT(*) FROM media WHERE media_type='infographic' AND slack_file_id IS NOT NULL"` |

## Next Steps

### Development

- [ ] ユニットテスト追加: `tests/unit/infographic-detection.test.ts`
- [ ] インテグレーションテスト: `tests/integration/infographic-slack-upload.test.ts`
- [ ] E2Eテスト: `tests/e2e/infographic-e2e.test.ts`

### Production Deployment

- [ ] ステージング環境でフルテスト
- [ ] 本番環境デプロイ前のデータベースバックアップ
- [ ] ロールバックプラン確認（`data-model.md` 参照）
- [ ] モニタリングアラート設定（Slack upload失敗率）

### Documentation

- [ ] CLAUDE.mdへの技術スタック更新
- [ ] 運用手順書作成（インフォグラフィック失敗時の対応）
- [ ] ユーザー向けリリースノート作成

## References

- [Feature Specification](./spec.md) - 機能要件とユーザーシナリオ
- [Technical Research](./research.md) - 技術的決定事項の詳細
- [Data Model](./data-model.md) - データベーススキーマ詳細
- [API Contract](./contracts/notebooklm-infographic.yaml) - 内部APIインターフェース
- [Slack API Documentation](https://api.slack.com/methods/files.uploadV2) - files.uploadV2 APIリファレンス

## Support

問題が発生した場合:
1. このQuickstartガイドのTroubleshootingセクションを確認
2. ログファイル（`logs/ws1-YYYY-MM-DD.log`）を確認
3. データベース状態確認（SQLiteクエリ）
4. 開発チームに問い合わせ（ログとデータベース抽出結果を添付）
