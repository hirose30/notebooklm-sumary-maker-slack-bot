# Implementation Plan: NotebookLMインフォグラフィックのダウンロードとSlack表示

**Branch**: `009-notebooklm-dl-slack` | **Date**: 2025-11-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-notebooklm-dl-slack/spec.md`

## Summary

NotebookLMが新たに提供するインフォグラフィック生成機能に対応し、既存の音声・動画サマリーと同様にインフォグラフィック画像をダウンロードしてSlackメッセージに添付することで、ユーザーがSlack内で直接ビジュアルサムネイルを確認できるようにする。既存のPlaywrightベースのNotebookLM自動化システムを拡張し、インフォグラフィック検出、ダウンロード、Slackアップロード機能を追加する。

## Technical Context

**Language/Version**: Node.js 20+ with TypeScript 5.3.3
**Primary Dependencies**: @slack/bolt 4.5.0, Playwright 1.56.0, better-sqlite3 12.4.1, @aws-sdk/client-s3 ^3.907.0
**Storage**: SQLite (./data/bot.db) + Cloudflare R2 for media files
**Testing**: Vitest (既存テスト実行環境)
**Target Platform**: Linux/macOS server (Node.js runtime)
**Project Type**: Single project (existing architecture)
**Performance Goals**:
  - インフォグラフィックダウンロード: 30秒以内完了
  - Slack投稿: 5秒以内にサムネイル表示
  - 自動化成功率: 95%以上
**Constraints**:
  - タイムアウト: 既存の音声・動画タイムアウトと同じ値を使用
  - ファイルサイズ: Slackサイズ制限内（通常10MB未満のPNGファイルを想定）
  - リトライなし: アップロード失敗時は即座に失敗扱い
**Scale/Scope**: Multi-workspace Slack Bot (既存2ワークスペース対応)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS (No constitution file exists - using project best practices)

憲法ファイルが存在しないため、既存コードベースのパターンとベストプラクティスに従う:
- 既存のNotebookLM自動化パターンを拡張
- Slack Bot APIの既存権限を活用
- エラーハンドリングとログ記録の既存パターンに従う
- 段階的な機能拡張（P1→P2→P3の優先順位付き実装）

## Project Structure

### Documentation (this feature)

```
specs/009-notebooklm-dl-slack/
├── plan.md              # This file
├── research.md          # Phase 0 output (technical decisions)
├── data-model.md        # Phase 1 output (schema extensions)
├── quickstart.md        # Phase 1 output (setup guide)
├── contracts/           # Phase 1 output (API contracts)
│   └── notebooklm-infographic.yaml
└── tasks.md             # Phase 2 output (NOT created yet)
```

### Source Code (repository root - existing structure extended)

```
src/
├── lib/
│   ├── logger.ts                    # 既存 - ログ記録
│   ├── log-transport.ts             # 既存 - ファイルトランスポート
│   ├── database.ts                  # 既存 - SQLite接続
│   ├── config.ts                    # 既存 - 環境設定
│   ├── ui-selectors/
│   │   ├── old-ui.ts                # 既存 - 旧UIセレクタ
│   │   ├── new-ui.ts                # [拡張] 新UI + インフォグラフィックセレクタ
│   │   └── types.ts                 # [拡張] インフォグラフィック型定義追加
│   └── format-utils.ts              # 既存 - フォーマット処理
├── models/
│   ├── workspace.ts                 # 既存 - ワークスペースモデル
│   └── ui-version.ts                # 既存 - UIバージョン管理
├── services/
│   ├── notebooklm-automation.ts     # [拡張] インフォグラフィック検出・DL機能追加
│   ├── slack-bot.ts                 # [拡張] 画像アップロード機能追加
│   ├── request-processor.ts         # [拡張] インフォグラフィック処理統合
│   ├── cloudflare-storage.ts        # 既存 - R2ストレージ (必要に応じて使用)
│   └── workspace-context.ts         # 既存 - ワークスペースコンテキスト
└── index.ts                         # 既存 - エントリーポイント

