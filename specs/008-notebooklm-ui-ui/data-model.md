# データモデル: NotebookLM UI バージョンサポート

**機能**: 008-notebooklm-ui-ui
**日付**: 2025-11-15

## エンティティ概要

このドキュメントでは、UIバージョンサポート機能で使用されるデータモデルを定義します。

---

## 1. UIVersionConfig (UIバージョン設定)

### 目的

ワークスペースごとのUIバージョン設定を表現し、実行時の設定ソースを追跡します。

### 属性

| 属性名 | 型 | 必須 | 説明 |
|-------|---|------|------|
| `workspaceId` | `string` | ✓ | ワークスペース識別子（例: "ws1", "ws2"） |
| `uiVersion` | `'old' \| 'new'` | ✓ | 使用するUIバージョン |
| `source` | `'config' \| 'default'` | ✓ | 設定の取得元 |

### TypeScript型定義

```typescript
export interface UIVersionConfig {
  workspaceId: string;
  uiVersion: 'old' | 'new';
  source: 'config' | 'default';
}
```

### 検証ルール

1. **workspaceId**:
   - 空文字列不可
   - 既存のワークスペース識別子と一致すること

2. **uiVersion**:
   - `'old'` または `'new'` のみ許可
   - それ以外の値は起動時エラー（FR-007）

3. **source**:
   - `'config'`: 環境変数 `NOTEBOOKLM_UI_VERSION` から明示的に設定
   - `'default'`: 環境変数未設定時のデフォルト値（'old'）

### 状態遷移

```
[Bot起動] → [設定ファイル読み込み] → [検証] → [UIVersionConfig生成]
                                        ↓ 不正な値
                                    [エラー終了]

[Bot起動中] → [不変] (再起動までUIバージョン変更不可)

[Bot再起動] → [新しい設定で再ロード]
```

### 使用例

```typescript
// 明示的に新UIを設定した場合
const config1: UIVersionConfig = {
  workspaceId: 'ws2',
  uiVersion: 'new',
  source: 'config'
};

// デフォルト（旧UI）の場合
const config2: UIVersionConfig = {
  workspaceId: 'ws1',
  uiVersion: 'old',
  source: 'default'
};
```

### エンティティ関係

- `Workspace` (既存) --(1:1)-- `UIVersionConfig`
  - 各ワークスペースは1つのUIバージョン設定を持つ

---

## 2. UISelector (UIセレクタセット)

### 目的

特定のUIバージョンに対応するDOMセレクタと操作手順を定義します。

### 属性

| 属性名 | 型 | 必須 | 説明 |
|-------|---|------|------|
| `newProject` | `string` | ✓ | 新規プロジェクト作成ボタンのセレクタ |
| `addSource` | `string` | ✓ | コンテンツソース追加ボタンのセレクタ |
| `urlInput` | `string` | ✓ | URL入力フィールドのセレクタ |
| `saveButton` | `string` | ✓ | 保存/確認ボタンのセレクタ |
| `generateNotebook` | `string` | ✓ | ノートブック生成ボタンのセレクタ |
| `summaryArea` | `string` | ✓ | サマリー表示エリアのセレクタ |
| `actions` | `Record<string, ActionStep[]>` | ✓ | アクション手順のマップ |

### TypeScript型定義

```typescript
export interface UISelector {
  newProject: string;
  addSource: string;
  urlInput: string;
  saveButton: string;
  generateNotebook: string;
  summaryArea: string;
  actions: Record<string, ActionStep[]>;
}
```

### セレクタ命名規則

- Playwrightの role-based selectorsを優先: `role=button[name="Upload"]`
- フォールバック用にCSSセレクタも記録: `button.upload-btn`
- テキストベースセレクタ: `text="アップロード"`

### 使用例

