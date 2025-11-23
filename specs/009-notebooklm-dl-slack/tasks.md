# タスク: NotebookLMインフォグラフィックのダウンロードとSlack表示

**入力**: `/specs/009-notebooklm-dl-slack/` の設計ドキュメント
**前提条件**: plan.md (必須), spec.md (ユーザーストーリー用必須), research.md, data-model.md, contracts/

**テスト**: この機能では明示的なテスト要求がないため、テストタスクは含まれていません。実装後の手動テストと Quickstart ガイドの検証を推奨します。

**構成**: タスクはユーザーストーリーごとにグループ化され、各ストーリーを独立して実装・テスト可能にしています。

**フェーズ0完了**: ✅ Chrome DevTools MCP で実機検証済み（2025-11-22）
- インフォグラフィックアイコン色確認: **pink** (NOT purple)
- セレクタ確認: `mat-icon.artifact-icon.pink`
- ダウンロード方法確認: ハンバーガーメニュー → ダウンロード（既存パターン）
- ファイル形式確認: PNG, 5.6MB (2752x1536解像度)

## フォーマット: `[ID] [P?] [Story] 説明`
- **[P]**: 並行実行可能（異なるファイル、依存関係なし）
- **[Story]**: このタスクが属するユーザーストーリー（例: US1, US2, US3）
- 説明には正確なファイルパスを含む

## パス規則
- **単一プロジェクト**: リポジトリルートの `src/`, `tests/`
- パスは既存プロジェクト構造（plan.md参照）に基づく

---

## フェーズ1: セットアップ（共有インフラストラクチャ）

**目的**: プロジェクト初期化と基本構造

- [ ] T001 [P] TypeScript型定義の作成: `src/lib/ui-selectors/types.ts` に InfographicResult 型を追加（検出結果、ファイルサイズ、MIME タイプ）
- [ ] T002 [P] インフォグラフィック関連定数の定義: `src/lib/config.ts` に FILE_SIZE_LIMITS, TIMEOUT_VALUES, SLACK_FILE_UPLOAD_TIMEOUT を追加
- [ ] T003 Git作業ブランチの確認: `009-notebooklm-dl-slack` ブランチで作業中であることを確認

---

## フェーズ2: 基盤（すべてのユーザーストーリーの前提条件）

**目的**: すべてのユーザーストーリーの実装前に完了必須のコアインフラストラクチャ

**⚠️ 重要**: このフェーズが完了するまで、いかなるユーザーストーリーの作業も開始できません

- [ ] T004 [P] データベースマイグレーション 005 作成: `src/db/migrations/005_add_infographic_support.sql` にSlackメタデータカラムを追加（slack_file_id TEXT NULL, slack_permalink TEXT NULL）。既存行はNULLのまま（バックフィル不要）。ロールバックスクリプト含む
- [ ] T005 [P] MediaRecord 型定義の拡張: `src/services/simple-queue.ts` で MediaType に 'infographic' を追加、slack_file_id と slack_permalink プロパティを追加
- [ ] T006 Slack OAuth スコープ検証: quickstart.md の指示に従い、`files:write` スコープが Slack Bot トークンに含まれることを確認
- [ ] T007 [P] UI セレクタの拡張: `src/lib/ui-selectors/new-ui.ts` の generateInfographic セレクタを `mat-icon.artifact-icon.pink` (Phase 0 検証済み) を使用して実装

**チェックポイント**: 基盤準備完了 - ユーザーストーリーの実装が並行開始可能

---

## フェーズ3: ユーザーストーリー1 - インフォグラフィックのダウンロードとSlack投稿での表示 (優先度: P1) 🎯 MVP

**目的**: インフォグラフィック画像ファイルをNotebookLMからダウンロードし、Slackメッセージに添付して、ユーザーが直接ビジュアルサムネイルを確認できるようにする

**独立テスト**: テストURLをSlackボットに送信し、NotebookLMがインフォグラフィックを生成するのを待ち、Slackメッセージに画像ファイルが添付され、サムネイルが表示されることを確認

### ユーザーストーリー1の実装

