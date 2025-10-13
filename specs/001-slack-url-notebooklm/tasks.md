# Implementation Tasks: Slack NotebookLM Pro 統合ボット

**Feature**: Slack NotebookLM Pro 統合ボット（改善版）
**Branch**: `001-slack-url-notebooklm`
**Stack**: Node.js 20+, TypeScript 5.x, @slack/bolt, Playwright, SQLite3, AWS SDK v3 (R2)
**Status**: Phase 1-4 完了済み、Phase 6-8 実装待ち

## Summary

**既存実装**: Phase 1-4 完了（基本機能動作中）
- Phase 1-2: NotebookLM自動化 ✅
- Phase 3: Slack統合 ✅
- Phase 4: R2ストレージ統合 ✅

**今回の改善タスク**: Phase 6-8 (P0改善)
- **Phase 6: エラー発生時の通知 (P0)** - 4 tasks
- **Phase 7: スレッドベースURL処理 (P0)** - 5 tasks
- **Phase 8: フォーマット済みリンク出力 (P0)** - 5 tasks

Total new tasks: 14

**MVP Scope**: Phase 6-8 (すべてP0優先度)
**Future**: Phase 5 (進捗更新 - P2), 動画サムネイル調査 (P3)

---

## Phase 1-4: 基本実装 ✅ 完了

**Status**: 実装済み・動作確認済み

基本機能（音声・動画要約生成、Slack統合、R2ストレージ）は既に実装され、動作しています。
詳細は以前のタスクリストを参照。

---

## Phase 6: User Story 2 - エラー発生時の通知 (Priority: P0) 🎯

**Goal**: リクエスト処理中にエラーが発生した場合、ユーザーに通知し、次のリクエストの処理を継続する

**Why P0**: エラーが発生してもユーザーに通知されず、後続のリクエストもブロックされる現状は、システムの信頼性に直結する重大な問題

**Independent Test**: 無効なURLでボットをメンションし、エラーメッセージがスレッドに投稿され、次のリクエストが正常に処理されることを確認

**Acceptance Criteria (from spec.md)**:
- FR-022: エラー時に元のSlackスレッドに簡潔なエラーメッセージを投稿
- FR-023: エラー後も次のリクエストの処理を継続（キューをブロックしない）
- SC-009: エラー発生後、次のリクエストが30秒以内に処理開始

### Tasks

- [X] **T101** - [US2] request-processor.ts: エラーハンドリング改善 ✅
- [X] **T102** - [US2] slack-bot.ts: エラーメッセージ投稿メソッド追加 ✅
- [X] **T103** - [US2] slack-bot.ts: エラーコールバックの統合 ✅
- [ ] **T104** - [US2] Integration test: エラー通知フロー (省略)

**Checkpoint**: エラー発生時のユーザー通知と継続処理が動作

---

## Phase 7: User Story 3 - スレッドベースURL処理 (Priority: P0) 🎯

**Goal**: ボットメンション時にURLがない場合、親スレッドのメッセージからURLを抽出して処理

**Why P0**: 実際のSlack利用では、URLを含む投稿に対して別のメッセージで「要約して」とメンションするのが自然な使い方

**Independent Test**: URLを含む親投稿を作成し、返信でボットをメンション（URLなし）して、親投稿のURLが処理されることを確認

**Acceptance Criteria (from spec.md)**:
- FR-024: ボットメンション時にURLがない場合、親スレッドからURLを抽出
- FR-025: ボットメンション時にURLがある場合、そのURLを優先処理
- FR-026: 親スレッドにもURLがない場合、エラーメッセージを返信
- SC-010: 親スレッドからのURL抽出が95%の精度で成功

### Tasks

- [X] **T201** - [P] [US3] url-extractor.ts: スレッド親投稿からURL抽出機能追加 ✅
- [X] **T202** - [US3] slack-bot.ts: app_mention イベントで親スレッドを取得 ✅
- [X] **T203** - [US3] slack-bot.ts: URLが見つからない場合のエラーハンドリング ✅
- [X] **T204** - [P] [US3] Unit test: url-extractor.ts の新機能テスト ✅
- [ ] **T205** - [US3] Integration test: スレッドベースURL処理フロー (省略)

**Checkpoint**: スレッドベースのURL処理が動作

---

## Phase 8: User Story 4 - フォーマット済みリンク出力 (Priority: P0) 🎯

**Goal**: 生成された音声・動画要約のリンクを、読みやすいフォーマット（絵文字付きテキストリンク）でSlackに投稿

**Why P0**: 現在の長い署名付きURLは可読性が低く、Slackスレッドを乱雑にする。ユーザーエクスペリエンスの基本的な改善

**Independent Test**: 処理完了後のSlack投稿を確認し、URLがフォーマット済みリンク（`<URL|表示テキスト>`形式）で表示されることを確認

**Acceptance Criteria (from spec.md)**:
- FR-027: 音声リンクを「🎵 音声要約」形式で投稿
- FR-028: 動画リンクを「🎬 動画要約」形式で投稿
- FR-029: 各リンクにファイルサイズ情報を併記
- SC-011: フォーマット済みリンクが100%正しく表示される

### Tasks

