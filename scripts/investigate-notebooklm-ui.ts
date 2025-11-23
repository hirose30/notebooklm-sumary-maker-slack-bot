/**
 * NotebookLM UI Investigation Script
 *
 * このスクリプトはChrome DevTools MCPと組み合わせて使用し、
 * NotebookLMの旧UI・新UIの要素を調査するための補助ツールです。
 *
 * 使用方法:
 * 1. Chrome DevTools MCPでNotebookLMを開く
 * 2. このスクリプトを参照しながら、各UI要素を手動で検査
 * 3. 結果をcontracts/ui-selectors.mdに記録
 */

/**
 * 調査対象の要素リスト
 */
export const ELEMENTS_TO_INVESTIGATE = {
  // ログイン・初期画面
  loginButton: {
    name: 'ログインボタン',
    description: 'Googleアカウントでログインするボタン',
    expectedAction: 'click',
    expectedResult: 'ログインダイアログが表示される',
  },

  // プロジェクト操作
  newProject: {
    name: '新規プロジェクト作成ボタン',
    description: '新しいプロジェクトを作成するボタン',
    expectedAction: 'click',
    expectedResult: '新規プロジェクト作成ダイアログが表示される',
  },

  projectNameInput: {
    name: 'プロジェクト名入力フィールド',
    description: 'プロジェクト名を入力するテキストフィールド',
    expectedAction: 'type',
    expectedResult: 'プロジェクト名が入力される',
  },

  // コンテンツソース追加
  addSource: {
    name: 'ソース追加ボタン',
    description: 'コンテンツソースを追加するボタン',
    expectedAction: 'click',
    expectedResult: 'ソース追加ダイアログが表示される',
  },

  urlInput: {
    name: 'URL入力フィールド',
    description: 'WebページのURLを入力するフィールド',
    expectedAction: 'type',
    expectedResult: 'URLが入力される',
  },

  saveButton: {
    name: '保存/確認ボタン',
    description: 'ソース追加を確定するボタン',
    expectedAction: 'click',
    expectedResult: 'ソースが追加され、ダイアログが閉じる',
  },

  // ノートブック生成
  generateNotebook: {
    name: 'ノートブック生成ボタン',
    description: 'サマリーを生成するボタン',
    expectedAction: 'click',
    expectedResult: 'ノートブック生成が開始される',
  },

  summaryArea: {
    name: 'サマリー表示エリア',
    description: '生成されたサマリーが表示される領域',
    expectedAction: 'waitForSelector',
    expectedResult: 'サマリーが表示される',
  },
} as const;

/**
 * セレクタ記録用のテンプレート
 *
 * 各要素について以下の情報を記録してください:
 *
 * ### [要素名]
 *
 * - **CSS セレクタ**: `[Chrome DevToolsでコピーしたセレクタ]`
 * - **Role セレクタ**: `role=button[name="ボタン名"]` (優先)
 * - **Text セレクタ**: `text="表示テキスト"`
 * - **アクション**: `click` | `type` | `wait` | `waitForSelector`
 * - **期待結果**: [アクション実行後の期待される状態]
 *
 * 優先順位: Role-based > Text-based > CSS
 */

/**
 * DOM調査手順
 */
export const INVESTIGATION_STEPS = [
  {
    step: 1,
    title: '環境準備',
    actions: [
      'Chrome DevTools MCPでブラウザを起動',
      'NotebookLM (https://notebooklm.google.com) にアクセス',
      'ログイン状態を確認',
    ],
  },
  {
    step: 2,
    title: '要素の特定',
    actions: [
      'ELEMENTS_TO_INVESTIGATEの各要素について:',
      '  1. Chrome DevToolsで要素を検査',
      '  2. role属性、aria-label、data属性を確認',
      '  3. 可能な限りrole-based selectorを優先',
      '  4. フォールバックとしてCSS selectorを記録',
    ],
  },
  {
    step: 3,
    title: 'セレクタの記録',
    actions: [
      'contracts/ui-selectors.mdのプレースホルダーを置き換え',
      '各セレクタの優先順位を明記',
      '期待される結果を詳細に記述',
    ],
  },
  {
    step: 4,
    title: '検証',
    actions: [
      'Chrome DevTools ConsoleでPlaywrightセレクタをテスト',
      '例: document.querySelector(\'[セレクタ]\')',
      '要素が一意に特定できることを確認',
    ],
  },
] as const;

/**
 * セレクタの優先順位ガイド
 */
export const SELECTOR_PRIORITY_GUIDE = {
  highest: {
    type: 'Role-based selector',
    example: 'role=button[name="保存"]',
    reason: 'アクセシビリティ属性ベースで堅牢、UIの構造変更に強い',
    playwrightSyntax: 'page.getByRole("button", { name: "保存" })',
  },
  medium: {
    type: 'Text-based selector',
    example: 'text="保存"',
    reason: 'シンプルで読みやすい、テキスト変更に注意',
    playwrightSyntax: 'page.getByText("保存")',
  },
  lowest: {
    type: 'CSS selector',
    example: 'button.save-btn',
    reason: 'UIの構造変更に脆弱、最終手段として使用',
    playwrightSyntax: 'page.locator("button.save-btn")',
  },
} as const;

/**
 * 注意事項
 */
export const NOTES = [
  '旧UI (ws2) と新UI (ws1) で同じ要素を調査すること',
  'セレクタは可能な限り簡潔に保つ',
  '動的に生成されるIDやクラス名は避ける',
  'データ属性 (data-*) があれば積極的に利用',
  '複数の候補がある場合は、すべてのセレクタを記録',
] as const;

// このスクリプトは実行されることを想定していません
// Chrome DevTools MCPでの手動調査のためのガイドです
console.log('This script is a guide for manual DOM investigation.');
console.log('Use Chrome DevTools MCP to inspect NotebookLM UI elements.');
console.log('Record findings in: specs/008-notebooklm-ui-ui/contracts/ui-selectors.md');
