# リサーチ結果: NotebookLM UI バージョンサポート

**機能**: 008-notebooklm-ui-ui
**日付**: 2025-11-15

## 1. NotebookLM UI DOM構造調査

### 決定

旧UI・新UIの両方に対応するため、以下のアプローチを採用：
- Chrome DevToolsのMCP連携を活用し、実際のDOMを直接調査
- 各UI要素のCSS セレクタ、role属性、テキスト内容を記録
- インタラクション手順を詳細にドキュメント化（selector + action + expected result形式）

### 根拠

- 仕様書のFR-012が詳細なドキュメント化（element name, CSS selector, action type, expected result）を要求
- Chrome DevTools MCPを使用することで、実際のブラウザ環境での要素特定が可能
- PlaywrightのセレクタはCSSセレクタとrole-based selectorsの両方をサポート
  - `role=button[name="Upload"]` のような形式が推奨（よりロバスト）
  - CSSセレクタはフォールバックとして使用

### 調査プロセス

1. **旧UIの調査**:
   - ws1環境（旧UIアカウント）でNotebookLMにアクセス
   - Chrome DevTools MCPで各要素を検査
   - 以下の要素を特定:
     - 新規プロジェクト作成ボタン
     - コンテンツソース追加ボタン
     - URL入力フィールド
     - 保存/確認ボタン
     - ノートブック生成ボタン
     - サマリー表示エリア

2. **新UIの調査**:
   - ws2環境（新UIアカウント）で同様の手順
   - UIの構造変更点を記録
   - 新UIで追加/削除された要素を特定

3. **ドキュメント化**:
   - `contracts/ui-selectors.md` に調査結果を記録
   - セレクタの優先順位: role-based > text-based > CSS selector

### 代替案と却下理由

- **代替案1**: スクリーンショットベースのE2Eテスト
  - 却下理由: UIの小さな変更で誤検知、メンテナンスコストが高い

- **代替案2**: 自動セレクタ生成ツール
  - 却下理由: 生成されたセレクタが脆弱、人間の検証が必要

---

## 2. TypeScript型安全なセレクタパターン調査

### 決定

以下の設計パターンを採用：

```typescript
// types.ts - セレクタインターフェース定義
export interface UISelector {
  newProject: string;
  addSource: string;
  urlInput: string;
  saveButton: string;
  generateNotebook: string;
  summaryArea: string;
}

export interface ActionStep {
  selector: string;
  actionType: 'click' | 'type' | 'wait' | 'waitForSelector';
  value?: string;
  timeout?: number;
  expectedResult: string;
}

// Factory Pattern
export class UISelectorFactory {
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
}
```

### 根拠

- **型安全性**: TypeScriptのインターフェースでセレクタ構造を強制
- **拡張性**: 新しいUI要素の追加が容易
- **テスタビリティ**: モックが容易、ユニットテストで各バージョンを個別検証可能
- **明確性**: Factory Patternによりバージョン切り替えロジックが一箇所に集約

### 既存コードベースとの統合

既存の `NotebookLMAutomation` クラスに以下の修正を加える：

```typescript
export class NotebookLMAutomation {
  private selectorFactory: UISelectorFactory;
  private uiVersion: 'old' | 'new';

  constructor(userDataDir?: string, uiVersion?: 'old' | 'new') {
    this.uiVersion = uiVersion || 'old'; // デフォルトは旧UI
    this.selectorFactory = new UISelectorFactory();
  }

  private getSelector(name: keyof UISelector): string {
    const selectors = this.selectorFactory.getSelectors(this.uiVersion);
    return selectors[name];
  }
}
```

### 代替案と却下理由

- **代替案1**: 条件分岐での直接セレクタ指定
  - 却下理由: コード全体に `if (uiVersion === 'old')` が散在、メンテナンス困難

- **代替案2**: JSONファイルでのセレクタ管理
  - 却下理由: 型安全性の喪失、IDEの補完が効かない

---

## 3. 設定ファイルバリデーション手法

### 決定

既存の環境変数ベースの設定に `NOTEBOOKLM_UI_VERSION` を追加し、起動時に検証：

```typescript
// lib/config.ts に追加
export const config = {
  // ... 既存の設定
  notebookLMUIVersion: process.env.NOTEBOOKLM_UI_VERSION as 'old' | 'new' | undefined,
};

// lib/workspace-loader.ts に検証ロジック追加
export function validateUIVersionConfig(): void {
  const version = config.notebookLMUIVersion;

  if (version && version !== 'old' && version !== 'new') {
    logger.error('Invalid NOTEBOOKLM_UI_VERSION in config', { version });
    process.exit(1); // FR-007: 不正な設定で起動拒否
  }

  logger.info('UI version config validated', {
    version: version || 'old (default)',
    source: version ? 'explicit' : 'default',
  });
}
```

