# クイックスタートガイド: NotebookLM UI バージョンサポート

**機能**: 008-notebooklm-ui-ui
**日付**: 2025-11-15

このガイドでは、NotebookLM UIバージョンサポート機能の開発を開始するための手順を説明します。

---

## 前提条件

- Node.js 20+ がインストール済み
- プロジェクトのリポジトリをクローン済み
- 旧UI・新UIそれぞれのNotebookLMアカウントへのアクセス
- Chrome DevTools MCP が利用可能（DOM調査用）

---

## 開発環境セットアップ

### 1. 依存関係のインストール

```bash
cd /Users/hirose30/Dropbox/dev/private/notebooklm-sumary-maker-slack-bot
npm install
```

### 2. ブランチの確認

```bash
git branch
# → * 008-notebooklm-ui-ui
```

---

## フェーズ0: DOM調査（最優先）

UIバージョンサポートの実装は、実際のDOMセレクタの調査から始まります。

### 旧UIの調査

#### 手順

1. **旧UIアカウントでログイン**

   ```bash
   # ws1環境を起動（旧UI用）
   npm run bot:start:ws1
   ```

2. **Chrome DevTools MCP を使用して要素を検査**

   以下のツールを使用してDOM調査を実施：

   ```bash
   # Chrome DevTools MCP でブラウザを開く
   # NotebookLM (https://notebooklm.google.com) にアクセス
   # 各UI要素を検査してセレクタを記録
   ```

3. **記録する要素**

   - ログインボタン
   - 新規プロジェクト作成ボタン
   - プロジェクト名入力フィールド
   - ソース追加ボタン
   - URL入力フィールド
   - 保存/確認ボタン
   - ノートブック生成ボタン
   - サマリー表示エリア

4. **セレクタの記録フォーマット**

   `contracts/ui-selectors.md` のプレースホルダーを置き換え：

   ```markdown
   #### [要素名]

   - **CSS セレクタ**: `button.create-project-btn`
   - **Role セレクタ**: `role=button[name="新規プロジェクト"]`
   - **Text セレクタ**: `text="新規プロジェクト"`
   - **アクション**: `click`
   - **期待結果**: 新規プロジェクト作成ダイアログが表示される
   ```

### 新UIの調査

同様の手順を新UIアカウント（ws2）で実施：

```bash
# ws2環境を起動（新UI用）
npm run bot:start:ws2
```

---

## フェーズ1: 実装

DOM調査が完了したら、以下の順序で実装を進めます。

### 実装順序

```
1. 型定義
   ↓
2. セレクタ定義（旧UI・新UI）
   ↓
3. セレクタファクトリ
   ↓
4. 設定ローダー修正
   ↓
5. NotebookLM自動化修正
   ↓
6. エラーハンドリング追加
   ↓
7. テスト作成
```

### 1. 型定義の作成

**ファイル**: `src/models/ui-version.ts`

```typescript
export type UIVersion = 'old' | 'new';

export interface UIVersionConfig {
  workspaceId: string;
  uiVersion: UIVersion;
  source: 'config' | 'default';
}
```

**実装時間**: 15分

### 2. セレクタ定義の作成

#### 2.1 セレクタ型定義

**ファイル**: `src/lib/ui-selectors/types.ts`

```typescript
export type ActionType = 'click' | 'type' | 'wait' | 'waitForSelector';

export interface ActionStep {
  selector: string;
  actionType: ActionType;
  value?: string;
  timeout?: number;
  expectedResult: string;
}

export interface UISelector {
  loginButton: string;
  newProject: string;
  projectNameInput: string;
  addSource: string;
  urlInput: string;
  saveButton: string;
  generateNotebook: string;
  summaryArea: string;
  actions: Record<string, ActionStep[]>;
}
```

**実装時間**: 30分

#### 2.2 旧UIセレクタ実装

**ファイル**: `src/lib/ui-selectors/old-ui.ts`

```typescript
import { UISelector } from './types.js';

export const oldUISelectors: UISelector = {
  loginButton: '[DOM調査結果から転記]',
  newProject: '[DOM調査結果から転記]',
  projectNameInput: '[DOM調査結果から転記]',
  addSource: '[DOM調査結果から転記]',
  urlInput: '[DOM調査結果から転記]',
  saveButton: '[DOM調査結果から転記]',
  generateNotebook: '[DOM調査結果から転記]',
  summaryArea: '[DOM調査結果から転記]',
  actions: {
    uploadURL: [
      {
        selector: '[addSourceボタンのセレクタ]',
        actionType: 'click',
        expectedResult: 'ソース追加ダイアログが表示される'
      },
      // ... 他のステップ
    ]
  }
};
```