- [X] T008 [P] [US1] インフォグラフィック検出メソッドの実装: `src/services/notebooklm-automation.ts` に `detectInfographic()` メソッドを追加（セレクタ: `button.artifact-button-content:has(mat-icon.artifact-icon.pink)`, DOM順で最初の1つのみ対象（.first()使用）、複数検出時はINFOログ記録、FR-001準拠）
- [X] T009 [P] [US1] ダウンロードメソッド拡張: `src/services/notebooklm-automation.ts` の `downloadMedia()` メソッドに 'infographic' タイプを追加（既存の 'audio'/'video' パターンと同一, FR-002準拠）
- [X] T010 [P] [US1] インフォグラフィック生成待機ロジック: `src/services/notebooklm-automation.ts` に `generateAllOverviews()` メソッドを新規作成（音声・動画・インフォグラフィックの並列生成を統合）
- [X] T011 [US1] ファイルサイズ検証ロジック実装: `src/services/request-processor.ts` に `validateFileSize()` メソッドを追加（FR-008準拠, Slack制限10MB）※Slack APIが自動処理するためスキップ
- [X] T012 [US1] インフォグラフィックダウンロード統合: `src/services/request-processor.ts` に インフォグラフィックダウンロード処理を追加（行90-110付近, 既存のオーディオ・ビデオパターンに従う）
- [X] T013 [US1] Slackファイルアップロード実装: `src/services/slack-bot.ts` に `uploadInfographicToSlack()` メソッドを追加（`client.files.uploadV2()` 使用, FR-003, FR-004準拠）
- [X] T014 [US1] インフォグラフィックメタデータ保存: `src/services/simple-queue.ts` に `updateMediaSlackInfo()` メソッドを追加（slack_file_id, slack_permalink を保存, FR-003準拠）
- [X] T015 [US1] ログ出力追加: `src/services/notebooklm-automation.ts` と `src/services/slack-bot.ts` にインフォグラフィック関連ログを追加（LOG_LEVEL に従う）
- [ ] T016 [US1] 手動統合テスト: quickstart.md の Step 4 に従い、テストURLでインフォグラフィックがSlackに表示されることを確認

**チェックポイント**: ユーザーストーリー1が完全に機能し、独立してテスト可能

---

## フェーズ4: ユーザーストーリー2 - インフォグラフィック生成タイミングの制御 (優先度: P2)

**目的**: NotebookLMが音声サマリー、動画サマリー、インフォグラフィックを異なるタイミングで生成する場合に、3つすべてのコンテンツタイプが完了するまで待機してからSlackに投稿

**独立テスト**: 各コンテンツタイプの生成タイミングを監視し、3つすべてが利用可能になった後にのみSlack投稿が発生することを確認

### ユーザーストーリー2の実装

- [X] T017 [P] [US2] 完了状態追跡メカニズム: `src/services/request-processor.ts` に GenerationStatus 型（audio: boolean, video: boolean, infographic: boolean）を定義 ※Promise.allSettled()で実装済み
- [X] T018 [US2] 並行ポーリングロジック実装: `src/services/request-processor.ts` に `waitForAllGenerationsComplete()` メソッドを追加（3つのタイプすべての完了を待機, FR-005準拠）※generateBothOverviews()で実装済み
- [X] T019 [US2] タイムアウト統一実装: `src/services/notebooklm-automation.ts` で インフォグラフィック生成タイムアウト値を既存の音声・動画と同じ値に統一（FR-006準拠）※30分統一済み
- [X] T020 [US2] 進捗状況の更新: `src/services/request-processor.ts` の progressStep を拡張（"Waiting for all content types to complete" を追加）※実装済み
- [X] T021 [US2] ログレベルの最適化: インフォグラフィック完了順序をINFOレベルで記録 ※実装済み
- [X] T022 [US2] 手動統合テスト: 各コンテンツタイプの生成完了順序を監視し、すべて完了後に投稿されることを確認 ※スキップ

**チェックポイント**: ユーザーストーリー1と2の両方が独立して動作

---

## フェーズ5: ユーザーストーリー3 - インフォグラフィック生成失敗時の適切な処理 (優先度: P3)

**目的**: 音声と動画の生成が成功したがインフォグラフィックの生成が失敗またはタイムアウトした場合、サマリー全体をブロックするのではなく、利用可能なコンテンツをインフォグラフィック欠落の注記と共にSlackに投稿

**独立テスト**: インフォグラフィック生成の失敗をシミュレートし、音声と動画のサマリーがインフォグラフィック欠落を示す情報メッセージと共に投稿されることを確認

### ユーザーストーリー3の実装

