# Windows Testing Checklist

**Purpose**: Validate that NotebookLM Slack Bot works correctly on Windows 10/11

**Related**: [windows-setup.md](./windows-setup.md) | [spec.md](../specs/004-1-windows-mac/spec.md)

---

## Prerequisites

- [ ] Windows 10 (64bit) または Windows 11 環境
- [ ] 管理者権限アクセス
- [ ] インターネット接続
- [ ] Slack ワークスペースへのアクセス

---

## T012: Bot Startup Test

**Goal**: ボットが Windows 環境で正常に起動することを確認

### 手順

1. [ ] Node.js 20.x LTS をインストール
   ```powershell
   node --version  # v20.x.x を確認
   ```

2. [ ] プロジェクトをクローン/ダウンロード
   ```powershell
   git clone <repository-url>
   cd notebooklm-sumary-maker-slack-bot
   ```

3. [ ] 依存関係をインストール
   ```powershell
   npm install
   ```

4. [ ] Playwright Chromium をインストール
   ```powershell
   npx playwright install chromium
   ```

5. [ ] `.env` ファイルを作成・設定
   ```powershell
   Copy-Item .env.example .env
   # .env を編集してトークンを設定
   ```

6. [ ] ボットを起動
   ```powershell
   npm run bot:start
   ```

7. [ ] 起動ログを確認
   ```
   ╔═══════════════════════════════════════╗
   ║  NotebookLM Slack Bot Starting...   ║
   ╚═══════════════════════════════════════╝

   ⚡️ Slack bot is running!
   Request processor started
   ```

### 成功基準 (SC-001)

- [ ] エラーなく起動完了
- [ ] Slack との WebSocket 接続成功
- [ ] プロセスが安定して動作（5分間）

**Result**: ✅ PASS / ❌ FAIL

**Notes**:
```
(テスト実施時の気づきやエラーメッセージをここに記載)
```

---

## T013: End-to-End URL Processing Test

**Goal**: Windows 環境で完全なフロー（Slack → NotebookLM → R2 → 応答）が動作することを確認

### 手順

1. [ ] Slack でボットをチャンネルに招待
   ```
   /invite @NotebookLM Bot
   ```

2. [ ] テスト URL をメンション
   ```
   @NotebookLM Bot https://zenn.dev/example/articles/12345
   ```

3. [ ] 初期応答を確認
   ```
   ✅ リクエストを受け付けました
   🔄 処理キューに追加しました (Job ID: 1)
   ```

4. [ ] NotebookLM での処理を監視
   - [ ] Chromium ブラウザが起動
   - [ ] NotebookLM に自動ログイン
   - [ ] ノートブック作成
   - [ ] URL ソース追加
   - [ ] 音声解説生成開始
   - [ ] 動画解説生成開始

5. [ ] 処理完了を待つ（約10-16分）

6. [ ] 完了応答を確認
   ```
   ✅ 処理が完了しました！

   🎵 音声解説: https://...r2.cloudflarestorage.com/...
   🎬 動画解説: https://...r2.cloudflarestorage.com/...

   ⏰ リンクは7日間有効です
   ```

7. [ ] 生成されたリンクをクリックして動作確認
   - [ ] 音声ファイルが再生可能
   - [ ] 動画ファイルが再生可能

### 成功基準 (SC-002, SC-003)

- [ ] 全工程がエラーなく完了
- [ ] 音声と動画が正常にダウンロード・再生可能
- [ ] 処理時間が Mac 環境と比較して ±10% 以内

**Result**: ✅ PASS / ❌ FAIL

**Performance**:
- Start time: `HH:MM:SS`
- End time: `HH:MM:SS`
- Total duration: `XX分XX秒`

**Notes**:
```
(テスト実施時の気づきやエラーメッセージをここに記載)
```

---

## T014: SQLite Database Operations Test

**Goal**: Windows 環境で SQLite データベース操作が正常に動作することを確認

### 手順

1. [ ] ボット起動時にデータベースが自動作成される
   ```powershell
   dir .\data\bot.db
   # ファイルが存在することを確認
   ```

2. [ ] データベースにアクセス
   ```powershell
   sqlite3 .\data\bot.db
   ```

3. [ ] テーブルを確認
   ```sql
   .tables
   -- requests テーブルが存在することを確認
   ```

4. [ ] リクエスト履歴を確認
   ```sql
   SELECT * FROM requests ORDER BY created_at DESC LIMIT 5;
   ```

5. [ ] キューの状態を確認
   ```sql
   SELECT status, COUNT(*) as count FROM requests GROUP BY status;
   ```

6. [ ] データが正常に保存されていることを確認
   - [ ] URL が正しく保存されている
   - [ ] ステータスが更新されている
   - [ ] タイムスタンプが記録されている

### 成功基準 (FR-004)

- [ ] データベースファイルが正常に作成される
- [ ] テーブル作成が成功
- [ ] INSERT/SELECT/UPDATE 操作が正常に動作
- [ ] データの整合性が保たれている

**Result**: ✅ PASS / ❌ FAIL

**Notes**:
```
(テスト実施時の気づきやエラーメッセージをここに記載)
```

---

## T015: R2 Upload Functionality Test

**Goal**: Windows 環境から Cloudflare R2 へのファイルアップロードが正常に動作することを確認

### 手順

1. [ ] R2 設定が正しく読み込まれることを確認
   ```powershell
   Get-Content .env | Select-String "R2_"
   ```

