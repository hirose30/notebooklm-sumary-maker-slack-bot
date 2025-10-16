# Multi-Workspace Setup Guide

このガイドでは、別々のSlack Appを使って複数ワークスペースに対応する方法を説明します。

## 概要

- **アーキテクチャ**: 各ワークスペース用に別々のBotプロセスを起動
- **理由**: Socket Modeでは1プロセスで1つのAPP_TOKENしか接続できないため
- **共有リソース**: R2ストレージ（メディアファイル）は共有、データベースも共有可能

## セットアップ手順

### 1. 環境変数ファイルを作成

#### Workspace 1用

```bash
cp .env.ws1.example .env.ws1
```

`.env.ws1`を編集：
```bash
# Slack Configuration (WS1)
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_WS1_BOT_TOKEN=xoxb-your-ws1-bot-token
SLACK_WS1_APP_TOKEN=xapp-your-ws1-app-token

# R2 Storage (共有)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=notebooklm-media
R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com

# NotebookLM
NOTEBOOKLM_EMAIL=your-email@gmail.com

# Development
PLAYWRIGHT_HEADLESS=false
USER_DATA_DIR=./user-data-ws1
```

#### Workspace 2用

```bash
cp .env.ws2.example .env.ws2
```

`.env.ws2`を編集：
```bash
# Slack Configuration (WS2)
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_WS1_BOT_TOKEN=xoxb-your-ws2-bot-token  # WS2のトークンだが変数名はWS1
SLACK_WS1_APP_TOKEN=xapp-your-ws2-app-token

# R2 Storage (WS1と同じ - 共有)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=notebooklm-media
R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com

# NotebookLM (WS1と同じ - 共有)
NOTEBOOKLM_EMAIL=your-email@gmail.com

# Development
PLAYWRIGHT_HEADLESS=false
USER_DATA_DIR=./user-data-ws2  # WS2専用のディレクトリ
```

**重要**: WS2の設定でも`SLACK_WS1_*`という変数名を使います。これは各プロセスが独立して動作するため、コード内では常に`WS1`として扱われるためです。

### 2. データベースの扱い

#### Option A: 共有データベース（推奨）

両プロセスで同じデータベースを使用：
```bash
# .env.ws1 と .env.ws2 の両方
# DB_PATH環境変数は不要（デフォルト: ./data/bot.db）
```

**メリット**:
- リクエスト履歴が一元管理される
- メディアファイルのリンクが共有される

**注意**:
- SQLiteのロック機構により、同時書き込みは自動的に調停される
- 大量の同時リクエストがある場合はパフォーマンスに注意

#### Option B: 別々のデータベース

各プロセスで独立したデータベースを使用：
```bash
# .env.ws1
DB_PATH=./data/bot-ws1.db

# .env.ws2
DB_PATH=./data/bot-ws2.db
```

**メリット**:
- 完全に独立した動作

**デメリット**:
- リクエスト履歴が分散される
- 実装に追加の設定が必要（現在未対応）

### 3. Botプロセスの起動

#### ターミナル1: Workspace 1用Bot

```bash
npm run bot:start:ws1
```

起動ログの確認：
```
✅ Loaded workspace: Your WS1 Name (T027K4HQ2)
✅ Total workspaces loaded: 1
⚡️ Slack bot is running!
```

#### ターミナル2: Workspace 2用Bot

```bash
npm run bot:start:ws2
```

起動ログの確認：
```
✅ Loaded workspace: Your WS2 Name (T01S7U880QY)
✅ Total workspaces loaded: 1
⚡️ Slack bot is running!
```

### 4. 動作確認

各ワークスペースで：
1. Botをメンション
2. URLを含むメッセージを送信
3. 処理が開始されることを確認
4. 完了メッセージが投稿されることを確認

### 5. プロダクション環境での運用

#### Option A: tmuxを使う

