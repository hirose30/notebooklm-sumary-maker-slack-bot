# Multi-Workspace Setup Guide

このガイドでは、別々のSlack Appを使って複数ワークスペースに対応する方法を説明します。

## 概要

- **アーキテクチャ**: 各ワークスペース用に別々のBotプロセスを起動
- **理由**: Socket Modeでは1プロセスで1つのAPP_TOKENしか接続できないため
- **共有リソース**: R2ストレージ（メディアファイル）は共有、データベースも共有
- **ログ分離**: プロセスごとに独立したログファイル（`system-ws1-*.log`, `system-ws2-*.log`）

## セットアップ手順

### 1. 環境変数ファイルを作成

**統合された`.env`ファイル**を使用します（`.env.ws1`や`.env.ws2`は不要になりました）。

`.env`ファイルを編集：
```bash
# Slack Configuration (Shared)
SLACK_SIGNING_SECRET=your-signing-secret

# Workspace 1
SLACK_WS1_BOT_TOKEN=xoxb-your-ws1-bot-token
SLACK_WS1_APP_TOKEN=xapp-your-ws1-app-token

# Workspace 2
SLACK_WS2_BOT_TOKEN=xoxb-your-ws2-bot-token
SLACK_WS2_APP_TOKEN=xapp-your-ws2-app-token

# R2 Storage (Shared)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=notebooklm-media
R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com

# NotebookLM Configuration (Shared)
NOTEBOOKLM_EMAIL=your-email@gmail.com

# Logging Configuration
LOG_LEVEL=INFO

# Development
PLAYWRIGHT_HEADLESS=false
```

**重要な変更点**:
- 1つの`.env`ファイルに両方のワークスペース設定を記述
- `SLACK_WS1_*`と`SLACK_WS2_*`のプレフィックスで区別
- 起動スクリプト（`start-ws1.sh`/`start-ws2.sh`）が自動的に不要な変数を除外
- `USER_DATA_DIR`は自動生成（`./user-data-ws1`, `./user-data-ws2`）

### 2. NotebookLMアカウントのログイン

各ワークスペースで異なるNotebookLMアカウントを使用する場合、ワークスペースごとにログインします：

```bash
# Workspace 1用のNotebookLMアカウントでログイン
npm run notebooklm:login:ws1

# Workspace 2用のNotebookLMアカウントでログイン
npm run notebooklm:login:ws2
```

ブラウザが開くので、それぞれのGoogleアカウントでログインしてください。
ログイン情報は以下のディレクトリに保存されます：
- WS1: `./user-data-ws1`
- WS2: `./user-data-ws2`

### 3. データベースの扱い

**共有データベース（デフォルト）**

両プロセスで同じデータベース（`./data/bot.db`）を自動的に使用します。

**メリット**:
- リクエスト履歴が一元管理される
- ワークスペース情報が共有される
- 設定不要

**注意**:
- SQLiteのロック機構により、同時書き込みは自動的に調停されます

### 4. Botプロセスの起動

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

### 5. ログファイルの確認

プロセスごとに独立したログファイルが生成されます：

```bash
logs/
├── system-ws1-2025-10-26.log   # WS1プロセスのシステムログ
├── system-ws2-2025-10-26.log   # WS2プロセスのシステムログ
├── ws1-2025-10-26.log          # WS1のリクエスト処理ログ
└── ws2-2025-10-26.log          # WS2のリクエスト処理ログ
```

ログレベルは`LOG_LEVEL`環境変数で制御できます（ERROR, WARN, INFO, DEBUG）。

### 6. 動作確認

各ワークスペースで：
1. Botをメンション
2. URLを含むメッセージを送信
3. 処理が開始されることを確認
4. 完了メッセージが投稿されることを確認
5. 対応するログファイル（`ws1-*.log`または`ws2-*.log`）にログが記録されていることを確認

### 7. プロダクション環境での運用

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
   cat .env | grep SLACK_WS1_
   cat .env | grep SLACK_WS2_
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
   - NotebookLMのログイン状態を確認（`npm run notebooklm:login:ws1` または `npm run notebooklm:login:ws2`）

### ログファイルが作成されない

1. `logs/`ディレクトリの権限を確認
2. ディスクの空き容量を確認
3. `LOG_LEVEL`環境変数を確認（DEBUGに設定すると詳細ログが見られます）

## リソース共有について

### 共有されるもの

- **R2ストレージ**: 生成されたメディアファイル
  - 同じバケット、同じURL
  - 7日間の有効期限

- **データベース**:
  - リクエスト履歴
  - ワークスペース情報

### 独立しているもの

- **Slack接続**: 各プロセスは独自のSocket Mode接続
- **NotebookLM自動化**: 各プロセスは独自のブラウザインスタンス
- **ブラウザ認証データ**: `./user-data-ws1`と`./user-data-ws2`で分離
- **ログファイル**: `system-ws1-*.log`/`system-ws2-*.log`と`ws1-*.log`/`ws2-*.log`で分離

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
