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
 * インフォグラフィック検出結果
 */
export interface InfographicResult {
  /** インフォグラフィックが検出されたか */
  detected: boolean;

  /** ファイルサイズ（バイト） */
  fileSize?: number;

  /** MIMEタイプ */
  mimeType?: string;

  /** 検出されたインフォグラフィック数 */
  count?: number;
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

  /** インフォグラフィック生成ボタン */
  generateInfographic?: string;

  /** アクションフロー（操作手順のマップ） */
  actions: Record<string, ActionStep[]>;
}
