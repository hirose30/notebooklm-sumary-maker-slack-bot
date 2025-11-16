# 実装計画: NotebookLM UI バージョンサポート (旧UI・新UI互換性)

**ブランチ**: `008-notebooklm-ui-ui` | **日付**: 2025-11-15 | **仕様書**: [spec.md](./spec.md)
**入力**: `/specs/008-notebooklm-ui-ui/spec.md` の機能仕様書

## 概要

NotebookLMの新UIアップデートに対応し、ワークスペースごとに旧UI・新UIを設定ファイルで切り替え可能にする。各ワークスペースは独立したPlaywrightコンテキストで動作し、UIバージョンが異なる複数のワークスペースが並行処理可能。

**主要要件**:
- ワークスペース単位でUIバージョン設定（旧UI / 新UI）
- 設定ファイルのみでのUIバージョン移行（コード変更・再デプロイ不要）
- 旧UI・新UIの各DOMセレクタと操作パターンの詳細ドキュメント化
- UIバージョン不一致時の明確なエラーメッセージ

## 技術コンテキスト

**言語/バージョン**: TypeScript 5.3.3 + Node.js 20+
**主要依存関係**: @slack/bolt 4.5.0, Playwright 1.56.0, better-sqlite3 12.4.1
**ストレージ**: SQLite (./data/bot.db) + Cloudflare R2 (メディアファイル)
**テスト**: Jest (既存) + Playwright Test (DOM検証用)
**対象プラットフォーム**: Node.js サーバー (マルチワークスペース対応)
**プロジェクトタイプ**: 単一プロジェクト (既存構造を維持)
**パフォーマンス目標**: 並行リクエスト処理（ワークスペース間で完全分離）、設定変更は1回のbot再起動で反映（30秒以内）
**制約**: 設定ファイルの検証エラー時は起動拒否、UIバージョン不一致時はSlackユーザーにエラー通知
**スケール/スコープ**: 2つのUIバージョンサポート（旧UI・新UI）、複数ワークスペース対応

## 憲法チェック

*ゲート: フェーズ0リサーチ前に合格必須。フェーズ1設計後に再チェック。*

現在、プロジェクトに憲法ファイルが存在しないため、このセクションはスキップします。
今後、プロジェクト憲法を定義する場合は、`.specify/memory/constitution.md` に記載してください。

**ステータス**: ✅ 合格（憲法未定義）

## プロジェクト構造

### ドキュメント（この機能）

```
specs/008-notebooklm-ui-ui/
├── plan.md              # このファイル (/speckit.plan コマンド出力)
├── research.md          # フェーズ0出力 (/speckit.plan コマンド)
├── data-model.md        # フェーズ1出力 (/speckit.plan コマンド)
├── quickstart.md        # フェーズ1出力 (/speckit.plan コマンド)
├── contracts/           # フェーズ1出力 (/speckit.plan コマンド)
│   └── ui-selectors.md  # UIセレクタ定義
└── tasks.md             # フェーズ2出力 (/speckit.tasks コマンド - /speckit.plan では作成されない)
```

### ソースコード（リポジトリルート）

```
src/
├── models/
│   ├── workspace.ts              # 既存: Workspace型定義
│   └── ui-version.ts             # 新規: UIバージョン型定義
├── services/
│   ├── notebooklm-automation.ts  # 既存: 修正 - UIバージョン対応
│   ├── workspace-context.ts      # 既存: AsyncLocalStorage使用
│   └── ui-selector-factory.ts    # 新規: UIバージョン別セレクタファクトリ
├── lib/
│   ├── config.ts                 # 既存: 修正 - UIバージョン設定読み込み
│   ├── workspace-loader.ts       # 既存: 修正 - UIバージョン検証
│   └── ui-selectors/             # 新規: セレクタ定義ディレクトリ
│       ├── old-ui.ts             # 旧UIセレクタ
│       ├── new-ui.ts             # 新UIセレクタ
│       └── types.ts              # セレクタインターフェース
└── index.ts                      # 既存: 修正 - 起動時検証

tests/
├── unit/
│   ├── ui-selector-factory.test.ts  # 新規
│   └── ui-version-config.test.ts    # 新規
└── integration/
    └── ui-version-switching.test.ts # 新規

scripts/
└── investigate-notebooklm-ui.ts     # 新規: DOM調査スクリプト
```

