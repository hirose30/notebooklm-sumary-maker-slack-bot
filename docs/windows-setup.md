# NotebookLM Slack Bot - Windows セットアップガイド

このガイドでは、Windows 10/11 環境での NotebookLM Slack Bot のセットアップ手順を説明します。

**対象環境**: Windows 10 (64bit) / Windows 11

---

## 目次

1. [前提条件](#1-前提条件)
2. [Node.js のインストール](#2-nodejs-のインストール)
3. [プロジェクトのセットアップ](#3-プロジェクトのセットアップ)
4. [Playwright のインストール](#4-playwright-のインストール)
5. [環境変数の設定](#5-環境変数の設定)
6. [ボットの起動](#6-ボットの起動)
7. [トラブルシューティング](#7-トラブルシューティング)

---

## 1. 前提条件

### システム要件

- **OS**: Windows 10 (64bit) または Windows 11
- **メモリ**: 最低 4GB RAM (推奨: 8GB以上)
- **ディスク**: 約 1GB の空き容量
- **インターネット接続**: 必須

### 必要な権限

- アプリケーションのインストール権限
- ファイアウォール設定の変更権限（初回起動時）

---

## 2. Node.js のインストール

### ステップ 2.1: Node.js のダウンロード

1. [Node.js 公式サイト](https://nodejs.org/) にアクセス
2. **LTS版（Long Term Support）** をダウンロード
   - 推奨: Node.js 20.x LTS 以上
3. ダウンロードした `.msi` インストーラーを実行

### ステップ 2.2: インストール

1. インストーラーを起動
2. **Next** をクリック
3. ライセンス同意にチェックして **Next**
4. インストール先はデフォルトのまま **Next**
5. **Install** をクリック
6. インストール完了後、**Finish**

### ステップ 2.3: インストール確認

PowerShell またはコマンドプロンプトを開いて確認:

```powershell
# PowerShell を開く（Windows キー + X → "Windows PowerShell"）
node --version
# v20.x.x のように表示されればOK

npm --version
# 10.x.x のように表示されればOK
```

**トラブル**: コマンドが見つからない場合は、PCを再起動してください。

---

## 3. プロジェクトのセットアップ

### ステップ 3.1: プロジェクトのクローン/ダウンロード

#### Git を使う場合

```powershell
# Git がインストール済みの場合
git clone https://github.com/your-repo/notebooklm-sumary-maker-slack-bot.git
cd notebooklm-sumary-maker-slack-bot
```

#### ZIP ダウンロードの場合

1. GitHub からプロジェクトを ZIP でダウンロード
2. ダウンロードフォルダから ZIP を解凍
3. 解凍したフォルダを `C:\Users\<ユーザー名>\notebooklm-bot` などに移動

### ステップ 3.2: プロジェクトフォルダに移動

```powershell
cd C:\Users\<ユーザー名>\notebooklm-bot
```

### ステップ 3.3: 依存関係のインストール

```powershell
npm install
```

**注意**: 初回は数分かかります。完了するまで待ちましょう。

---

## 4. Playwright のインストール

Playwright Chromium ブラウザをインストール:

```powershell
npx playwright install chromium
```

**実行例**:
```
Downloading Chromium 123.0.6312.4 (playwright build v1105) from https://playwright.azureedge.net/...
134.2 Mb [====================] 100% 0.0s
Chromium 123.0.6312.4 (playwright build v1105) downloaded to C:\Users\...\ms-playwright\chromium-1105
```

**トラブル**: ダウンロードに失敗する場合は、ファイアウォールまたはプロキシ設定を確認してください。

---

## 5. 環境変数の設定

### ステップ 5.1: .env ファイルの作成

プロジェクトルートに `.env` ファイルを作成します。

#### 方法 1: PowerShell でコピー

```powershell
Copy-Item .env.example .env
```

#### 方法 2: 手動で作成

1. メモ帳を開く
2. `.env.example` の内容をコピー
3. **名前を付けて保存** → ファイル名: `.env`、ファイルの種類: **すべてのファイル**
4. プロジェクトルートに保存

### ステップ 5.2: 環境変数を設定

`.env` ファイルをメモ帳で開いて編集:

```bash
# Slack Settings
SLACK_BOT_TOKEN=xoxb-your-bot-token-here
SLACK_APP_TOKEN=xapp-your-app-token-here
SLACK_SIGNING_SECRET=your-signing-secret-here

# NotebookLM Settings
NOTEBOOKLM_EMAIL=your-email@example.com
USER_DATA_DIR=./user-data
PLAYWRIGHT_HEADLESS=false

# Cloudflare R2 Settings
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=your-bucket-name
```

**重要**:
- 各トークンを実際の値に置き換えてください
- `USER_DATA_DIR=./user-data` はそのままでOK（Windowsでも動作します）
- パスは相対パスのため、Windows/Mac 両対応です

### ステップ 5.3: PowerShell での環境変数設定（オプション）

PowerShell で一時的に環境変数を設定することもできます:

```powershell
# 現在のセッションで有効
$env:SLACK_BOT_TOKEN="xoxb-your-token"
$env:SLACK_APP_TOKEN="xapp-your-token"
```

ただし、**`.env` ファイルを使う方が推奨**です。

---

## 6. ボットの起動

### ステップ 6.1: NotebookLM 認証（初回のみ）

初回起動時に NotebookLM へのログインが必要です:

```powershell
npm run notebooklm:login
```

**手順**:
1. Chromium ブラウザが自動で起動
2. NotebookLM (https://notebooklm.google.com) に遷移
3. **Google アカウントで手動ログイン**
4. ログイン完了後、ブラウザを閉じる
5. 認証情報が `.\user-data\` フォルダに保存される

**確認**:
```powershell
dir .\user-data\
# Default\ フォルダが作成されていればOK
```

### ステップ 6.2: ボットを起動

```powershell
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

**ファイアウォール警告**:
初回起動時に Windows ファイアウォールの警告が表示される場合:
- **「アクセスを許可する」** をクリック
- Node.js がネットワークにアクセスできるようにします

### ステップ 6.3: Slack でテスト

Slack ワークスペースでボットをメンション:

```
@NotebookLM Bot https://zenn.dev/example/articles/12345
```

ボットが応答すれば成功です！

### ステップ 6.4: 停止方法

```powershell
# Ctrl + C を押す
```

---

## 7. トラブルシューティング

### 7.1 パス長制限エラー

**エラー例**:
```
ENAMETOOLONG: name too long
```

**原因**: Windows には 260文字のパス長制限があります。

**解決方法**: 長いパスを有効化する

#### 方法 1: レジストリエディタ（推奨）

1. **Windows キー + R** → `regedit` と入力
2. 以下のパスに移動:
   ```
   HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem
   ```
3. `LongPathsEnabled` を探す（なければ作成）
4. 値を `1` に設定
5. PC を再起動

#### 方法 2: グループポリシーエディタ

1. **Windows キー + R** → `gpedit.msc` と入力
2. **コンピューターの構成** → **管理用テンプレート** → **システム** → **ファイルシステム**
3. **「Win32 長いパスを有効にする」** を **有効** に設定
4. PC を再起動

#### 方法 3: プロジェクトフォルダを短いパスに移動

```powershell
# 例: C:\bot\ などの短いパスに移動
Move-Item C:\Users\VeryLongUserName\Documents\Projects\notebooklm-bot C:\bot
cd C:\bot
```

### 7.2 ファイアウォールエラー

**症状**: ボットが Slack に接続できない

**解決方法**:

1. **Windows Defender ファイアウォール** を開く
2. **「詳細設定」** をクリック
3. **「受信の規則」** → **「新しい規則」**
4. **「プログラム」** を選択 → Node.js のパスを指定
   ```
   C:\Program Files\nodejs\node.exe
   ```
5. **「接続を許可する」** を選択
6. すべてのプロファイル（ドメイン、プライベート、パブリック）にチェック
7. 名前: `Node.js - NotebookLM Bot`
8. **完了**

### 7.3 npm install エラー

**エラー例**:
```
npm ERR! code EACCES
npm ERR! syscall mkdir
```

**解決方法**:

#### 方法 1: PowerShell を管理者として実行

1. **Windows キー + X**
2. **「Windows PowerShell (管理者)」** を選択
3. プロジェクトフォルダに移動して `npm install` を再実行

#### 方法 2: npm キャッシュをクリア

```powershell
npm cache clean --force
npm install
```

### 7.4 Playwright ダウンロードエラー

**エラー例**:
```
Failed to download Chromium
```

**解決方法**:

#### 方法 1: プロキシ設定

会社のネットワークなどでプロキシを使用している場合:

```powershell
$env:HTTP_PROXY="http://proxy.example.com:8080"
$env:HTTPS_PROXY="http://proxy.example.com:8080"
npx playwright install chromium
```

#### 方法 2: 手動ダウンロード

```powershell
# 環境変数を設定してリトライ
$env:PLAYWRIGHT_BROWSERS_PATH="C:\playwright-browsers"
npx playwright install chromium
```

### 7.5 権限エラー

**エラー例**:
```
EPERM: operation not permitted
```

**解決方法**:

1. **アンチウイルスソフトを一時的に無効化**
2. `user-data` フォルダや `node_modules` を除外リストに追加
3. PowerShell を管理者として実行

### 7.6 文字コードエラー

**症状**: ログに文字化けが発生

**解決方法**:

PowerShell の文字コードを UTF-8 に設定:

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001
npm run bot:start
```

---

## 8. Windows 固有の注意事項

### 8.1 パス区切り文字

このプロジェクトは **クロスプラットフォーム対応** です:
- Node.js の `path` モジュールを使用しているため、Windows のバックスラッシュ (`\`) を自動処理
- 環境変数やパス指定は `/` でも `\` でも動作します

### 8.2 ファイルロック

Windows ではファイルが開かれている間、他のプロセスがアクセスできません:
- ボット実行中は `user-data` フォルダ内のファイルを開かないでください
- データベースファイル (`./data/bot.db`) も同様

### 8.3 バックグラウンド実行

#### 方法 1: Windows タスクスケジューラ

1. **タスクスケジューラ** を開く
2. **「タスクの作成」** をクリック
3. **全般**: 名前を `NotebookLM Bot` に設定
4. **トリガー**: **「スタートアップ時」** を選択
5. **操作**: **「プログラムの開始」**
   - プログラム: `C:\Program Files\nodejs\node.exe`
   - 引数: `C:\bot\dist\index.js`
   - 開始: `C:\bot`
6. **条件**: 「コンピューターを AC 電源で使用している場合のみタスクを開始する」のチェックを外す
7. **OK**

#### 方法 2: PM2 on Windows

```powershell
# PM2 をインストール
npm install -g pm2
npm install -g pm2-windows-startup

# 自動起動を設定
pm2-startup install
pm2 start npm --name "notebooklm-bot" -- run bot:start
pm2 save
```

### 8.4 環境変数の永続化

システム環境変数として設定（オプション）:

1. **Windows キー + X** → **「システム」**
2. **「システムの詳細設定」** → **「環境変数」**
3. **「新規」** をクリックして追加:
   - 変数名: `SLACK_BOT_TOKEN`
   - 変数値: `xoxb-your-token`
4. すべてのトークンを追加
5. **OK** → PC を再起動

**注意**: セキュリティ上、`.env` ファイルの使用を推奨します。

---

## 9. パフォーマンス

Windows 環境でのパフォーマンスは Mac/Linux と **ほぼ同等** です:

| 処理 | 所要時間 |
|------|---------|
| 音声解説生成 | 約 10-15分 |
| 動画解説生成 | 約 2-5分 |
| 並列生成 | 約 12-16分 |

**最適化のヒント**:
- SSD を使用する
- メモリは 8GB 以上推奨
- バックグラウンドアプリを最小限に

---

## 10. セキュリティ

### 10.1 ファイアウォール設定

- Node.js の **アウトバウンド接続** のみ許可
- インバウンド接続は不要（Socket Mode を使用）

### 10.2 環境変数の保護

```powershell
# .env ファイルの権限を制限（PowerShell 7+）
icacls .env /inheritance:r /grant:r "$env:USERNAME:F"
```

### 10.3 Windows Defender 除外

パフォーマンス向上のため、以下を除外リストに追加:

1. **Windows セキュリティ** を開く
2. **「ウイルスと脅威の防止」** → **「設定の管理」**
3. **「除外」** → **「除外の追加または削除」**
4. 以下を追加:
   - `C:\bot\node_modules\`
   - `C:\bot\user-data\`
   - `C:\bot\data\`

---

## 11. まとめ

Windows 環境でも Mac/Linux と同様に NotebookLM Slack Bot を実行できます。

**重要なポイント**:
- ✅ Node.js 20.x LTS 以上をインストール
- ✅ Playwright Chromium をインストール
- ✅ `.env` ファイルで環境変数を設定
- ✅ ファイアウォールで Node.js を許可
- ✅ 長いパスを有効化（必要に応じて）

**問題が発生した場合**:
- [トラブルシューティング](#7-トラブルシューティング) を確認
- GitHub Issues に報告
- [setup-guide.md](./setup-guide.md) の共通手順も参照

---

**Happy Botting! 🤖**