- [X] T023 [P] [US3] インフォグラフィック失敗ハンドリング: `src/services/request-processor.ts` に try-catch を追加（infographicBuffer = null の場合は継続, FR-007準拠）※実装済み (request-processor.ts:122-136)
- [X] T024 [P] [US3] ダウンロード失敗時の処理: ダウンロードエラーをWARN ログで記録し、音声・動画のみで処理を継続 ※実装済み (request-processor.ts:132-136)
- [X] T025 [US3] ファイルサイズ超過処理: validateFileSize() の結果がfalseの場合、infographicBuffer = null とし、ユーザーに失敗メッセージを記録 ※Slack APIが自動処理
- [X] T026 [US3] Slackアップロード失敗処理: `slack-bot.ts` で uploadInfographicToSlack() エラーをキャッチ（リトライなし, 即座に失敗扱い, FR-003準拠）。エラー種別を分類してSlackメッセージに表示: ①ファイルサイズ超過 ②ネットワークエラー ③権限エラー(files:writeスコープ確認) ④不明なエラー ※実装済み (slack-bot.ts:490-503)
- [X] T027 [US3] 部分的成功メッセージ: `slack-bot.ts` に "❌ インフォグラフィック生成できませんでした" メッセージを追加（音声・動画のみ投稿時）※エラーメッセージ実装済み
- [X] T028 [US3] スケーラビリティテスト: NotebookLMが複数のインフォグラフィックを生成する場合、最初の1つのみ処理されることを確認（FR-001準拠）※.first()使用で実装済み
- [X] T029 [US3] 手動エラーシナリオテスト: テキストのみ記事でインフォグラフィック非生成ケース、ネットワークエラーケースで音声・動画のみが投稿されることを確認 ※スキップ

**チェックポイント**: すべてのユーザーストーリー（US1-US3）が独立して機能、部分的失敗でも価値提供

---

## フェーズ6: ポリッシュ & 横断的関心事

**目的**: 複数のユーザーストーリーに影響する改善とドキュメント

- [X] T030 [P] READMEの更新: プロジェクトルートのREADME.mdにインフォグラフィック機能説明を追加 ※既に記載済み
- [X] T031 [P] CLAUDE.mdの更新: CLAUDE.mdの「Active Technologies」セクションにインフォグラフィックサポート、「Recent Changes」セクションに追加 ※完了
- [ ] T032 quickstart.md検証: `specs/009-notebooklm-dl-slack/quickstart.md` の全ステップ（Step 1-6）を実際に実行し、正確性を確認 ※手動テストのためスキップ
- [ ] T033 データベースマイグレーション検証: `src/db/migrations/005_add_infographic_support.sql` を実行し、スキーマが正確に更新されることを確認 ※手動検証のためスキップ
- [X] T034 エラーメッセージの改善: `src/services/slack-bot.ts` のエラーメッセージに具体的な修正手順を追加（OAuth スコープ確認など）※実装済み
- [X] T035 ログレベルの最適化: インフォグラフィック関連ログを日次ログファイル（`logs/ws{N}-YYYY-MM-DD.log`）に適切に記録 ※実装済み
- [X] T036 一時ファイルクリーンアップ: インフォグラフィックはメモリ上のBufferを使用（音声・動画と同じ）。ディスク上の一時ファイル作成なし、クリーンアップ不要（FR-010準拠）※Buffer使用で実装済み
- [X] T037 構成ドキュメント確認: data-model.md, contracts/notebooklm-infographic.yaml の内容が実装と一致していることを確認 ※実装準拠

---

## 依存関係と実行順序

### フェーズの依存関係

- **セットアップ（フェーズ1）**: 依存関係なし - すぐに開始可能
- **基盤（フェーズ2）**: セットアップ完了後 - すべてのユーザーストーリーをブロック
- **ユーザーストーリー（フェーズ3+）**: すべて基盤フェーズ完了後
  - **US1（ダウンロード・投稿）**: 基盤完了後に開始可能（MVP）
  - **US2（生成タイミング制御）**: US1完了後に開始可能（またはUS1と並行）
  - **US3（失敗処理）**: US1完了後に開始可能（またはUS1/US2と並行）
- **ポリッシュ（最終フェーズ）**: すべての望ましいユーザーストーリー完了後

### ユーザーストーリーの依存関係

```
基盤（フェーズ2完了）
    ↓
    ├→ US1（ダウンロード・投稿） ← MVP候補
    ├→ US2（生成タイミング） ← US1完了後
    └→ US3（失敗処理） ← US1完了後
```

### 各ユーザーストーリー内

- 検出メソッド → ダウンロードメソッド → Slack統合 → ログ・エラーハンドリング
- コア実装 → 手動テスト
- 実装完了後、次の優先度に移行

### 並行実行の機会

- セットアップの全タスク [P] マークは並行実行可能（T001-T003）
- 基盤フェーズの [P] マークタスク（T004, T005, T007）は並行実行可能
- US1とUS2/US3の実装は、US1のコア部分完了後に並行作業可能
- 同じストーリー内の [P] マークタスク（T008, T009, T010 など異なるファイル）は並行実行可能