**構造決定**: 既存の単一プロジェクト構造を維持。UIバージョン関連の新規モジュールを `src/lib/ui-selectors/` に配置し、既存の `notebooklm-automation.ts` を修正してセレクタファクトリを使用する設計。

## 複雑性トラッキング

*憲法チェックに違反がある場合のみ記入*

憲法が未定義のため、このセクションは空欄。

---

# フェーズ0: アウトライン & リサーチ

## リサーチタスク

以下の調査タスクを実行し、結果を `research.md` にまとめます：

### 1. NotebookLM UI DOM構造調査

**目的**: 旧UI・新UIの実際のDOMセレクタとインタラクションパターンを特定

**調査内容**:
- Chrome DevToolsを使用した旧UIの要素調査
  - ログインボタン
  - コンテンツアップロードボタン
  - URL入力フィールド
  - サマリー生成ボタン
  - サマリー表示エリア
- 新UIの同様の要素調査
- 各要素のCSSセレクタ、XPath、役割属性の記録
- インタラクション手順（クリック、入力、待機）の記録
- 期待される結果の記録

**成果物**: `research.md` の「DOM調査結果」セクション

### 2. TypeScript型安全なセレクタパターン調査

**目的**: セレクタの型安全性とメンテナンス性を確保する設計パターン

**調査内容**:
- TypeScriptインターフェースでのセレクタ定義パターン
- Factory Patternを用いたUIバージョン別セレクタの切り替え
- 既存コードベースでの類似パターン（もしあれば）

**成果物**: `research.md` の「セレクタ設計パターン」セクション

### 3. 設定ファイルバリデーション手法

**目的**: 起動時の設定ファイル検証とエラーハンドリング

**調査内容**:
- Node.jsでの起動時検証パターン
- Zod/Joi/Yup等のスキーマ検証ライブラリ評価
- 既存の `config.ts` との統合方法
- プロセス終了コードの適切な設定

**成果物**: `research.md` の「設定検証手法」セクション

### 4. Playwright コンテキスト分離ベストプラクティス

**目的**: ワークスペース間の完全な分離を確保

**調査内容**:
- Playwright BrowserContext の分離保証
- 既存の `NotebookLMAutomation` クラスでのコンテキスト管理
- 並行処理時のメモリ使用量とパフォーマンス影響

**成果物**: `research.md` の「Playwright分離設計」セクション

---

# フェーズ1: 設計 & 契約

## データモデル

`data-model.md` に以下のエンティティを定義：

### UIVersionConfig (UIバージョン設定)

**目的**: ワークスペースごとのUIバージョン設定

**属性**:
- `workspaceId: string` - ワークスペース識別子
- `uiVersion: 'old' | 'new'` - UIバージョン（列挙型）
- `source: 'config' | 'default'` - 設定ソース（明示的設定 or デフォルト）

**検証ルール**:
- `uiVersion` は 'old' または 'new' のみ許可
- `workspaceId` は必須

**状態遷移**:
- 設定ファイル読み込み時に初期化
- bot再起動時に再ロード
- ランタイム中は不変

### UISelector (UIセレクタセット)

**目的**: UIバージョン別のDOMセレクタとアクション定義

**属性**:
- `loginButton: string` - ログインボタンのセレクタ
- `uploadButton: string` - コンテンツアップロードボタンのセレクタ
- `urlInput: string` - URL入力フィールドのセレクタ
- `generateButton: string` - サマリー生成ボタンのセレクタ
- `summaryArea: string` - サマリー表示エリアのセレクタ
- `actions: Record<string, ActionStep[]>` - アクション手順

### ActionStep (アクション手順)

**目的**: UI操作の詳細手順

**属性**:
- `selector: string` - 対象要素のセレクタ
- `actionType: 'click' | 'type' | 'wait' | 'waitForSelector'` - アクション種別
- `value?: string` - 入力値（type時のみ）
- `timeout?: number` - タイムアウト（wait系のみ）
- `expectedResult: string` - 期待される結果の説明