```typescript
// 旧UIセレクタ
export const oldUISelectors: UISelector = {
  newProject: 'role=button[name="新規プロジェクト"]',
  addSource: 'role=button[name="ソースを追加"]',
  urlInput: 'role=textbox[name="URL"]',
  saveButton: 'role=button[name="保存"]',
  generateNotebook: 'role=button[name="ノートブック生成"]',
  summaryArea: 'role=article[name="サマリー"]',
  actions: {
    uploadURL: [
      {
        selector: 'role=button[name="ソースを追加"]',
        actionType: 'click',
        expectedResult: 'ソース追加ダイアログが表示される'
      },
      {
        selector: 'role=textbox[name="URL"]',
        actionType: 'type',
        value: '{url}', // プレースホルダー
        expectedResult: 'URLが入力される'
      },
      {
        selector: 'role=button[name="保存"]',
        actionType: 'click',
        expectedResult: 'ソースが追加され、ダイアログが閉じる'
      }
    ]
  }
};
```

### エンティティ関係

- `UIVersionConfig` --(N:1)-- `UISelector`
  - 複数の設定が同じセレクタセットを参照（'old' または 'new'の2種類のみ）

---

## 3. ActionStep (アクション手順)

### 目的

UI要素に対する具体的な操作手順を定義します。

### 属性

| 属性名 | 型 | 必須 | 説明 |
|-------|---|------|------|
| `selector` | `string` | ✓ | 対象要素のセレクタ |
| `actionType` | `'click' \| 'type' \| 'wait' \| 'waitForSelector'` | ✓ | 実行するアクションの種類 |
| `value` | `string` | - | 入力値（`type` の場合のみ必須） |
| `timeout` | `number` | - | タイムアウト（ミリ秒、`wait*` 系のみ） |
| `expectedResult` | `string` | ✓ | 期待される結果の説明 |

### TypeScript型定義

```typescript
export type ActionType = 'click' | 'type' | 'wait' | 'waitForSelector';

export interface ActionStep {
  selector: string;
  actionType: ActionType;
  value?: string;
  timeout?: number;
  expectedResult: string;
}
```

### アクションタイプ詳細

| アクションタイプ | 説明 | 必須属性 | オプション属性 |
|---------------|------|---------|-------------|
| `click` | 要素をクリック | `selector`, `expectedResult` | - |
| `type` | テキストを入力 | `selector`, `value`, `expectedResult` | - |
| `wait` | 指定時間待機 | `expectedResult` | `timeout` (デフォルト: 1000ms) |
| `waitForSelector` | 要素の出現を待機 | `selector`, `expectedResult` | `timeout` (デフォルト: 30000ms) |

### 検証ルール

1. **selector**:
   - 空文字列不可
   - Playwrightの有効なセレクタ形式であること

2. **actionType**:
   - 定義された4種類のいずれか

3. **value**:
   - `actionType === 'type'` の場合は必須
   - その他の場合は無視

4. **timeout**:
   - 正の整数
   - `wait` または `waitForSelector` の場合のみ使用

5. **expectedResult**:
   - 空文字列不可
   - 人間が読める形式で期待結果を記述

### 使用例

```typescript
// クリックアクション
const clickStep: ActionStep = {
  selector: 'role=button[name="保存"]',
  actionType: 'click',
  expectedResult: 'ダイアログが閉じ、ソースが追加される'
};

// 入力アクション
const typeStep: ActionStep = {
  selector: 'role=textbox[name="URL"]',
  actionType: 'type',
  value: 'https://example.com',
  expectedResult: 'URLが入力フィールドに表示される'
};

// 待機アクション
const waitStep: ActionStep = {
  selector: 'role=article[name="サマリー"]',
  actionType: 'waitForSelector',
  timeout: 60000, // 1分
  expectedResult: 'サマリーエリアが表示される'
};
```

---

## 4. UISelectorFactory (セレクタファクトリ)

### 目的

UIバージョンに応じた適切なセレクタセットを提供します。

### TypeScript型定義

