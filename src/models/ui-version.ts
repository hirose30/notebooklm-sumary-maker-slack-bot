/**
 * UIバージョン型定義
 * NotebookLMの旧UI・新UIを識別するための型
 */
export type UIVersion = 'old' | 'new';

/**
 * UIバージョン設定インターフェース
 * ワークスペースごとのUIバージョン設定を表現
 */
export interface UIVersionConfig {
  /** ワークスペース識別子（例: "ws1", "ws2"） */
  workspaceId: string;

  /** 使用するUIバージョン */
  uiVersion: UIVersion;

  /** 設定の取得元 */
  source: 'config' | 'default';
}
