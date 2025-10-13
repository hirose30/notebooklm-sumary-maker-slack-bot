# Slack App 詳細設定ガイド

このガイドでは、Slack Appの作成から設定完了までを画面遷移に沿って詳しく説明します。

## 前提知識

このボットは **Socket Mode** を使用するため:
- ✅ 公開されたWebhook URLは不要
- ✅ ローカルマシンで実行可能
- ✅ ngrok等のトンネリングツール不要
- ✅ Request URLの設定不要

詳細は [setup-guide.md の「アーキテクチャについて」](./setup-guide.md#アーキテクチャについて-socket-mode-とは) を参照してください。

---

## ステップ1: Slack Appの作成

### 1.1 アプリ作成ページにアクセス

1. ブラウザで https://api.slack.com/apps を開く
2. 右上の **「Create New App」** ボタンをクリック

### 1.2 作成方法を選択

ダイアログが表示されます:

- **「From scratch」** を選択（推奨）
- ※「From an app manifest」は使用しません

### 1.3 アプリ情報を入力

以下を入力:

| 項目 | 入力内容 |
|------|---------|
| **App Name** | `NotebookLM Bot` (任意の名前でOK) |
| **Pick a workspace** | ボットをインストールするワークスペースを選択 |

**「Create App」** をクリック

---

## ステップ2: OAuth & Permissions (権限設定)

### 2.1 OAuth & Permissions ページを開く

左サイドバーから **「OAuth & Permissions」** をクリック

### 2.2 Bot Token Scopes を追加

**「Scopes」** セクションまでスクロール → **「Bot Token Scopes」** の **「Add an OAuth Scope」** をクリック

以下の5つのスコープを追加:

| Scope | 説明 | 必要な理由 |
|-------|------|-----------|
| `app_mentions:read` | アプリへのメンション | ボットがメンションされたことを検知 |
| `chat:write` | メッセージ送信 | 処理結果をSlackに投稿 |
| `channels:history` | パブリックチャンネル履歴 | チャンネル内のメッセージを読む |
| `groups:history` | プライベートチャンネル履歴 | プライベートチャンネルでも動作 |
| `im:history` | ダイレクトメッセージ履歴 | DMでも動作(オプション) |

### 2.3 確認

**Bot Token Scopes** に5つのスコープが表示されていることを確認

---

## ステップ3: Socket Mode の有効化 (重要!)

**重要**: Event Subscriptions を設定する**前**に、**必ず Socket Mode を先に有効化**してください。

Socket Mode を有効化しないと、Event Subscriptions で Request URL の入力を求められ、「Save Changes」ボタンが有効になりません。

### 3.1 Socket Mode ページを開く

左サイドバーから **「Socket Mode」** をクリック

### 3.2 Socket Mode を有効化

**「Enable Socket Mode」** トグルを **ON** にする

### 3.3 App-Level Token の作成

ダイアログが表示されます:

1. **Token Name** を入力: `socket-token` (任意の名前でOK)
2. **Scopes** は自動で `connections:write` が選択される
3. **「Generate」** をクリック

### 3.4 トークンをコピー

生成された **App-Level Token** (`xapp-1-...` で始まる) が表示されます。

**重要**: このトークンは後で確認できないので、必ずコピーしてください。

```
例: xapp-1-A01234567-1234567890123-abcdef1234567890abcdef1234567890
```

このトークンを `.env` ファイルの `SLACK_APP_TOKEN` に設定します。

**「Done」** をクリック

---

## ステップ4: Event Subscriptions (イベント購読)

**注意**: このステップは **Socket Mode を有効化した後** に実行してください。

### 4.1 Event Subscriptions ページを開く

左サイドバーから **「Event Subscriptions」** をクリック

### 4.2 イベントを有効化

**「Enable Events」** トグルを **ON** にする

### 4.3 Request URL について

**Socket Mode が有効な場合**:
- Request URL 欄に「**Socket mode is enabled. You don't need to add a Request URL.**」と表示される
- または Request URL 欄が**グレーアウトして入力不要**になる

**もし Request URL の入力を求められる場合**:
→ Socket Mode が有効になっていません。**ステップ3に戻って Socket Mode を有効化**してください。

### 4.4 Subscribe to bot events

**「Subscribe to bot events」** セクションまでスクロール

**「Add Bot User Event」** をクリックして以下を追加:

| Event Name | 説明 |
|------------|------|
| `app_mention` | ボットがメンションされた時 |

### 4.5 変更を保存

ページ下部の **「Save Changes」** ボタンをクリック

**トラブルシューティング**:
- **「Save Changes」が有効（青色）にならない場合**:
  1. Socket Mode が有効になっているか再確認 → 左メニュー「Socket Mode」で確認
  2. ページをリロード（F5 または Cmd+R）してみる
  3. ブラウザのキャッシュをクリアしてみる
  4. それでもダメなら、Event Subscriptions を一旦 OFF にして、再度 ON にする

---

## ステップ5: App Installation (ワークスペースにインストール)

### 5.1 Install App ページを開く

左サイドバーから **「Install App」** をクリック

### 5.2 ワークスペースにインストール

**「Install to Workspace」** ボタンをクリック

### 5.3 権限を承認

権限確認画面が表示されます:

- ボットが要求する権限(先ほど設定したスコープ)が表示される
- 内容を確認して **「Allow」** をクリック

### 5.4 Bot User OAuth Token をコピー

インストール完了後、**Bot User OAuth Token** が表示されます (`xoxb-...` で始まる)

**重要**: このトークンをコピーしてください。

```
例: xoxb-1234567890123-1234567890123-abcdefghijklmnopqrstuvwx
```

このトークンを `.env` ファイルの `SLACK_BOT_TOKEN` に設定します。

---

## ステップ6: Signing Secret の取得

### 6.1 Basic Information ページを開く

左サイドバーから **「Basic Information」** をクリック

### 6.2 Signing Secret をコピー

**「App Credentials」** セクションまでスクロール

**「Signing Secret」** の右側にある **「Show」** をクリック → 表示された文字列をコピー

```
例: 1234567890abcdef1234567890abcdef
```

このシークレットを `.env` ファイルの `SLACK_SIGNING_SECRET` に設定します。

---

## ステップ7: .env ファイルへの設定

プロジェクトルートの `.env` ファイルに以下を記入:

```bash
# Slack Settings
SLACK_BOT_TOKEN=xoxb-1234567890123-1234567890123-abcdefghijklmnopqrstuvwx
SLACK_APP_TOKEN=xapp-1-A01234567-1234567890123-abcdef1234567890abcdef1234567890
SLACK_SIGNING_SECRET=1234567890abcdef1234567890abcdef
```

**注意**: 上記は例です。実際のトークンに置き換えてください。

---

## ステップ8: ボットをチャンネルに招待

### 8.1 Slackワークスペースを開く

ボットをテストしたいチャンネルを開く

### 8.2 ボットを招待

チャンネル内で以下のコマンドを実行:

```
/invite @NotebookLM Bot
```

※ アプリ名を変えた場合は、その名前を指定してください。

### 8.3 確認

チャンネルに「〇〇さんがNotebookLM Botを追加しました」というメッセージが表示されればOK

---

## ステップ9: 動作確認

### 9.1 ボットを起動

ターミナルで:

```bash
npm run bot:start
```

以下のログが表示されればOK:

```
╔═══════════════════════════════════════╗
║  NotebookLM Slack Bot Starting...   ║
╚═══════════════════════════════════════╝

⚡️ Slack bot is running!
Request processor started

✓ Bot is now running and processing requests
```

### 9.2 Slackでテスト

チャンネルで以下のようにメンション:

```
@NotebookLM Bot https://zenn.dev/example/articles/12345
```

### 9.3 期待される応答

ボットが以下のように応答すれば成功:

```
✅ URLを受け付けました: https://zenn.dev/example/articles/12345

🔄 処理キューに追加しました (Job ID: 1)
処理が完了したらこのスレッドに結果を投稿します。
```

---

## トラブルシューティング

### ボットが応答しない場合

#### 1. Socket Mode が有効か確認

https://api.slack.com/apps → あなたのアプリ → **Socket Mode**

- **Enable Socket Mode** が **ON** になっているか確認
- App-Level Token が生成されているか確認

#### 2. トークンが正しいか確認

`.env` ファイルを確認:

```bash
cat .env | grep SLACK_
```

以下が全て設定されているか:
- `SLACK_BOT_TOKEN=xoxb-...`
- `SLACK_APP_TOKEN=xapp-...`
- `SLACK_SIGNING_SECRET=...`

#### 3. スコープが設定されているか確認

https://api.slack.com/apps → あなたのアプリ → **OAuth & Permissions**

**Bot Token Scopes** に以下の5つがあるか:
- `app_mentions:read`
- `chat:write`
- `channels:history`
- `groups:history`
- `im:history`

#### 4. イベント購読が設定されているか確認

https://api.slack.com/apps → あなたのアプリ → **Event Subscriptions**

- **Enable Events** が **ON**
- **Subscribe to bot events** に `app_mention` が登録されている

#### 5. ボットがチャンネルに招待されているか確認

Slackのチャンネルで:

```
/invite @NotebookLM Bot
```

を実行してボットを追加

#### 6. ログを確認

ターミナルでボットのログを確認:

```bash
npm run bot:start
```

エラーメッセージが表示されていないか確認

---

## セキュリティのベストプラクティス

### 1. トークンを保護

```bash
chmod 600 .env
```

### 2. .gitignore に追加されているか確認

`.env` ファイルが Git にコミットされないことを確認:

```bash
cat .gitignore | grep .env
```

`.env` が含まれていればOK

### 3. トークンを共有しない

- Slack、GitHub、その他のチャットツールに `.env` の内容を貼り付けない
- スクリーンショットにトークンが映り込まないように注意

### 4. 定期的なローテーション

本番環境では、トークンを定期的(3-6ヶ月)に再生成することを推奨

---

## よくある質問

### Q: Request URL を設定する必要はありますか?

**A: いいえ、Socket Mode を使用しているため不要です。**

Event Subscriptions ページの Request URL 欄は空白のままで構いません。

### Q: ボットを複数のワークスペースで使えますか?

A: はい、可能です。ただし、各ワークスペースごとに:
- アプリを作成
- トークンを取得
- 別の `.env` ファイルで管理

する必要があります。

### Q: Socket Mode を無効にしたらどうなりますか?

A: ボットが動作しなくなります。このプロジェクトは Socket Mode 専用です。

従来の HTTP モード(Webhook)に切り替える場合は、コードの大幅な変更が必要です。

### Q: App-Level Token を再確認したい

A: Slack App 管理画面 → **Basic Information** → **App-Level Tokens** セクションで確認できます。

ただし、トークン文字列自体は再表示できないため、紛失した場合は再生成が必要です。

### Q: Bot Token を再生成したい

A: **OAuth & Permissions** → **OAuth Tokens for Your Workspace** → **Revoke** → 再インストール

新しいトークンが生成されるので、`.env` ファイルを更新してください。

---

## 次のステップ

Slack App の設定が完了したら:

1. [setup-guide.md](./setup-guide.md) に戻って、残りのセットアップ(R2、NotebookLM)を完了
2. `npm run bot:start` でボットを起動
3. Slack でテスト実行

---

## 参考リンク

- [Slack Socket Mode 公式ドキュメント](https://api.slack.com/apis/connections/socket)
- [Slack Bolt for JavaScript](https://slack.dev/bolt-js/)
- [OAuth Scopes 一覧](https://api.slack.com/scopes)
