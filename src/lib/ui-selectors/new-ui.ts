/**
 * 新UI (New UI) セレクタ定義
 *
 * ✅ 実際のDOM調査結果に基づくセレクタ
 *
 * 調査元: Chrome DevTools MCPでの実際のDOM検査
 * 環境: 新UI環境
 * 調査日: 2025-11-16
 *
 * 重要: 新UIには2つのテキストエリアが存在します
 * - textarea.mat-mdc-input-element.query-box-textarea (ノートブック画面の検索ボックス)
 * - textarea[formcontrolname="newUrl"] (URL入力モーダル内のフィールド) ← 正しい入力先
 *
 * NOTE: クラス名だけでは2つのtextareaを区別できないため、formcontrolname属性を使用して特定
 */

import type { UISelector, ActionStep } from './types.js';

/**
 * 新UI用のセレクタセット
 *
 * NOTE: これらのセレクタは実際のDOM調査で確認された値です。
 * 新UIでは、URL入力フィールドを特定するために .text-area クラスを使用します。
 */
export const newUISelectors: UISelector = {
  // ログイン・初期画面
  loginButton: 'button[aria-label="ログイン"]', // Google認証ボタン

  // プロジェクト操作
  newProject: 'button[aria-label="ノートブックを新規作成"]', // 新規ノートブック作成ボタン（Chrome DevTools MCPで確認済み）
  projectNameInput: 'input[placeholder="ノートブック名"]', // プロジェクト名入力

  // コンテンツソース追加
  addSource: 'text="ウェブサイト"', // ソース追加ダイアログの「ウェブサイト」オプション（確認済み）
  urlInput: 'textarea[formcontrolname="newUrl"]', // URL入力テキストエリア（新UI専用セレクタ、formcontrolname属性で特定、2025-11-16確認）
  saveButton: 'button:has-text("挿入")', // 挿入ボタン（確認済み）

  // ノートブック生成
  generateNotebook: 'div.blue.create-artifact-button-container:has-text("音声解説")', // 音声解説生成ボタン（確認済み）
  summaryArea: 'text="1 ソース"', // ソース追加完了の確認用

  // インフォグラフィック (2025-11-22 Chrome DevTools MCP検証済み)
  generateInfographic: 'div.pink.create-artifact-button-container:has-text("インフォグラフィック")', // インフォグラフィック生成ボタン（音声/動画と同じパターン）

  // アクションフロー定義
  actions: {
    /**
     * URL追加からサマリー生成までの完全フロー（新UI）
     *
     * NOTE: 新UIでは formcontrolname="newUrl" 属性を使用してURL入力フィールドを特定
     * 実際のDOM調査で確認済み（2025-11-16 新UI環境）
     * 検索ボックス (query-box-textarea) と区別するため、formcontrolname属性で特定
     */
    uploadURL: [
      {
        selector: 'text="ウェブサイト"',
        actionType: 'click',
        expectedResult: 'ソース追加ダイアログで「ウェブサイト」オプションが選択される',
      },
      {
        selector: 'textarea[formcontrolname="newUrl"]',
        actionType: 'type',
        value: '{url}', // 実行時に実際のURLに置換
        expectedResult: 'URLが入力される（モーダル上部の正しい入力フィールド）',
      },
      {
        selector: 'button:has-text("挿入")',
        actionType: 'click',
        expectedResult: 'ソースが追加され、ダイアログが閉じる',
      },
      {
        selector: 'text="1 ソース"',
        actionType: 'waitForSelector',
        timeout: 60000, // 60秒
        expectedResult: 'ソースが正常に追加されたことが確認される',
      },
    ] as ActionStep[],
  },
};