```typescript
export class UISelectorFactory {
  /**
   * UIバージョンに応じたセレクタセットを取得
   * @param version - UIバージョン ('old' | 'new')
   * @returns UISelector セレクタセット
   * @throws Error - 無効なバージョンの場合
   */
  getSelectors(version: 'old' | 'new'): UISelector {
    switch (version) {
      case 'old':
        return oldUISelectors;
      case 'new':
        return newUISelectors;
      default:
        throw new Error(`Unsupported UI version: ${version}`);
    }
  }

  /**
   * サポートされているUIバージョン一覧を取得
   * @returns string[] - バージョン文字列の配列
   */
  getSupportedVersions(): string[] {
    return ['old', 'new'];
  }
}
```

### 使用パターン

```typescript
const factory = new UISelectorFactory();
const config = getUIVersionConfig('ws1'); // UIVersionConfig
const selectors = factory.getSelectors(config.uiVersion);

// セレクタを使用
await page.click(selectors.newProject);
await page.fill(selectors.urlInput, url);
```

---

## データモデルの統合図

```
┌─────────────────┐
│   Workspace     │
│   (既存)        │
└────────┬────────┘
         │ 1:1
         │
         ▼
┌─────────────────────┐
│ UIVersionConfig     │
│ - workspaceId       │
│ - uiVersion         │
│ - source            │
└────────┬────────────┘
         │ N:1
         │
         ▼
┌──────────────────────────────┐
│     UISelectorFactory        │
│  getSelectors(version)       │
└────────┬─────────────────────┘
         │
         ├─── 'old' ──→ ┌──────────────┐
         │              │ oldUISelectors│
         │              └───────┬──────┘
         │                      │ has many
         │                      ▼
         │              ┌──────────────┐
         │              │  ActionStep  │
         │              └──────────────┘
         │
         └─── 'new' ──→ ┌──────────────┐
                        │ newUISelectors│
                        └───────┬──────┘
                                │ has many
                                ▼
                        ┌──────────────┐
                        │  ActionStep  │
                        └──────────────┘
```

---

## ストレージとライフサイクル

### 永続化

- **UIVersionConfig**: 環境変数から読み込み、メモリ内のみ（永続化不要）
- **UISelector**: ソースコード内に定義（`src/lib/ui-selectors/*.ts`）
- **ActionStep**: `UISelector.actions` の一部として定義

### ライフサイクル

1. **Bot起動時**:
   - 環境変数から `UIVersionConfig` を生成
   - 検証エラーがあれば起動拒否（`process.exit(1)`）

2. **リクエスト処理時**:
   - AsyncLocalStorageから現在のワークスペースIDを取得
   - `UIVersionConfig` からUIバージョンを取得
   - `UISelectorFactory` で適切なセレクタセットを取得
   - セレクタを使用してPlaywright操作を実行

3. **Bot再起動時**:
   - 新しい環境変数の値で再ロード
   - 既存のセッションは影響を受けない（ワークスペースごとに独立）

---

## セキュリティとバリデーション

### 起動時検証（FR-007）

```typescript
function validateUIVersionConfig(): void {
  const version = process.env.NOTEBOOKLM_UI_VERSION;

  if (version && version !== 'old' && version !== 'new') {
    logger.error('Invalid NOTEBOOKLM_UI_VERSION', { version });
    process.exit(1);
  }
}
```

### ランタイム検証（FR-010, FR-011）

```typescript
async function executeAction(step: ActionStep, page: Page): Promise<void> {
  try {
    switch (step.actionType) {
      case 'click':
        await page.click(step.selector, { timeout: step.timeout || 30000 });
        break;
      // ... 他のアクション
    }
  } catch (error) {
    // FR-010, FR-011: Slackユーザーにエラー通知
    throw new UIVersionMismatchError(
      `UIバージョン '${uiVersion}' のセレクタ '${step.selector}' が見つかりませんでした。` +
      `設定ファイルのNOTEBOOKLM_UI_VERSIONを確認してください。`
    );
  }
}
```

---

**作成日時**: 2025-11-15
**次の成果物**: `contracts/ui-selectors.md`, `quickstart.md`
