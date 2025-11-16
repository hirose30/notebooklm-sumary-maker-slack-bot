/**
 * 旧UI (Old UI) セレクタ定義
 *
 * ✅ 実際のDOM調査結果に基づくセレクタ
 *
 * 調査元: 既存の動作中のnotebooklm-automation.tsから抽出
 * 環境: ws2（旧UI環境）
 * 調査日: 2025-11-15
 */

import type { UISelector, ActionStep } from './types.js';

/**
 * 旧UI用のセレクタセット
 *
 * NOTE: これらのセレクタは既存の実装から抽出した実際に動作しているセレクタです
 */
export const oldUISelectors: UISelector = {
  // ログイン・初期画面
  loginButton: 'button[aria-label="ログイン"]', // Google認証ボタン

  // プロジェクト操作
  newProject: 'button[aria-label="ノートブックを新規作成"]', // 新規ノートブック作成ボタン
  projectNameInput: 'input[placeholder="ノートブック名"]', // プロジェクト名入力（推定）

  // コンテンツソース追加
  addSource: 'text="ウェブサイト"', // ソース追加ダイアログの「ウェブサイト」オプション
  urlInput: 'textarea.mat-mdc-input-element', // URL入力テキストエリア（Material Design）
  saveButton: 'button:has-text("挿入")', // 挿入ボタン

  // ノートブック生成
  generateNotebook: 'div.blue.create-artifact-button-container:has-text("音声解説")', // 音声解説生成ボタン
  summaryArea: 'text="1 ソース"', // ソース追加完了の確認用（実際のサマリーエリアは別）

  // アクションフロー定義
  actions: {
    /**
     * URL追加からサマリー生成までの完全フロー
     *
     * 既存の実装から抽出した実際の操作手順
     */
    uploadURL: [
      {
        selector: 'text="ウェブサイト"',
        actionType: 'click',
        expectedResult: 'ソース追加ダイアログで「ウェブサイト」オプションが選択される',
      },
      {
        selector: 'textarea.mat-mdc-input-element',
        actionType: 'type',
        value: '{url}', // 実行時に実際のURLに置換
        expectedResult: 'URLが入力される',
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