**実装時間**: 1時間（DOM調査結果の転記含む）

#### 2.3 新UIセレクタ実装

**ファイル**: `src/lib/ui-selectors/new-ui.ts`

旧UIと同様の構造で実装。

**実装時間**: 1時間

### 3. セレクタファクトリの実装

**ファイル**: `src/services/ui-selector-factory.ts`

```typescript
import { UISelector } from '../lib/ui-selectors/types.js';
import { oldUISelectors } from '../lib/ui-selectors/old-ui.js';
import { newUISelectors } from '../lib/ui-selectors/new-ui.js';
import { UIVersion } from '../models/ui-version.js';

export class UISelectorFactory {
  getSelectors(version: UIVersion): UISelector {
    switch (version) {
      case 'old':
        return oldUISelectors;
      case 'new':
        return newUISelectors;
      default:
        throw new Error(`Unsupported UI version: ${version}`);
    }
  }

  getSupportedVersions(): UIVersion[] {
    return ['old', 'new'];
  }
}
```

**実装時間**: 30分

### 4. 設定ローダーの修正

**ファイル**: `src/lib/config.ts`

```typescript
export const config = {
  // ... 既存の設定
  notebookLMUIVersion: (process.env.NOTEBOOKLM_UI_VERSION as UIVersion | undefined),
};
```

**ファイル**: `src/lib/workspace-loader.ts`

```typescript
import { logger } from './logger.js';
import { config } from './config.js';
import { UIVersion } from '../models/ui-version.js';

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

export function getUIVersion(workspaceId: string): UIVersion {
  return config.notebookLMUIVersion || 'old'; // デフォルトは旧UI
}
```

**実装時間**: 45分

### 5. NotebookLM自動化の修正

**ファイル**: `src/services/notebooklm-automation.ts`

主な変更点：

1. コンストラクタにUIバージョンパラメータ追加
2. セレクタファクトリの統合
3. セレクタ取得メソッドの実装

```typescript
import { UISelectorFactory } from './ui-selector-factory.js';
import { UIVersion } from '../models/ui-version.js';

export class NotebookLMAutomation {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private userDataDir: string;
  private uiVersion: UIVersion;
  private selectorFactory: UISelectorFactory;

  constructor(userDataDir?: string, uiVersion?: UIVersion) {
    this.userDataDir = userDataDir || config.userDataDir;
    this.uiVersion = uiVersion || 'old'; // FR-008: デフォルトは旧UI
    this.selectorFactory = new UISelectorFactory();
  }

  private getSelectors() {
    return this.selectorFactory.getSelectors(this.uiVersion);
  }

  async uploadURL(url: string): Promise<void> {
    const page = this.getPage();
    const selectors = this.getSelectors();

    try {
      // セレクタを使用して操作
      await page.click(selectors.addSource);
      await page.fill(selectors.urlInput, url);
      await page.click(selectors.saveButton);

      logger.info('URL uploaded successfully', {
        url,
        uiVersion: this.uiVersion
      });
    } catch (error) {
      // FR-010, FR-011: Slackユーザーにエラー通知
      logger.error('UI interaction failed', {
        uiVersion: this.uiVersion,
        error: error.message
      });

      throw new Error(
        `UIバージョン '${this.uiVersion}' での操作に失敗しました。` +
        `設定ファイルのNOTEBOOKLM_UI_VERSIONを確認してください。\n` +
        `エラー: ${error.message}`
      );
    }
  }
}
```

**実装時間**: 2時間

### 6. 起動時検証の追加

**ファイル**: `src/index.ts`

```typescript
import { validateUIVersionConfig } from './lib/workspace-loader.js';

async function main() {
  // 起動時にUI設定を検証（FR-007）
  validateUIVersionConfig();

  // ... 既存の起動処理
}
```

**実装時間**: 15分

---

## テスト実行

### ユニットテスト

#### UI Selector Factory のテスト

**ファイル**: `tests/unit/ui-selector-factory.test.ts`

```typescript
import { UISelectorFactory } from '../../src/services/ui-selector-factory';

describe('UISelectorFactory', () => {
  const factory = new UISelectorFactory();

  it('should return old UI selectors for version "old"', () => {
    const selectors = factory.getSelectors('old');
    expect(selectors).toBeDefined();
    expect(selectors.newProject).toBeDefined();
  });

  it('should return new UI selectors for version "new"', () => {
    const selectors = factory.getSelectors('new');
    expect(selectors).toBeDefined();
    expect(selectors.newProject).toBeDefined();
  });

  it('should throw error for unsupported version', () => {
    expect(() => factory.getSelectors('invalid' as any)).toThrow();
  });
});
```

#### 設定検証のテスト

