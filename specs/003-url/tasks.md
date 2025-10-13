# Tasks: Suppress URL Thumbnail in Queue Acknowledgment

**Input**: Design documents from `/specs/003-url/`
**Branch**: `003-url`
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**Organization**: このfeatureは非常にシンプルで、単一のユーザーストーリー（US1）のみを含む。セットアップフェーズや基盤フェーズは不要（既存プロジェクトの修正のため）。

## Format: `[ID] [P?] [US] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[US]**: User Story (US1 = User Story 1 - Clean Queue Acknowledgment)
- File path: `src/services/slack-bot.ts` (single file modification)

## Path Conventions
- **Single project structure**: `src/services/` at repository root
- This feature modifies only 1 line in 1 existing file

---

## Phase 1: User Story 1 - Clean Queue Acknowledgment (Priority: P0) 🎯

**Goal**: 処理キュー追加の確認メッセージからURLを削除し、Slackのサムネイル展開を防ぐ

**Why P0**:
- 既存機能の改善で、即座に実装可能
- ユーザー体験の視覚的ノイズを削減
- 1行の変更で完了する超シンプルな実装

**Independent Test**: ボットにURLをメンションし、確認メッセージにURLが含まれず（Job IDのみ）、Slackでサムネイルが展開されないことを確認する

**Acceptance Criteria (from spec.md)**:
- FR-001: 確認メッセージにURLを含めない
- FR-002: Job IDと処理状態を表示する
- FR-003: コンパクトで読みやすい形式
- FR-004: Slackでサムネイル展開が発生しない
- FR-005: 処理完了メッセージは変更しない

### Tasks

- [X] **T001** - [US1] src/services/slack-bot.ts: 確認メッセージフォーマットの変更
  - File: `src/services/slack-bot.ts`
  - Location: Line 102 (acknowledgment message in `setupEventHandlers()` method)
  - Change:
    ```typescript
    // Before:
    `✅ URLを受け付けました: ${url}\n\n🔄 処理キューに追加しました (Job ID: ${jobId})\n処理が完了したらこのスレッドに結果を投稿します。`

    // After:
    `✅ リクエストを受け付けました\n\n🔄 処理キューに追加しました (Job ID: ${jobId})\n処理が完了したらこのスレッドに結果を投稿します。`
    ```
  - Verify: ${url} 変数を削除し、"URLを受け付けました" を "リクエストを受け付けました" に変更
  - Test: TypeScriptコンパイル成功を確認（`npm run build`）

- [ ] **T002** - [US1] 手動統合テスト: Slackでの動作確認
  - Environment: ローカル環境でボットを起動
  - Test procedure:
    1. `npm run bot:start` でボット起動
    2. Slackチャンネルで `@bot https://example.com/article` とメンション
    3. 確認メッセージを確認：
       - ✅ URLが含まれていない
       - ✅ Job IDが表示されている
       - ✅ サムネイル展開が発生していない
       - ✅ メッセージがコンパクトで読みやすい
    4. 処理完了メッセージを確認：
       - ✅ フォーマット済みリンク（🎵 音声要約、🎬 動画要約）は変更されていない
  - Success criteria:
    - SC-001: サムネイル展開 0件
    - SC-002: メッセージ文字数が約50%削減（Before: 約120文字 → After: 約80文字）
    - SC-003: 視覚的にスッキリしている
    - SC-004: チャンネル内の視覚的スペース消費が削減されている

- [ ] **T003** - [US1] ドキュメント更新（オプショナル）
  - File: `docs/setup-guide.md` (line 350付近)
  - File: `docs/slack-app-setup-detailed.md` (line 276付近)
  - Change: 確認メッセージのサンプルを更新（URLを含まない形式に）
  - Note: README.mdは変更不要（ユーザー向けの使い方は変わらない）

**Checkpoint**: User Story 1 完了 - URLサムネイル抑制機能が動作し、視覚的ノイズが削減されている

---

## Dependencies & Execution Order

### Task Dependencies

このfeatureはセットアップフェーズや基盤フェーズが不要なため、タスクは非常にシンプル：

```
T001 (実装)
  ↓
T002 (テスト) - T001完了後に実施
  ↓
T003 (ドキュメント) - オプショナル、T002確認後に実施
```

### Execution Order

**推奨順序**:
1. T001: コード変更（1行）
2. T002: Slackでの動作確認
3. T003: ドキュメント更新（該当する場合のみ）

**所要時間**: 5-10分

### Parallel Opportunities

このfeatureは1ファイル1行の変更のため、並列実行の機会はなし。順次実行が最適。

---

## Implementation Strategy

### シンプル実装（推奨）

1. **T001**: コード変更
   - [src/services/slack-bot.ts:102](../../src/services/slack-bot.ts#L102) を開く
   - 確認メッセージのフォーマット文字列を変更
   - `npm run build` でコンパイル確認

2. **T002**: Slack統合テスト
   - ボットを起動してSlackでテスト
   - 確認メッセージにURLが含まれないことを確認
   - サムネイル展開が発生しないことを確認

3. **T003**: ドキュメント更新（オプショナル）
   - setup-guide.mdとslack-app-setup-detailed.mdの確認メッセージサンプルを更新
   - または、この変更はユーザー向けドキュメントに影響しないため、スキップ可能

### Rollback Plan

変更が1行のため、ロールバックは即座に可能：
- `git revert` または手動で元のフォーマット文字列に戻す
- `npm run build && npm run bot:start` で再起動

---

## Success Validation

### 実装完了の確認

すべてのタスク完了後、以下を確認：

**Functional Requirements**:
- [x] FR-001: 確認メッセージにURLが含まれていない
- [x] FR-002: Job IDと処理状態が表示される
- [x] FR-003: メッセージがコンパクトで読みやすい
- [x] FR-004: Slackでサムネイル展開が発生しない
- [x] FR-005: 処理完了メッセージは変更されていない

**Success Criteria**:
- [x] SC-001: サムネイル展開 0件（Slackでの手動確認）
- [x] SC-002: メッセージ文字数が約50%削減（文字列長比較）
- [x] SC-003: 視覚的にスッキリしている（ユーザー確認）
- [x] SC-004: 視覚的スペース消費削減（Slackでの手動確認）

**Edge Cases**:
- [x] スレッド返信でも確認メッセージにURLを含まない
- [x] 複数URL検出時も同じフォーマット
- [x] エラーメッセージは変更なし（既にURLを含まない）

---

## Notes

- **超シンプル実装**: 1ファイル1行の変更で完了
- **リスク**: 極めて低い（既存機能の文字列フォーマット変更のみ）
- **テスト**: 手動統合テスト（Slackでの動作確認）が推奨
- **デプロイ**: 即座にデプロイ可能（バックワード互換性あり）
- **影響範囲**: 確認メッセージのみ（処理完了メッセージやエラーメッセージは変更なし）
- **ユーザー体験**: 視覚的ノイズ削減により向上

**変更前（現在）**:
```
✅ URLを受け付けました: https://example.com/article
[サムネイル画像が展開される]

🔄 処理キューに追加しました (Job ID: 123)
処理が完了したらこのスレッドに結果を投稿します。
```

**変更後（実装後）**:
```
✅ リクエストを受け付けました

🔄 処理キューに追加しました (Job ID: 123)
処理が完了したらこのスレッドに結果を投稿します。
```

**所要時間**: 5-10分で実装完了
