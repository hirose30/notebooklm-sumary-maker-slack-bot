/**
 * UI操作のアクションタイプ
 */
export type ActionType = 'click' | 'type' | 'wait' | 'waitForSelector';

/**
 * UI操作の詳細手順
 */
export interface ActionStep {
  /** 対象要素のセレクタ */
  selector: string;

  /** 実行するアクションの種類 */
  actionType: ActionType;

  /** 入力値（typeの場合のみ必須） */
  value?: string;

  /** タイムアウト（ミリ秒、wait系のみ） */
  timeout?: number;

  /** 期待される結果の説明 */
  expectedResult: string;
}

/**
 * UIバージョン別のセレクタセット
 * NotebookLMの各UI要素に対応するセレクタを定義
 */
export interface UISelector {
  /** ログインボタン */
  loginButton: string;

  /** 新規プロジェクト作成ボタン */
  newProject: string;

  /** プロジェクト名入力フィールド */
  projectNameInput: string;

  /** コンテンツソース追加ボタン */
  addSource: string;

  /** URL入力フィールド */
  urlInput: string;

  /** 保存/確認ボタン */
  saveButton: string;

  /** ノートブック生成ボタン */
  generateNotebook: string;

  /** サマリー表示エリア */
  summaryArea: string;

  /** アクションフロー（操作手順のマップ） */
  actions: Record<string, ActionStep[]>;
}