tests/
├── unit/
│   └── infographic-detection.test.ts    # [新規] インフォグラフィック検出テスト
├── integration/
│   └── infographic-slack-upload.test.ts # [新規] Slackアップロードテスト
└── e2e/
    └── infographic-e2e.test.ts          # [新規] エンドツーエンドテスト

data/
└── bot.db                           # [拡張] requestsテーブルにinfographic関連カラム追加
```

**Structure Decision**:
既存のSingle Project構造を維持。インフォグラフィック機能は既存のNotebookLM自動化レイヤー（`notebooklm-automation.ts`）とSlackボットレイヤー（`slack-bot.ts`）の拡張として実装。新規ファイル作成は最小限に抑え、既存サービスへの機能追加を優先する。

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

該当なし - 憲法ファイルが存在せず、既存パターンへの段階的拡張のため新たな複雑性は導入しない。

## Phase 0: UI Verification with Chrome DevTools MCP (MANDATORY GATE)

**Status**: ✅ COMPLETED (2025-11-22)

**Objective**: 実装前に、Chrome DevTools MCPツールを使用してNotebookLM実機UIを調査し、research.mdの技術的仮定を検証する。

### 検証項目と結果

#### 1. インフォグラフィックアイコン色の確認
- **仮定（research.md）**: `mat-icon.artifact-icon.purple`
- **実機検証結果**: `mat-icon.artifact-icon.pink` ⚠️ **修正必要**
- **検証方法**: Chrome DevTools MCPでNotebookLM Studio パネルを調査
- **検証日**: 2025-11-22

#### 2. アーティファクトタイプ別アイコン色マッピング
| アーティファクトタイプ | アイコン名 | 色クラス | 検証状況 |
|-------------------|----------|---------|---------|
| インフォグラフィック | `stacked_bar_chart` | **pink** | ✅ 確認済み |
| レポート | `tablet` | **yellow** | ✅ 確認済み |
| 動画 | `subscriptions` | **green** | ✅ 既存と一致 |
| 音声 | `audio_magic_eraser` | **blue** | ✅ 既存と一致 |

#### 3. ダウンロードボタンアクセス方法
- **検証内容**: ハンバーガーメニュー（`mat-icon:text("more_vert")`）からダウンロードメニューアイテムへのアクセス
- **結果**: ✅ 既存の音声・動画パターンと同一
- **セレクタパターン**:
  ```typescript
  // アーティファクトカードのハンバーガーメニューをクリック
  await artifactCard.locator('mat-icon:text("more_vert")').click();
  await page.waitForTimeout(500);

  // ダウンロードイベントを待機してダウンロードボタンをクリック
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('text="ダウンロード"'),
  ]);
  ```

#### 4. ダウンロードファイル仕様確認
- **ファイル形式**: PNG ✅
- **解像度**: 2752 x 1536
- **ファイルサイズ**: 5.6MB（テストケース）
- **Slackサイズ制限適合性**: ✅ 10MB制限内

### 修正アクション

1. **research.md更新**: ✅ COMPLETED
   - Line 18: `purple` → `pink`
   - Line 38-45: 検出コード例の修正
   - Line 92-109: ダウンロード実装コード修正
   - 実機検証結果セクション追加

2. **Phase 1以降の実装方針**:
   - インフォグラフィック検出セレクタは`mat-icon.artifact-icon.pink`を使用
   - ダウンロード方法は既存の音声・動画パターンを継承
   - ファイルサイズ検証（FR-008）: 10MB制限チェック実装

### Next Steps

Phase 0検証完了により、Phase 1（Database Schema）とPhase 2（NotebookLM Automation）の実装を開始可能。

**IMPORTANT**: 将来的にNotebookLM UIが変更された場合、同様にChrome DevTools MCPを使用してセレクタを再検証すること。
