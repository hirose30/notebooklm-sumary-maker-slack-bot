# NotebookLM Slack Bot

Slack で URL をメンションするだけで、NotebookLM Pro が自動的に音声解説と動画解説を生成し、結果を返してくれるボットです。

## ✨ 機能

- 🤖 **自動処理**: Slack で URL をメンションするだけ
- 🎵 **音声解説**: NotebookLM Pro の AI ポッドキャスト生成
- 🎬 **動画解説**: AI による解説動画作成
- ⚡ **並列生成**: 音声と動画を同時生成（約10-16分）
- ☁️ **クラウドストレージ**: Cloudflare R2 に自動アップロード
- 🔐 **7日間有効**: 署名付き URL で安全に共有
- 🧵 **スレッド対応**: 親投稿の URL を自動抽出（返信でメンションOK）
- 🔗 **見やすいリンク**: 絵文字とファイルサイズ付きフォーマット
- ⚠️ **エラー通知**: 処理失敗時も Slack に通知、次のリクエストは継続

## 🚀 クイックスタート

### 1. インストール

```bash
git clone <repository-url>
cd notebooklm-sumary-maker-slack-bot
npm install
npx playwright install chromium
```

### 2. 環境設定

```bash
cp .env.example .env
# .env ファイルを編集して各種トークンを設定
```

必要な設定:
- Slack Bot Token (`SLACK_BOT_TOKEN`)
- Slack App Token (`SLACK_APP_TOKEN`)
- Cloudflare R2 認証情報
- NotebookLM 認証（初回のみブラウザでログイン）

詳細は [セットアップガイド](./docs/setup-guide.md) を参照してください。

### 3. NotebookLM 認証

```bash
# ブラウザが開くので、Google アカウントでログイン
PLAYWRIGHT_HEADLESS=false npx tsx scripts/test-notebooklm.ts
```

### 4. ボット起動

```bash
npm run bot:start
```

### 5. Slack で使う

1. チャンネルにボットを招待:
   ```
   /invite @NotebookLM Bot
   ```

2. URL を含めてメンション:
   ```
   @NotebookLM Bot https://zenn.dev/example/articles/12345
   ```

   または、スレッド返信でメンション（親投稿のURLを自動抽出）:
   ```
   親投稿: この記事面白い https://zenn.dev/example/articles/12345
   返信: @NotebookLM Bot 要約して
   ```

3. 処理完了を待つ（約10-16分）

4. スレッドに結果が投稿される！
   ```
   ✅ 処理が完了しました！

   🎵 音声要約 (34.38 MB)
   🎬 動画要約 (42.15 MB)

   ⏰ リンクは7日間有効です
   ```

## 📖 ドキュメント

- [セットアップガイド](./docs/setup-guide.md) - 詳細な設定手順
- [NotebookLM 自動化](./docs/notebooklm-automation.md) - 技術詳細

## 🧪 テスト

```bash
# NotebookLM 自動化テスト
TEST_URL=https://example.com npm run test:notebooklm

# Slack 接続テスト
npm run test:slack

# E2E テスト（完全なフロー）
TEST_URL=https://example.com npm run test:e2e
```

## 🏗️ アーキテクチャ

```
Slack メンション
    ↓
SQLite キュー (pending)
    ↓
NotebookLM 自動化
    ├─ 音声解説生成 (並列)
    └─ 動画解説生成 (並列)
    ↓
Cloudflare R2 アップロード
    ↓
Slack スレッドに結果投稿
```

## 🛠️ 技術スタック

- **Node.js 20+** / TypeScript 5.x
- **@slack/bolt** - Slack Bot フレームワーク
- **Playwright** - ブラウザ自動化（NotebookLM UI 操作）
- **SQLite** - リクエストキュー管理
- **Cloudflare R2** - メディアファイルストレージ
- **AWS SDK v3** - R2 アップロード

## 📊 処理時間

| ステップ | 所要時間 |
|---------|---------|
| ノートブック作成 | 〜3秒 |
| URL ソース追加 | 〜10秒 |
| 音声・動画生成 | **10-16分**（並列） |
| R2 アップロード | 〜10秒 |
| **合計** | **約10-16分** |

## 🔒 セキュリティ

- ✅ 環境変数で認証情報を管理
- ✅ `.env` と `user-data/` は Git 管理外
- ✅ R2 署名付き URL（7日間有効）
- ✅ Slack Socket Mode（Webhook 不要）

## 📝 制限事項

- **シリアル処理**: 同時に1件のみ処理（NotebookLM Pro アカウント制限）
- **処理時間**: 1件あたり10-16分
- **リンク有効期限**: 7日間

## ✅ 最新の改善 (v0.2.0)

- ✅ **エラー通知**: 処理エラー時に Slack スレッドに通知、キューは継続処理
- ✅ **スレッド URL 抽出**: 親投稿の URL を自動検出、返信でメンションOK
- ✅ **フォーマット済みリンク**: 見やすい絵文字 + ファイルサイズ表示

## 🚧 今後の改善

- [ ] 進捗通知（30秒ごとに更新）
- [ ] エラー時のリトライ機能強化
- [ ] ダッシュボード（処理状況の可視化）
- [ ] 動画サムネイル（Slack での展開表示）

## 📄 ライセンス

MIT

## 🤝 コントリビューション

Issue や Pull Request をお待ちしています！

---

**Made with ❤️ using Claude Code**