## API契約

`contracts/ui-selectors.md` に以下を定義：

### UISelectorFactory インターフェース

```typescript
interface UISelectorFactory {
  /**
   * UIバージョンに応じたセレクタセットを取得
   * @param version - UIバージョン ('old' | 'new')
   * @returns UISelector セレクタセット
   * @throws Error - 無効なバージョンの場合
   */
  getSelectors(version: 'old' | 'new'): UISelector;

  /**
   * サポートされているUIバージョン一覧を取得
   * @returns string[] - バージョン文字列の配列
   */
  getSupportedVersions(): string[];
}
```

### WorkspaceConfigLoader インターフェース

```typescript
interface WorkspaceConfigLoader {
  /**
   * ワークスペース設定を読み込み・検証
   * @throws Error - 設定ファイルが不正な場合
   */
  loadAndValidate(): Map<string, UIVersionConfig>;

  /**
   * 特定ワークスペースのUIバージョンを取得
   * @param workspaceId - ワークスペースID
   * @returns 'old' | 'new' - UIバージョン（未設定の場合はデフォルト'old'）
   */
  getUIVersion(workspaceId: string): 'old' | 'new';
}
```

## クイックスタート

`quickstart.md` に以下を記載：

### 開発環境セットアップ

1. DOM調査スクリプトの実行:
   ```bash
   # 旧UIアカウントでログイン済みの環境
   TEST_URL=https://notebooklm.google.com npx tsx scripts/investigate-notebooklm-ui.ts --ui=old

   # 新UIアカウントでログイン済みの環境
   TEST_URL=https://notebooklm.google.com npx tsx scripts/investigate-notebooklm-ui.ts --ui=new
   ```

2. セレクタドキュメントの確認:
   - `specs/008-notebooklm-ui-ui/contracts/ui-selectors.md` で定義を確認

3. 実装順序:
   - 型定義 (`src/models/ui-version.ts`)
   - セレクタ定義 (`src/lib/ui-selectors/*.ts`)
   - セレクタファクトリ (`src/services/ui-selector-factory.ts`)
   - 設定ローダー修正 (`src/lib/workspace-loader.ts`)
   - NotebookLM自動化修正 (`src/services/notebooklm-automation.ts`)

### テスト実行

```bash
# ユニットテスト
npm test

# UIバージョン切り替えの統合テスト
npm run test:integration -- ui-version-switching.test.ts
```

### 設定例

`.env.ws1`:
```
NOTEBOOKLM_UI_VERSION=old
```

`.env.ws2`:
```
NOTEBOOKLM_UI_VERSION=new
```

---

# フェーズ2: タスク分解

**注意**: タスク分解は `/speckit.tasks` コマンドで実行されます。このコマンド (`/speckit.plan`) では `tasks.md` は生成されません。

フェーズ2の準備として、以下の依存関係を記録：

**実装順序の依存関係**:
1. DOM調査 (P3) → セレクタドキュメント作成
2. セレクタドキュメント → 型定義・セレクタ実装
3. 型定義 → セレクタファクトリ実装
4. セレクタファクトリ → 設定ローダー修正
5. 設定ローダー → NotebookLM自動化修正
6. すべての実装 → 統合テスト

**並行可能なタスク**:
- DOM調査（旧UI・新UIは並行可能）
- ユニットテストの作成

---

# 次のステップ

1. `/speckit.plan` の実行完了後、以下のファイルが生成されます:
   - `research.md` - リサーチ結果
   - `data-model.md` - データモデル定義
   - `contracts/ui-selectors.md` - API契約
   - `quickstart.md` - 開発者向けガイド

2. `/speckit.tasks` コマンドを実行して `tasks.md` を生成し、具体的な実装タスクに分解します。

3. DOM調査（User Story 4: P3）を最初に実施し、実際のセレクタを `contracts/ui-selectors.md` に記録します。

---

**生成日時**: 2025-11-15
**次のコマンド**: `/speckit.tasks` (タスク分解)