### 根拠

- **既存パターンとの一貫性**: プロジェクトは環境変数ベースの設定を使用
- **ワークスペース分離**: 各ワークスペースは独立した`.env.ws1`, `.env.ws2` ファイルを持つ
- **起動時検証**: FR-007の要求（不正な設定で起動拒否）を満たす
- **シンプル**: 追加のライブラリ不要、既存の `config.ts` パターンを拡張

### スキーマ検証ライブラリの評価

| ライブラリ | メリット | デメリット | 判定 |
|----------|---------|-----------|------|
| Zod | TypeScript統合、推論型 | 追加依存 | 却下 |
| Joi | 成熟、豊富な機能 | 重い、TypeScript統合弱い | 却下 |
| 手動検証 | 依存なし、シンプル | 列挙型の検証は手動 | **採用** |

### 代替案と却下理由

- **代替案1**: 専用の設定ファイル（YAML/JSON）
  - 却下理由: 既存の環境変数パターンと不整合、複雑化

- **代替案2**: データベースに設定を保存
  - 却下理由: FR-004が「設定ファイルのみでの変更」を要求、オーバースペック

---

## 4. Playwright コンテキスト分離ベストプラクティス

### 決定

既存の `NotebookLMAutomation` クラスの設計を維持：
- 各ワークスペースは独立した `BrowserContext` インスタンスを持つ
- `launchPersistentContext()` でワークスペース別の `userDataDir` を使用
- AsyncLocalStorageで現在のワークスペースコンテキストを管理

### 根拠

- **既存の実装**: プロジェクトは既にワークスペース別のブラウザコンテキストを使用
- **Playwrightの保証**: 異なる `BrowserContext` 間は完全に分離
  - クッキー、ストレージ、セッションが独立
  - 並行処理時も相互干渉なし
- **FR-006**: 「separate browser instances/Playwright contexts per workspace」要求を満たす

### コード確認

既存の `NotebookLMAutomation`:
```typescript
constructor(userDataDir?: string) {
  this.userDataDir = userDataDir || config.userDataDir;
}

async initialize(): Promise<void> {
  this.context = await chromium.launchPersistentContext(this.userDataDir, {
    // ... オプション
  });
}
```

各ワークスペースの起動スクリプト（`scripts/start-ws1.sh`, `start-ws2.sh`）は独立した `userDataDir` を指定：
- ws1: `./user-data/ws1`
- ws2: `./user-data/ws2`

### 修正点

UIバージョンをコンストラクタで受け取るように拡張：

```typescript
constructor(userDataDir?: string, uiVersion?: 'old' | 'new') {
  this.userDataDir = userDataDir || config.userDataDir;
  this.uiVersion = uiVersion || 'old'; // デフォルトは旧UI
}
```

### パフォーマンス影響

- **メモリ**: ブラウザコンテキストあたり約100-200MB（既存と変わらず）
- **並行処理**: Node.jsのイベントループで効率的に処理、UIバージョン違いによる影響なし
- **起動時間**: UIバージョン検証は同期処理、影響は数ミリ秒未満

### 代替案と却下理由

- **代替案1**: 単一BrowserContextで複数ページ
  - 却下理由: セッション分離が不十分、既存設計との不整合

- **代替案2**: Worker Threadsでの分離
  - 却下理由: オーバーエンジニアリング、Playwrightのコンテキスト分離で十分

---

## まとめ

### 技術決定の全体像

| 項目 | 決定 | 主な根拠 |
|-----|------|---------|
| DOM調査手法 | Chrome DevTools MCP + role-based selectors | 実環境での検証、堅牢性 |
| セレクタパターン | TypeScript Factory Pattern | 型安全性、拡張性 |
| 設定検証 | 環境変数 + 起動時検証 | 既存パターンとの一貫性 |
| コンテキスト分離 | ワークスペース別BrowserContext | 既存実装、Playwrightの保証 |

### 次のステップ

1. DOM調査の実施（User Story 4: P3）
2. `contracts/ui-selectors.md` へのセレクタ記録
3. 型定義とセレクタ実装
4. 統合テストでの検証

---

**作成日時**: 2025-11-15
**次の成果物**: `data-model.md`, `contracts/ui-selectors.md`, `quickstart.md`
