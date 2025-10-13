# NotebookLM Slack Bot セットアップガイド

このガイドでは、Slack Botのセットアップから運用開始までの手順を説明します。

## 目次

1. [Slack App の作成](#1-slack-app-の作成)
2. [環境変数の設定](#2-環境変数の設定)
3. [Cloudflare R2 の設定](#3-cloudflare-r2-の設定)
4. [NotebookLM の認証](#4-notebooklm-の認証)
5. [ボットの起動](#5-ボットの起動)
6. [運用方法](#6-運用方法)

---

## 1. Slack App の作成

### ステップ 1.1: Slack App を作成

1. https://api.slack.com/apps にアクセス
2. **"Create New App"** をクリック
3. **"From scratch"** を選択
4. アプリ名を入力（例: `NotebookLM Bot`）
5. ワークスペースを選択して **"Create App"**

### ステップ 1.2: Bot Token Scopes を設定

1. 左メニューから **"OAuth & Permissions"** を選択
2. **"Scopes"** セクションの **"Bot Token Scopes"** に以下を追加:
   - `app_mentions:read` - メンションを読む
   - `chat:write` - メッセージを投稿
   - `channels:history` - チャンネル履歴を読む
   - `groups:history` - プライベートチャンネル履歴を読む
   - `im:history` - DMを読む

### ステップ 1.3: Event Subscriptions を有効化

1. 左メニューから **"Event Subscriptions"** を選択
2. **"Enable Events"** をオンにする
3. **"Subscribe to bot events"** で以下を追加:
   - `app_mention` - ボットがメンションされた時

### ステップ 1.4: Socket Mode を有効化

1. 左メニューから **"Socket Mode"** を選択
2. **"Enable Socket Mode"** をオンにする
3. トークン名を入力（例: `socket-token`）
4. **App-Level Token** (`xapp-...`) が生成される → **コピー**

### ステップ 1.5: Bot をインストール

1. 左メニューから **"Install App"** を選択
2. **"Install to Workspace"** をクリック
3. 権限を確認して **"Allow"**
4. **Bot User OAuth Token** (`xoxb-...`) が表示される → **コピー**

### ステップ 1.6: Signing Secret を取得

1. 左メニューから **"Basic Information"** を選択
2. **"App Credentials"** セクションの **"Signing Secret"** → **Show** → **コピー**

---

## アーキテクチャについて: Socket Mode とは？

### なぜ公開エンドポイントが不要なのか

このボットは **Slack Socket Mode** を使用しているため、**公開されたWebhook URLは一切不要**です。

### Socket Mode vs 従来のHTTPモード

#### 従来のHTTPモード（このプロジェトでは不使用）
```
Slack → インターネット → 公開Webhook URL → あなたのサーバー
```
- 公開されたHTTPSエンドポイントが必須
- ngrok、Heroku、AWS等のホスティングが必要
- ファイアウォール設定が複雑

#### Socket Mode（このプロジェクトで採用）
```
あなたのサーバー → WebSocket接続 → Slack
```
- **WebSocketでSlackに接続**（ボット側から接続を開始）
- **ローカル開発マシンで動作可能**
- 公開エンドポイント不要
- ファイアウォール越しでも動作

### コード内での設定箇所

[src/services/slack-bot.ts:35-40](src/services/slack-bot.ts#L35-L40) で Socket Mode を有効化:

```typescript
this.app = new App({
  token: config.slackBotToken,        // Bot User OAuth Token
  appToken: config.slackAppToken,     // App-Level Token（Socket Mode用）
  socketMode: true,                    // ← これで WebSocket 接続が有効化
  logLevel: LogLevel.INFO,
});
```

### 実行環境の選択肢

#### ✅ ローカル開発マシン（推奨）
```bash
npm run bot:start
```
- そのまま動作（公開不要）
- 開発・デバッグが簡単
- インターネット接続さえあればOK

#### ✅ 自宅サーバー / ラズベリーパイ
```bash
pm2 start npm --name "notebooklm-bot" -- run bot:start
```
- 常時稼働が可能
- 公開IP不要（Socket Modeなので）

#### ✅ クラウドサーバー（EC2, VPS等）
```bash
systemctl start notebooklm-bot
```
- より安定した稼働
- Socket Mode なので Webhook URL設定は不要

#### ❌ サーバーレス（Lambda等）は不向き
- Socket Mode は**常時接続**が必要
- サーバーレスは短時間実行向け
- NotebookLM処理も10-16分かかるため不適

### Socket Mode の仕組み

1. **起動時**: ボットが Slack に WebSocket 接続
   ```
   [Your Bot] --WebSocket--> [Slack API]
   ```

2. **イベント受信**: Slack がメンションを検知
   ```
   User mentions bot in Slack
   ↓
   Slack pushes event via WebSocket
   ↓
   Your bot receives event
   ```

3. **応答送信**: ボットが WebSocket 経由で返信
   ```
   [Your Bot] --Response via WebSocket--> [Slack API]
   ```

### 必要なトークンの違い

| トークンタイプ | 用途 | 取得場所 |
|--------------|------|---------|
| **Bot User OAuth Token** (`xoxb-...`) | メッセージ送信、権限 | OAuth & Permissions |
| **App-Level Token** (`xapp-...`) | Socket Mode接続 | Socket Mode設定 |
| **Signing Secret** | リクエスト検証（保険） | Basic Information |

### よくある質問

**Q: ローカルPCの電源を切ったらどうなる？**
A: ボットが停止します。常時稼働させたい場合は、サーバーまたは常時稼働PCで実行してください。

**Q: ngrok や localtunnel は必要？**
A: **不要です**。Socket Mode は WebSocket で接続するため、公開URLは一切不要です。

**Q: ファイアウォール越しでも動作する？**
A: はい。ボット側から **アウトバウンド** で WebSocket 接続するため、通常のファイアウォール環境で動作します。

**Q: Heroku や Render.com にデプロイできる？**
A: 可能ですが、Socket Mode なら**ローカルマシンで十分**です。クラウド費用は不要です。

**Q: Request URL の設定はどこ？**
A: Socket Mode では **Request URL の設定は不要** です。従来の HTTP モードでのみ必要な設定です。

---

## 2. 環境変数の設定

### ステップ 2.1: .env ファイルを作成

プロジェクトルートに `.env` ファイルを作成:

```bash
cp .env.example .env
```

### ステップ 2.2: Slack の認証情報を設定

`.env` ファイルを編集:

```bash
# Slack Settings
SLACK_BOT_TOKEN=xoxb-your-bot-token-here        # ステップ 1.5 でコピーしたトークン
SLACK_APP_TOKEN=xapp-your-app-token-here        # ステップ 1.4 でコピーしたトークン
SLACK_SIGNING_SECRET=your-signing-secret-here   # ステップ 1.6 でコピーしたシークレット
```

---

## 3. Cloudflare R2 の設定

### ステップ 3.1: R2 バケットを作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. 左メニューから **R2** を選択
3. **"Create bucket"** をクリック
4. バケット名を入力（例: `notebooklm-media`）
5. リージョンを選択（例: `APAC`）
6. **"Create bucket"**

### ステップ 3.2: R2 API トークンを作成

**重要**: **R2 Token（バケット単位のトークン）** を作成してください。Account API Tokenではありません。

#### R2 Token vs Account API Token の違い

| トークンタイプ | 推奨度 | 権限範囲 | セキュリティ |
|--------------|-------|---------|------------|
| **R2 Token** | ✅ 推奨 | バケット単位 | 最小権限、安全 |
| Account API Token | ❌ 非推奨 | アカウント全体 | 権限過剰、危険 |

このプロジェクトでは **R2 Token** を使用します。

#### 作成手順

1. **R2 ダッシュボード**で **"Manage R2 API Tokens"** をクリック
   - ※ "My Profile" → "API Tokens" ではありません（それはAccount API Token）
2. **"Create API Token"** をクリック
3. トークン名を入力（例: `notebooklm-bot`）
4. 権限を **"Object Read & Write"** に設定
5. **適用するバケットを選択**（またはすべてのバケットを許可）
6. **"Create API Token"**

#### 表示される情報をコピー

生成後、以下の情報が表示されます。**この画面は一度しか表示されません**ので、必ずコピーしてください：

```
Access Key ID: abc123def456ghi789jkl012mno345pq
Secret Access Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

また、ページ上部または別の箇所に **Account ID** が表示されています（形式: `1a2b3c4d5e6f7g8h9i0j`）。

### ステップ 3.3: R2 の認証情報を設定

`.env` ファイルに追加:

```bash
# Cloudflare R2 Settings
R2_ACCOUNT_ID=1a2b3c4d5e6f7g8h9i0j                    # Account ID（R2ダッシュボードに表示）
R2_ACCESS_KEY_ID=abc123def456ghi789jkl012mno345pq      # Access Key ID
R2_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Secret Access Key
R2_BUCKET_NAME=notebooklm-media                        # 作成したバケット名
```

**注意**:
- `R2_PUBLIC_URL` は設定不要です（コード内で動的に生成されます）
- 上記の値は例です。実際の値に置き換えてください
- トークンは絶対に公開しないでください（`.gitignore` で `.env` は除外されています）

---

## 4. NotebookLM の認証

### ステップ 4.1: 初回ログイン

NotebookLMへのログイン情報を保存します:

```bash
# ブラウザが開き、Google アカウントでログイン
npx playwright install chromium
npm run notebooklm:login

# ※ このスクリプトはまだ存在しないので、以下のコマンドで代用:
PLAYWRIGHT_HEADLESS=false npx tsx scripts/test-notebooklm.ts
```

**手順**:
1. ブラウザが起動する
2. NotebookLM (https://notebooklm.google.com) に自動遷移
3. **手動で Google アカウントにログイン**
4. ログイン完了後、ブラウザを閉じる
5. 認証情報が `./user-data/` に保存される

### ステップ 4.2: 認証情報の確認

```bash
ls -la ./user-data/
# Default/ フォルダなどが作成されていれば OK
```

**重要**: `./user-data/` フォルダは削除しないでください（認証情報が含まれています）

---

## 5. ボットの起動

### ステップ 5.1: 依存関係のインストール

```bash
npm install
```

### ステップ 5.2: データベースの初期化

ボットを初回起動すると、自動的に SQLite データベースが作成されます:

```bash
# ./data/bot.db が自動作成される
```

### ステップ 5.3: ボットを起動

```bash
npm run bot:start
```

**起動ログ**:
```
╔═══════════════════════════════════════╗
║  NotebookLM Slack Bot Starting...   ║
╚═══════════════════════════════════════╝

⚡️ Slack bot is running!
Request processor started

✓ Bot is now running and processing requests
✓ Mention the bot in Slack with a URL to start processing

Press Ctrl+C to stop
```

### ステップ 5.4: Slack でテスト

1. Slack ワークスペースで任意のチャンネルにボットを招待:
   ```
   /invite @NotebookLM Bot
   ```

2. ボットをメンションして URL を送信:
   ```
   @NotebookLM Bot https://zenn.dev/example/articles/12345
   ```

3. ボットが応答:
   ```
   ✅ URLを受け付けました: https://zenn.dev/example/articles/12345

   🔄 処理キューに追加しました (Job ID: 1)
   処理が完了したらこのスレッドに結果を投稿します。
   ```

4. 処理完了後（約10-16分）、スレッドに結果が投稿される:
   ```
   ✅ 処理が完了しました！

   🎵 音声解説: https://...r2.cloudflarestorage.com/...
      サイズ: 39.06 MB

   🎬 動画解説: https://...r2.cloudflarestorage.com/...
      サイズ: 20.41 MB

   ⏰ リンクは7日間有効です
   ```

---

## 6. 運用方法

### 6.1 デーモンとして実行（推奨）

#### PM2 を使う場合（Node.js プロセスマネージャー）

```bash
# PM2 をインストール
npm install -g pm2

# ボットを起動
pm2 start npm --name "notebooklm-bot" -- run bot:start

# ステータス確認
pm2 status

# ログ確認
pm2 logs notebooklm-bot

# 再起動
pm2 restart notebooklm-bot

# 停止
pm2 stop notebooklm-bot

# 自動起動設定（サーバー再起動時）
pm2 startup
pm2 save
```

#### systemd を使う場合（Linux）

`/etc/systemd/system/notebooklm-bot.service` を作成:

```ini
[Unit]
Description=NotebookLM Slack Bot
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/notebooklm-sumary-maker-slack-bot
ExecStart=/usr/bin/npm run bot:start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

起動:
```bash
sudo systemctl enable notebooklm-bot
sudo systemctl start notebooklm-bot
sudo systemctl status notebooklm-bot
```

### 6.2 開発モード（自動再起動）

コード変更時に自動で再起動:

```bash
npm run dev
```

### 6.3 ログの確認

ログは標準出力に出力されます:

```bash
# PM2 の場合
pm2 logs notebooklm-bot

# systemd の場合
sudo journalctl -u notebooklm-bot -f

# 直接実行の場合
npm run bot:start 2>&1 | tee bot.log
```

### 6.4 データベースの管理

```bash
# SQLite データベースを確認
sqlite3 ./data/bot.db

# テーブル一覧
.tables

# リクエスト履歴を確認
SELECT * FROM requests ORDER BY created_at DESC LIMIT 10;

# キュー統計
SELECT status, COUNT(*) as count FROM requests GROUP BY status;

# 終了
.exit
```

### 6.5 トラブルシューティング

#### ボットが応答しない

1. Slack App が正しくインストールされているか確認
2. Socket Mode が有効になっているか確認
3. トークンが正しく設定されているか確認:
   ```bash
   # .env ファイルを確認 (macOS/Linux)
   cat .env | grep SLACK_

   # Windows PowerShell の場合
   Get-Content .env | Select-String "SLACK_"
   ```

#### NotebookLM 認証エラー

```bash
# 認証情報を削除して再ログイン
# macOS/Linux
rm -rf ./user-data/
PLAYWRIGHT_HEADLESS=false npx tsx scripts/test-notebooklm.ts

# Windows PowerShell
Remove-Item -Recurse -Force .\user-data\
$env:PLAYWRIGHT_HEADLESS="false"; npx tsx scripts/test-notebooklm.ts
```

#### R2 アップロードエラー

1. R2 トークンが有効か確認
2. バケット名が正しいか確認
3. R2 の権限設定を確認（Read & Write）

#### Windows 固有の問題

**詳細は [Windows セットアップガイド](./windows-setup.md) の [トラブルシューティング](./windows-setup.md#7-トラブルシューティング) を参照**:

- パス長制限エラー (ENAMETOOLONG)
- ファイアウォールブロック
- 権限エラー (EPERM)
- Playwright ダウンロードエラー

**クロスプラットフォーム対応**:
このプロジェクトは Windows/Mac/Linux で同じコードが動作します。パス処理は Node.js の `path` モジュールを使用しているため、OS 間の違いは自動的に処理されます。

### 6.6 セキュリティ推奨事項

1. **環境変数を保護**:
   ```bash
   chmod 600 .env
   ```

2. **user-data をバックアップ**:
   ```bash
   cp -r ./user-data/ ./user-data-backup/
   ```

3. **定期的にトークンをローテーション**

4. **ログから機密情報を除外**:
   - `.env` ファイルを `.gitignore` に追加済み
   - `user-data/` もコミット対象外

---

## テストコマンド一覧

```bash
# NotebookLM 自動化テスト（10-16分かかります）
TEST_URL=https://zenn.dev/example/articles/12345 npm run test:notebooklm

# Slack 接続テスト
npm run test:slack

# E2E テスト（完全なフロー）
TEST_URL=https://example.com npm run test:e2e

# ボット起動
npm run bot:start
```

---

## システム要件

- **Node.js**: 20.x 以上
- **OS**: macOS, Linux, Windows 10/11 (ネイティブ対応)
- **メモリ**: 最低 2GB (Playwright 用)
- **ディスク**: 約 500MB (Chromium + 依存関係)

**Windows ユーザーの方へ**: Windows 10/11 での詳細なセットアップ手順は [Windows セットアップガイド](./windows-setup.md) をご覧ください。

---

## FAQ

### Q1: 複数のリクエストを同時に処理できますか？

A: いいえ、現在の実装は**シリアル処理**（1件ずつ）です。これは単一の NotebookLM Pro アカウントを使用しているためです。複数のリクエストはキューに追加され、順番に処理されます。

### Q2: 処理時間はどのくらいかかりますか？

A: 1件あたり約 **10-16分** です（音声と動画を並列生成）。

### Q3: リンクの有効期限は？

A: R2 の署名付き URL は **7日間** 有効です。期限後は自動的に削除されます。

### Q4: 対応している URL の種類は？

A: NotebookLM が対応しているすべての URL:
- ウェブページ（記事、ブログなど）
- YouTube 動画
- Google ドキュメント
- PDF（公開URL）

### Q5: ボットを停止するには？

A:
- **直接実行**: `Ctrl+C`
- **PM2**: `pm2 stop notebooklm-bot`
- **systemd**: `sudo systemctl stop notebooklm-bot`

---

## サポート

問題が発生した場合は、以下を確認してください:

1. ログ出力
2. `.env` ファイルの設定
3. Slack App の権限設定
4. R2 バケットの権限

それでも解決しない場合は、GitHub Issues にて報告してください。