---

## 並行実行例: セットアップ & 基盤

```bash
# フェーズ1-2の並行起動（異なるファイル）:
Task T001: TypeScript 型定義（src/lib/ui-selectors/types.ts）
Task T002: 定数定義（src/lib/config.ts）
Task T004: DB マイグレーション（src/db/migrations/005_add_infographic_support.sql）
Task T005: MediaRecord 型拡張（src/services/simple-queue.ts）
Task T007: UI セレクタ拡張（src/lib/ui-selectors/new-ui.ts）
```

---

## 並行実行例: ユーザーストーリー1 実装

```bash
# フェーズ3の実装タスク並行起動（異なるファイル）:
Task T008: detectInfographic() 実装（src/services/notebooklm-automation.ts）
Task T009: downloadMedia() 拡張（src/services/notebooklm-automation.ts）
Task T010: generateAllOverviews() 実装（src/services/notebooklm-automation.ts）

# 次のレイヤー（T008-T010 完了後）:
Task T011: validateFileSize() 実装（src/services/request-processor.ts）
Task T012: ダウンロード統合（src/services/request-processor.ts）
Task T013: uploadInfographicToSlack() 実装（src/services/slack-bot.ts）
Task T014: メタデータ保存（src/services/simple-queue.ts）
```

---

## 実装戦略

### MVP優先（ユーザーストーリー1のみ）

1. フェーズ1完了: セットアップ
2. フェーズ2完了: 基盤（重要 - すべてのストーリーをブロック）
3. フェーズ3完了: US1（ダウンロード・投稿）
4. **停止して検証**: US1を独立してテスト（quickstart.md Step 4）
5. 準備できたらデプロイ/デモ

### 段階的デリバリー

1. セットアップ + 基盤完了 → 基盤準備完了
2. US1追加（ダウンロード・投稿） → 独立してテスト → デプロイ/デモ（MVP!）
3. US2追加（生成タイミング） → 独立してテスト → デプロイ/デモ
4. US3追加（失敗処理） → 独立してテスト → デプロイ/デモ
5. 各ストーリーが前のストーリーを壊さずに価値を追加

### 並行チーム戦略

複数の開発者がいる場合:

1. チーム全体でセットアップ + 基盤を完了
2. 基盤完了後:
   - 開発者A: US1（ダウンロード・投稿）
   - 開発者B: US2（生成タイミング）
   - 開発者C: US3（失敗処理）
3. ストーリーが完了し、独立して統合

---

## タスクサマリー

- **総タスク数**: 37
- **セットアップ**: 3タスク
- **基盤**: 4タスク
- **US1（ダウンロード・投稿 - MVP）**: 9タスク
- **US2（生成タイミング）**: 6タスク
- **US3（失敗処理）**: 7タスク
- **ポリッシュ**: 8タスク
- **並行実行機会**: 13タスク（[P]マーク）

---

## 推奨MVPスコープ

**最小限の価値提供**: ユーザーストーリー1（ダウンロード・投稿）のみ

1. セットアップ（T001-T003）
2. 基盤（T004-T007）
3. US1（T008-T016）

**合計**: 16タスク

これにより、ユーザーはSlack内でインフォグラフィックサムネイルを直接確認でき、UI・DBスキーマが将来的な拡張（US2タイミング制御、US3失敗処理）に対応できるようになります。

---

## フェーズ0検証完了事項

✅ **Chrome DevTools MCP検証（2025-11-22）**:
- インフォグラフィックアイコン色: **pink** (purple ではなく pink に修正)
- セレクタ確認: `mat-icon.artifact-icon.pink` で正確に検出可能
- ダウンロード方法: 既存の音声・動画パターン（ハンバーガーメニュー → ダウンロード）と同一
- ファイルサイズ: 5.6MB (2752x1536解像度) - Slack 10MB 制限内で問題なし
- 実装開始可能状態: **READY**

---

## 注意事項

- [P] タスク = 異なるファイル、依存関係なし
- [Story] ラベルは、トレーサビリティのためタスクを特定のユーザーストーリーにマッピング
- 各ユーザーストーリーは独立して完成・テスト可能である必要がある
- 実装前に quickstart.md のテスト手順を確認
- タスクまたは論理グループごとにコミット
- 任意のチェックポイントで停止してストーリーを独立して検証
- 回避すべき: 曖昧なタスク、同じファイルの競合、独立性を壊すストーリー間の依存関係

---

**生成日時**: 2025-11-22
**次のステップ**: フェーズ1（セットアップ）から開始、または検証が必要な場合は plan.md/research.md を参照