2. [ ] ボットログで R2 接続を確認
   ```
   [INFO] Cloudflare R2 client initialized
   ```

3. [ ] E2E テスト（T013）を実行し、R2 アップロードを含む

4. [ ] アップロード成功ログを確認
   ```
   [INFO] Uploading to R2 { key: 'media/...', size: ..., contentType: '...' }
   [INFO] Upload successful { key: 'media/...' }
   ```

5. [ ] Cloudflare R2 ダッシュボードで確認
   - [ ] バケットにファイルが存在
   - [ ] ファイルサイズが正しい
   - [ ] 音声ファイル（.wav または .mp3）
   - [ ] 動画ファイル（.mp4）

6. [ ] 署名付き URL の生成を確認
   - [ ] URL が有効（ブラウザでアクセス可能）
   - [ ] 7日間の有効期限が設定されている

### 成功基準 (FR-005)

- [ ] R2 へのアップロードが成功
- [ ] ファイルが正しくアップロードされている
- [ ] 署名付き URL が正常に生成される
- [ ] URL からファイルがダウンロード可能

**Result**: ✅ PASS / ❌ FAIL

**Upload Performance**:
- Audio file size: `XX.XX MB`
- Video file size: `XX.XX MB`
- Upload time (audio): `XX秒`
- Upload time (video): `XX秒`

**Notes**:
```
(テスト実施時の気づきやエラーメッセージをここに記載)
```

---

## T016: Performance Measurement

**Goal**: Windows 環境でのパフォーマンスが Mac 環境と同等であることを確認

### 手順

1. [ ] 同じ URL で Mac と Windows の両方でテスト

2. [ ] 各フェーズの処理時間を計測:

   | フェーズ | Mac | Windows | 差分 |
   |---------|-----|---------|------|
   | ボット起動 | XX秒 | XX秒 | ±XX% |
   | ノートブック作成 | XX秒 | XX秒 | ±XX% |
   | URL ソース追加 | XX秒 | XX秒 | ±XX% |
   | 音声生成 | XX分 | XX分 | ±XX% |
   | 動画生成 | XX分 | XX分 | ±XX% |
   | R2 アップロード | XX秒 | XX秒 | ±XX% |
   | **合計** | **XX分** | **XX分** | **±XX%** |

3. [ ] メモリ使用量を確認
   ```powershell
   # Windows
   Get-Process node | Select-Object PM, VM

   # Mac
   ps aux | grep node
   ```

4. [ ] CPU 使用率を確認
   - [ ] タスクマネージャー（Windows）
   - [ ] Activity Monitor（Mac）

### 成功基準 (SC-002)

- [ ] 総処理時間が Mac 比 ±10% 以内
- [ ] メモリ使用量が同程度
- [ ] CPU 使用率が同程度
- [ ] 安定して動作（クラッシュなし）

**Result**: ✅ PASS / ❌ FAIL

**Notes**:
```
(テスト実施時の気づきやエラーメッセージをここに記載)
```

---

## Overall Test Summary

| Test ID | Test Name | Result | Notes |
|---------|-----------|--------|-------|
| T012 | Bot Startup | ⬜ | |
| T013 | E2E URL Processing | ⬜ | |
| T014 | SQLite Operations | ⬜ | |
| T015 | R2 Upload | ⬜ | |
| T016 | Performance | ⬜ | |

**Overall Status**: ⬜ PENDING / ✅ PASS / ❌ FAIL

---

## Validation Against Acceptance Criteria

### US1 Functional Requirements

- [ ] **FR-001**: Bot starts successfully on Windows 10/11
- [ ] **FR-002**: Path separators handled correctly (no hardcoded `/` or `\`)
- [ ] **FR-003**: Playwright/NotebookLM automation works on Windows
- [ ] **FR-004**: SQLite operations work correctly on Windows
- [ ] **FR-005**: R2 upload succeeds from Windows
- [ ] **FR-006**: Feature parity with Mac (all functions work)
- [ ] **FR-007**: Windows documentation complete and accurate

### US1 Success Metrics

- [ ] **SC-001**: Startup success rate ≥95% on Windows
- [ ] **SC-002**: Performance within ±10% of Mac
- [ ] **SC-003**: 100% feature functionality on Windows
- [ ] **SC-004**: Setup time ≤30 minutes

---

## Common Issues and Solutions

### Issue: Path Length Limitation

**Symptom**: `ENAMETOOLONG` error

**Solution**: Enable long paths in Windows Registry
```powershell
# レジストリエディタで設定
# HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem
# LongPathsEnabled = 1
```

### Issue: Firewall Block

**Symptom**: Cannot connect to Slack

**Solution**: Allow Node.js in Windows Firewall
- Settings → Windows Security → Firewall → Allow an app

### Issue: Permission Error

**Symptom**: `EPERM: operation not permitted`

**Solution**: Run PowerShell as Administrator
```powershell
# Windows キー + X → "Windows PowerShell (管理者)"
```

---

## Test Sign-off

**Tester**: _________________

**Date**: _________________

**Environment**:
- OS: Windows 10 / 11 (circle one)
- Node.js version: _________________
- Playwright version: _________________

**Result**: ✅ ALL TESTS PASSED / ❌ SOME TESTS FAILED

**Comments**:
```
(総合的な所感、追加の気づきをここに記載)
```