```bash
# セッション作成
tmux new-session -d -s bot-ws1 'npm run bot:start:ws1'
tmux new-session -d -s bot-ws2 'npm run bot:start:ws2'

# セッション確認
tmux ls

# セッションにアタッチ（ログ確認）
tmux attach -t bot-ws1
# デタッチ: Ctrl+B → D

# セッション停止
tmux kill-session -t bot-ws1
tmux kill-session -t bot-ws2
```

#### Option B: systemdを使う（Linux）

`/etc/systemd/system/notebooklm-bot-ws1.service`:
```ini
[Unit]
Description=NotebookLM Slack Bot - Workspace 1
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/notebooklm-sumary-maker-slack-bot
ExecStart=/usr/bin/npm run bot:start:ws1
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

同様に`notebooklm-bot-ws2.service`も作成。

```bash
sudo systemctl daemon-reload
sudo systemctl enable notebooklm-bot-ws1
sudo systemctl enable notebooklm-bot-ws2
sudo systemctl start notebooklm-bot-ws1
sudo systemctl start notebooklm-bot-ws2
```

#### Option C: PM2を使う

```bash
npm install -g pm2

# 起動
pm2 start npm --name "bot-ws1" -- run bot:start:ws1
pm2 start npm --name "bot-ws2" -- run bot:start:ws2

# 状態確認
pm2 status

# ログ確認
pm2 logs bot-ws1
pm2 logs bot-ws2

# 停止
pm2 stop bot-ws1 bot-ws2

# 削除
pm2 delete bot-ws1 bot-ws2

# 自動起動設定
pm2 startup
pm2 save
```

## トラブルシューティング

### Botが起動しない

1. 環境変数の確認：
   ```bash
   cat .env.ws1 | grep SLACK_
   ```

2. ログの確認：
   - `No valid workspace configurations found` → BOT_TOKENが設定されていない
   - `Slack API error` → トークンが無効

### 片方のワークスペースだけ反応しない

1. プロセスが起動しているか確認
2. 該当ワークスペースのログを確認
3. Slack Appがワークスペースにインストールされているか確認

### リクエストが処理されない

1. データベースを確認：
   ```bash
   sqlite3 ./data/bot.db "SELECT id, url, status, current_step FROM requests ORDER BY id DESC LIMIT 5"
   ```

2. `processing`のまま止まっている場合：
   - Botプロセスを再起動
   - NotebookLMのログイン状態を確認（`npm run notebooklm:login`）

### ポート競合

両プロセスが同じポートを使おうとする場合は、環境変数で分ける：
```bash
# .env.ws1
PORT=3001

# .env.ws2
PORT=3002
```

## リソース共有について

### 共有されるもの

- **R2ストレージ**: 生成されたメディアファイル
  - 同じバケット、同じURL
  - 7日間の有効期限

- **データベース** (Option A選択時):
  - リクエスト履歴
  - ワークスペース情報

### 独立しているもの

- **Slack接続**: 各プロセスは独自のSocket Mode接続
- **NotebookLM自動化**: 各プロセスは独自のブラウザインスタンス
- **USER_DATA_DIR**: ブラウザ認証データは分離推奨

## 制限事項

1. **同じSlack Appは使えない**: 各ワークスペースに別々のSlack Appが必要
2. **1プロセス1ワークスペース**: Socket Modeの制限により
3. **リソース消費**: 2倍のメモリ・CPU使用量

## 将来の改善案

1. **OAuth対応**: 1つのSlack Appで複数ワークスペース対応（要HTTPS公開エンドポイント）
2. **キュー共有**: Redis等を使った複数プロセス間のキュー共有
3. **水平スケーリング**: Kubernetes等でのコンテナ化

## 参考

- [Slack Bolt SDK - Multi-workspace](https://slack.dev/bolt-js/concepts#authenticating-oauth)
- [Socket Mode Limitations](https://api.slack.com/apis/connections/socket#limits)