**ファイル**: `tests/unit/ui-version-config.test.ts`

```typescript
import { validateUIVersionConfig } from '../../src/lib/workspace-loader';

describe('validateUIVersionConfig', () => {
  afterEach(() => {
    delete process.env.NOTEBOOKLM_UI_VERSION;
  });

  it('should not throw for valid "old" version', () => {
    process.env.NOTEBOOKLM_UI_VERSION = 'old';
    expect(() => validateUIVersionConfig()).not.toThrow();
  });

  it('should not throw for valid "new" version', () => {
    process.env.NOTEBOOKLM_UI_VERSION = 'new';
    expect(() => validateUIVersionConfig()).not.toThrow();
  });

  it('should exit for invalid version', () => {
    process.env.NOTEBOOKLM_UI_VERSION = 'invalid';
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });

    expect(() => validateUIVersionConfig()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
```

**実行**:

```bash
npm test
```

### 統合テスト

**ファイル**: `tests/integration/ui-version-switching.test.ts`

```typescript
import { NotebookLMAutomation } from '../../src/services/notebooklm-automation';

describe('UI Version Switching Integration', () => {
  it('should use old UI selectors when configured', async () => {
    const automation = new NotebookLMAutomation('./user-data/test-old', 'old');
    await automation.initialize();

    // 旧UIでの操作をテスト
    // ...

    await automation.cleanup();
  });

  it('should use new UI selectors when configured', async () => {
    const automation = new NotebookLMAutomation('./user-data/test-new', 'new');
    await automation.initialize();

    // 新UIでの操作をテスト
    // ...

    await automation.cleanup();
  });
});
```

**実行**:

```bash
npm run test:integration -- ui-version-switching.test.ts
```

---

## 設定例

### ワークスペース1 (旧UI)

`.env.ws1`:
```bash
# ... 既存の設定

# UIバージョン設定
NOTEBOOKLM_UI_VERSION=old
```

### ワークスペース2 (新UI)

`.env.ws2`:
```bash
# ... 既存の設定

# UIバージョン設定
NOTEBOOKLM_UI_VERSION=new
```

---

## 動作確認

### 1. 旧UIワークスペースでの動作確認

```bash
# ws1環境で起動
npm run bot:start:ws1

# Slackで URL を投稿して動作確認
# → 旧UIセレクタを使用してサマリーが生成されるはず
```

### 2. 新UIワークスペースでの動作確認

```bash
# ws2環境で起動
npm run bot:start:ws2

# Slackで URL を投稿して動作確認
# → 新UIセレクタを使用してサマリーが生成されるはず
```

### 3. UIバージョン不一致のエラー確認

```bash
# ws1（旧UIアカウント）で新UI設定を試す
# .env.ws1 で NOTEBOOKLM_UI_VERSION=new に変更
npm run bot:start:ws1

# Slackで URL を投稿
# → FR-010, FR-011: エラーメッセージが Slack に表示されるはず
# 「UIバージョン 'new' での操作に失敗しました。設定ファイルのNOTEBOOKLM_UI_VERSIONを確認してください。」
```

### 4. 設定ファイル検証のエラー確認

```bash
# 不正な設定値を設定
# .env.ws1 で NOTEBOOKLM_UI_VERSION=invalid に変更
npm run bot:start:ws1

# → FR-007: bot が起動を拒否し、エラーログを出力するはず
# process.exit(1) で終了
```

---

## トラブルシューティング

### Q: DOM調査でセレクタが見つからない

**A**: 以下を確認：
- ページが完全にロードされているか
- ログイン状態が維持されているか
- Chrome DevTools の要素検査で role, aria-label などの属性を確認

### Q: ユニットテストが失敗する

**A**:
- セレクタ定義ファイル (`old-ui.ts`, `new-ui.ts`) がインポート可能か確認
- TypeScript のビルドエラーがないか確認: `npm run build`

### Q: 統合テストでPlaywrightがタイムアウト

**A**:
- セレクタが実際のUIと一致しているか確認
- タイムアウト時間を延長: `timeout: 60000`
- ヘッドレスモードを無効化してデバッグ: `PLAYWRIGHT_HEADLESS=false`

---

## 次のステップ

実装が完了したら、以下を実施：

1. `/speckit.tasks` コマンドで詳細なタスク分解
2. 各タスクの実装とテスト
3. PR作成前のチェックリスト確認:
   - すべてのテストが通過
   - UIバージョン切り替えが両方向で動作
   - エラーハンドリングが正しく機能
   - ドキュメント（DOM調査結果）が完全

---

**作成日時**: 2025-11-15
**対象者**: 開発者
**前提知識**: TypeScript, Playwright, Slack Bot 開発
