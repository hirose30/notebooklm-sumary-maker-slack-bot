# UI セレクタ契約: NotebookLM UI バージョンサポート

**機能**: 008-notebooklm-ui-ui
**日付**: 2025-11-15

## 概要

このドキュメントでは、NotebookLM の旧UI・新UIそれぞれのDOMセレクタと操作手順を定義します。

**重要**: このドキュメントは **DOM調査（User Story 4: P3）の完了後** に実際のセレクタで更新する必要があります。
現在の内容はプレースホルダーです。

---

## セレクタ命名規則

### 優先順位

1. **Role-based selectors** (最優先)
   - 例: `role=button[name="保存"]`
   - 理由: アクセシビリティ属性ベースで堅牢

2. **Text-based selectors**
   - 例: `text="保存"`
   - 理由: シンプルで読みやすい

3. **CSS selectors** (フォールバック)
   - 例: `button.save-btn`
   - 理由: UIの構造変更に脆弱だが、他の方法が使えない場合の選択肢

### セレクタ記述形式

各セレクタエントリは以下の情報を含む：

| 項目 | 説明 |
|-----|------|
| **要素名** | UI要素の名前（日本語） |
| **CSS セレクタ** | CSSセレクタ形式 |
| **Role セレクタ** | Playwright role-based selector |
| **Text セレクタ** | テキストベースのセレクタ |
| **アクション種別** | click / type / wait / waitForSelector |
| **期待される結果** | アクション実行後の期待される状態 |

---

## 旧UI セレクタ (Old UI)

**注意**: 以下は **プレースホルダー** です。DOM調査後に実際のセレクタに置き換えてください。

### ログイン・初期画面

#### ログインボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: ログインダイアログが表示される

### プロジェクト操作

#### 新規プロジェクト作成ボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: 新規プロジェクト作成ダイアログが表示される

#### プロジェクト名入力フィールド

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `type`
- **期待結果**: プロジェクト名が入力される

### コンテンツソース追加

#### ソース追加ボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: ソース追加ダイアログが表示される

#### URL入力フィールド

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `type`
- **期待結果**: URLが入力される

#### 保存/確認ボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: ソースが追加され、ダイアログが閉じる

### ノートブック生成

#### ノートブック生成ボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: ノートブック生成が開始される

#### 生成完了待機

- **CSS セレクタ**: `[PLACEHOLDER: サマリー表示エリアのセレクタ]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `waitForSelector`
- **タイムアウト**: 60000 (60秒)
- **期待結果**: サマリーエリアが表示される

#### サマリー表示エリア

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `waitForSelector`
- **期待結果**: 生成されたサマリーが表示される

---

## 新UI セレクタ (New UI)

**注意**: 以下は **プレースホルダー** です。DOM調査後に実際のセレクタに置き換えてください。

### ログイン・初期画面

#### ログインボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: ログインダイアログが表示される

### プロジェクト操作

#### 新規プロジェクト作成ボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: 新規プロジェクト作成ダイアログが表示される

#### プロジェクト名入力フィールド

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `type`
- **期待結果**: プロジェクト名が入力される

### コンテンツソース追加

#### ソース追加ボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: ソース追加ダイアログが表示される

#### URL入力フィールド

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `type`
- **期待結果**: URLが入力される

#### 保存/確認ボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: ソースが追加され、ダイアログが閉じる

### ノートブック生成

#### ノートブック生成ボタン

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `click`
- **期待結果**: ノートブック生成が開始される

#### 生成完了待機

- **CSS セレクタ**: `[PLACEHOLDER: サマリー表示エリアのセレクタ]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `waitForSelector`
- **タイムアウト**: 60000 (60秒)
- **期待結果**: サマリーエリアが表示される

#### サマリー表示エリア

- **CSS セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Role セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **Text セレクタ**: `[PLACEHOLDER: DOM調査後に記入]`
- **アクション**: `waitForSelector`
- **期待結果**: 生成されたサマリーが表示される

---

## 操作フロー定義

### URL追加からサマリー生成までの完全フロー

#### 旧UI フロー