- [X] **T301** - [US4] slack-bot.ts: 完了メッセージのフォーマット改善 ✅
- [X] **T302** - [P] [US4] format-utils.ts: ファイルサイズフォーマット関数作成 ✅
- [X] **T303** - [US4] simple-queue.ts: メディアファイルサイズカラムを確認 ✅ (既存実装済み)
- [X] **T304** - [US4] request-processor.ts: ファイルサイズをDBに保存 ✅ (既存実装済み)
- [ ] **T305** - [US4] Integration test: フォーマット済みリンク出力 (省略)

**Checkpoint**: フォーマット済みリンクが正しく表示される

---

## Phase 9: Documentation & Polish

**Purpose**: ドキュメント更新と最終確認

**T401** - [P] Update README.md with new features
- File: `README.md`
- Add: 新機能（エラー通知、スレッドURL処理、フォーマット済みリンク）の説明
- Update: 使用例のスクリーンショットまたは説明

**T402** - [P] Update docs/setup-guide.md if needed
- File: `docs/setup-guide.md`
- Review: 新機能に関する注意事項が必要か確認
- Add: 必要に応じてトラブルシューティングセクションを更新

**T403** - E2E test: Full flow with all improvements
- Create: 完全なE2Eテストシナリオ
- Test sequence:
  1. エラーケース（無効URL） → エラー通知
  2. スレッドURL処理（親投稿URL） → 正常処理
  3. フォーマット済みリンク → 正しく表示
- Verify: すべてのP0改善が正しく動作

**T404** - Code review and cleanup
- Review: すべての変更箇所のコードレビュー
- Check: エラーメッセージがユーザーフレンドリーか
- Verify: ログが適切に出力されているか
- Clean: 不要なコメントやデバッグコードを削除

**Final Checkpoint**: すべてのP0改善が実装・テスト済み、ドキュメント更新完了

---

## Implementation Strategy

### Execution Order

**Recommended sequence** (すべて同じファイルを修正するため、順次実行推奨):

1. Phase 6 (US2 - エラー通知) → 基盤となるエラーハンドリング改善
2. Phase 7 (US3 - スレッドURL) → URL抽出ロジック改善
3. Phase 8 (US4 - リンクフォーマット) → 出力形式改善
4. Phase 9 (ドキュメント) → 最終確認

### Parallel Execution Opportunities

**Within Phase 6**: すべて順次（slack-bot.ts, request-processor.ts を修正）

**Within Phase 7**:
- T201 (url-extractor.ts) と T204 (テスト) は並列可能 [P]
- T202, T203 (slack-bot.ts) は順次実行

**Within Phase 8**:
- T302 (format-utils.ts) と T301 (slack-bot.ts) は並列可能 [P]
- T303, T304 (DB関連) は順次実行

**Within Phase 9**:
- T401, T402 (ドキュメント) は並列可能 [P]

### Testing Strategy

- Unit tests first: url-extractor, format-utils
- Integration tests after: 各フェーズ完了後に実行
- E2E test last: すべての改善が統合された後

---

## Dependencies Between Phases

```
Phase 1-4 (基本実装) ✅ 完了済み
    ↓
Phase 6 (エラー通知) → 独立
Phase 7 (スレッドURL) → 独立
Phase 8 (リンクフォーマット) → 独立
    ↓
Phase 9 (ドキュメント) → すべての Phase 6-8 完了後

⚠️ 注意: Phase 6-8 は論理的には独立しているが、同じファイル（slack-bot.ts）を
修正するため、上記の推奨順序で実装すること
```

---

## Task Summary

**New Tasks (Phase 6-8)**: 14 tasks
- Phase 6 (US2 - エラー通知): 4 tasks
- Phase 7 (US3 - スレッドURL): 5 tasks
- Phase 8 (US4 - リンクフォーマット): 5 tasks
- Phase 9 (Polish): 4 tasks (ドキュメント含む)

**Parallel Opportunities**: 5 tasks marked with [P]

**Estimated Completion**:
- Phase 6: 2-3 hours (エラーハンドリング改善)
- Phase 7: 2-4 hours (URL抽出ロジック)
- Phase 8: 2-3 hours (出力フォーマット)
- Phase 9: 1-2 hours (ドキュメント)
- **Total**: 約7-12時間

---

## Next Steps

**Option 1**: Proceed with `/speckit.implement` to execute tasks automatically
- Recommended for following Speckit workflow
- Tasks will be executed in order with automatic checkpoints

**Option 2**: Manual implementation
- Follow task order (T101 → T404)
- Test each User Story independently after phase completion
- Verify all acceptance criteria from spec.md

**Option 3**: Incremental delivery
- Implement Phase 6 first (most critical)
- Deploy and validate
- Then implement Phase 7-8

---

## Success Criteria Checklist

After implementation, verify these from spec.md:

### User Story 2 (エラー通知)
- [ ] FR-022: エラー時にSlackスレッドにメッセージ投稿
- [ ] FR-023: エラー後も次のリクエストを処理
- [ ] SC-009: エラー後30秒以内に次のリクエスト開始

### User Story 3 (スレッドURL)
- [ ] FR-024: 親スレッドからURL抽出
- [ ] FR-025: メンション内URLを優先
- [ ] FR-026: URLがない場合はエラー
- [ ] SC-010: URL抽出95%成功率

### User Story 4 (リンクフォーマット)
- [ ] FR-027: 「🎵 音声要約」形式
- [ ] FR-028: 「🎬 動画要約」形式
- [ ] FR-029: ファイルサイズ併記
- [ ] SC-011: リンク100%正しく表示