```typescript
export const oldUIActions = {
  uploadURL: [
    {
      selector: '[旧UI: ソース追加ボタンのセレクタ]',
      actionType: 'click',
      expectedResult: 'ソース追加ダイアログが表示される'
    },
    {
      selector: '[旧UI: URL入力フィールドのセレクタ]',
      actionType: 'type',
      value: '{url}', // 実行時に置換
      expectedResult: 'URLが入力される'
    },
    {
      selector: '[旧UI: 保存ボタンのセレクタ]',
      actionType: 'click',
      expectedResult: 'ソースが保存される'
    },
    {
      selector: '[旧UI: ノートブック生成ボタンのセレクタ]',
      actionType: 'click',
      expectedResult: 'ノートブック生成が開始される'
    },
    {
      selector: '[旧UI: サマリー表示エリアのセレクタ]',
      actionType: 'waitForSelector',
      timeout: 60000,
      expectedResult: 'サマリーが表示される'
    }
  ]
};
```

#### 新UI フロー

```typescript
export const newUIActions = {
  uploadURL: [
    {
      selector: '[新UI: ソース追加ボタンのセレクタ]',
      actionType: 'click',
      expectedResult: 'ソース追加ダイアログが表示される'
    },
    {
      selector: '[新UI: URL入力フィールドのセレクタ]',
      actionType: 'type',
      value: '{url}',
      expectedResult: 'URLが入力される'
    },
    {
      selector: '[新UI: 保存ボタンのセレクタ]',
      actionType: 'click',
      expectedResult: 'ソースが保存される'
    },
    {
      selector: '[新UI: ノートブック生成ボタンのセレクタ]',
      actionType: 'click',
      expectedResult: 'ノートブック生成が開始される'
    },
    {
      selector: '[新UI: サマリー表示エリアのセレクタ]',
      actionType: 'waitForSelector',
      timeout: 60000,
      expectedResult: 'サマリーが表示される'
    }
  ]
};
```

---

## DOM調査手順

### 準備

1. 旧UIアカウントでログイン済みの環境（ws1）を用意
2. 新UIアカウントでログイン済みの環境（ws2）を用意
3. Chrome DevTools MCP を有効化

### 調査方法

#### 方法1: Chrome DevTools MCP を使用

```typescript
// scripts/investigate-notebooklm-ui.ts
import { chromium } from 'playwright';

async function investigateUI(uiType: 'old' | 'new') {
  const context = await chromium.launchPersistentContext(
    uiType === 'old' ? './user-data/ws1' : './user-data/ws2',
    { headless: false }
  );

  const page = await context.newPage();
  await page.goto('https://notebooklm.google.com');

  // Chrome DevTools で要素を検査
  // 各要素の role, name, CSS セレクタを記録

  await context.close();
}
```

#### 方法2: Playwright Inspector

```bash
# 旧UI調査
PWDEBUG=1 npx playwright test --headed

# 各要素をクリックして Playwright Inspector でセレクタを確認
```

### 記録フォーマット

調査結果は以下のフォーマットで記録：

```markdown
#### [要素名]

- **CSS セレクタ**: `button#save-btn`
- **Role セレクタ**: `role=button[name="保存"]`
- **Text セレクタ**: `text="保存"`
- **アクション**: `click`
- **期待結果**: ダイアログが閉じる
```

---

## TypeScript 型定義

### UISelector インターフェース

```typescript
export interface UISelector {
  // ログイン
  loginButton: string;

  // プロジェクト操作
  newProject: string;
  projectNameInput: string;

  // ソース追加
  addSource: string;
  urlInput: string;
  saveButton: string;

  // ノートブック生成
  generateNotebook: string;
  summaryArea: string;

  // アクションフロー
  actions: Record<string, ActionStep[]>;
}
```

### ActionStep インターフェース

```typescript
export interface ActionStep {
  selector: string;
  actionType: 'click' | 'type' | 'wait' | 'waitForSelector';
  value?: string;
  timeout?: number;
  expectedResult: string;
}
```

---

## 次のステップ

1. **DOM調査の実施** (User Story 4: P3)
   - 旧UIの全要素を調査
   - 新UIの全要素を調査
   - このドキュメントのプレースホルダーを実際のセレクタに置き換え

2. **セレクタの実装**
   - `src/lib/ui-selectors/old-ui.ts` に旧UIセレクタを実装
   - `src/lib/ui-selectors/new-ui.ts` に新UIセレクタを実装

3. **テストの作成**
   - 各セレクタが正しく動作することを検証
   - UIバージョン切り替えの統合テスト

---

**作成日時**: 2025-11-15
**更新予定**: DOM調査完了後
**ステータス**: ⚠️ プレースホルダー（DOM調査待ち）
