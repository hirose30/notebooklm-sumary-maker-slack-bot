# Feature Specification: 複数Slackワークスペース対応

**Feature Branch**: `006-bot-slack-ws`
**Created**: 2025-10-15
**Status**: Implemented (US1 only)
**Input**: User description: "このBotを複数のSlack WSでも運用したい。他のSlack WS で動かしているBotからもリクエストを受けられるようにできると良い。リクエスト元は、レスポンスをするのに、管理が必要だが、生成物の管理については、同じR2に入れるなど問題ないと思う（そもそもパブリックなURLなので）"

## Implementation Decision

**Architecture Choice**: Environment Variable-Based Configuration (Option A+)

During implementation, the original OAuth-based approach (InstallationStore pattern) was found to conflict with a critical requirement: **Socket Mode-only operation without public HTTPS endpoints**. OAuth flows require publicly accessible `/slack/install` and `/slack/oauth_redirect` endpoints, which contradicts the existing deployment model.

**Chosen Approach**: Environment variable-based configuration with Slack API auto-fetch
- Each workspace requires only 2 environment variables: `SLACK_WSn_BOT_TOKEN` and `SLACK_WSn_APP_TOKEN`
- Workspace metadata (TEAM_ID, TEAM_NAME, BOT_ID, BOT_USER_ID) is automatically fetched from Slack API `auth.test` endpoint on startup
- Separate processes per workspace due to Socket Mode limitation (1 APP_TOKEN per process)

**Rationale**:
1. **No Public Endpoints Required**: Maintains Socket Mode-only deployment model
2. **Minimal Configuration Burden**: Only 2 env vars per workspace instead of 6+ manual settings
3. **Operational Simplicity**: Shell scripts (`start-ws1.sh`, `start-ws2.sh`) isolate workspace configurations
4. **Process Isolation**: Separate database files (`bot-ws1.db`, `bot-ws2.db`) and browser data (`user-data-ws1/`, `user-data-ws2/`) ensure complete workspace isolation

**Trade-offs Accepted**:
- Higher resource usage (separate Node.js process per workspace)
- Bot restart required to add new workspaces
- Manual Slack App creation per workspace (no automated OAuth installation flow)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 複数ワークスペースでのボット稼働 (Priority: P1)

管理者が複数の異なるSlackワークスペースに同じNotebookLMボットをインストールし、各ワークスペース用の独立したボットプロセス（`.env.ws1`、`.env.ws2`等の設定ファイルとstartスクリプト使用）で全てのワークスペースからのリクエストを受け付けて処理できる。各ワークスペースからのリクエストは正しいワークスペースに返信される。

**Implementation Note**: Socket Mode limitation (1 APP_TOKEN per process) により、各ワークスペースは独立したNode.jsプロセスで稼働します。

**Why this priority**: コア機能。複数ワークスペース対応の基盤となる最も重要な機能。これがないと他の機能は意味をなさない。

**Independent Test**: 2つの異なるSlackワークスペースにボットをインストールし、それぞれからURLリクエストを送信して、各ワークスペースの適切なスレッドに結果が返信されることを確認することで完全にテスト可能。

**Acceptance Scenarios**:

1. **Given** ボットが2つのワークスペース（WS-A、WS-B）に接続されている、**When** WS-AのユーザーがURLをメンションする、**Then** WS-Aのスレッドに受領確認と結果が返信される
2. **Given** ボットが複数ワークスペースに接続されている、**When** WS-BのユーザーがURLをメンションする、**Then** WS-Bのスレッドにのみ返信され、他のワークスペースには影響しない
3. **Given** 2つのワークスペースから同時にリクエストが来た、**When** ボットが両方を処理する、**Then** それぞれのリクエストが正しいワークスペースに返信される
4. **Given** 既存の単一ワークスペース設定がある、**When** 新しいワークスペースを追加する、**Then** 既存ワークスペースの動作に影響を与えず、新しいワークスペースでも動作する

---

### User Story 2 - ワークスペース別のリクエスト履歴管理 (Priority: P1)

各ワークスペースからのリクエストが独立して管理され、管理者は各ワークスペースごとのリクエスト履歴を確認できる。データベースには全ワークスペースのリクエストが保存されるが、ワークスペースIDで区別される。

**Why this priority**: データの整合性とトラブルシューティングに必須。どのワークスペースからのリクエストかを追跡できないと、問題発生時の対応が不可能になる。

**Independent Test**: 複数ワークスペースからリクエストを送信し、データベースを確認して各リクエストに正しいワークスペースIDが記録されていること、およびワークスペースごとにリクエストをフィルタリングできることを確認することで独立してテスト可能。

**Acceptance Scenarios**:

1. **Given** WS-Aからリクエストが送信された、**When** データベースを確認する、**Then** リクエストレコードにWS-Aの識別子が含まれている
2. **Given** 複数ワークスペースからリクエストがある、**When** 特定ワークスペースのリクエスト履歴を照会する、**Then** そのワークスペースのリクエストのみが返される
3. **Given** WS-Aでエラーが発生した、**When** ログを確認する、**Then** どのワークスペースでエラーが発生したか明確に識別できる

---

### User Story 3 - ワークスペース設定の追加・削除 (Priority: P2)

管理者が設定ファイルを編集することで、新しいワークスペースを追加したり、既存ワークスペースを削除したりできる。ボットを再起動すると新しい設定が反映される。

**Why this priority**: 運用管理に必要だが、最初は手動設定で対応可能。UIは後回しでも運用できる。

**Independent Test**: 設定ファイルに新しいワークスペースの情報（トークンなど）を追加し、ボットを再起動して、新しいワークスペースで動作することを確認することで独立してテスト可能。

**Acceptance Scenarios**:

1. **Given** 既存の設定ファイルがある、**When** 新しいワークスペースの設定を追加してボットを再起動する、**Then** 新しいワークスペースからのリクエストを受け付ける
2. **Given** 複数ワークスペースが設定されている、**When** 1つのワークスペースを設定から削除してボットを再起動する、**Then** 削除されたワークスペースからのリクエストは受け付けないが、他は正常動作する
3. **Given** 設定ファイルに不正なトークンが含まれる、**When** ボットを起動する、**Then** エラーログを出力し、そのワークスペースはスキップして他のワークスペースは正常起動する

---

### Edge Cases

- 同じワークスペースIDが重複して設定されている場合はどうするか？ → **実装**: 別プロセスアーキテクチャにより、この問題は発生しない（各プロセスは1つのワークスペースのみ管理）
- 1つのワークスペースの認証トークンが無効になった場合はどうなるか？ → **実装**: そのワークスペースプロセスのみエラーログを記録して終了し、他のワークスペースプロセスは正常動作を継続する
- ワークスペース設定が空（0個）の場合はどうするか？ → **実装**: `loadWorkspacesFromEnv()`が0件を返し、起動時にエラーメッセージを表示してプロセスは起動しない
- NotebookLM処理中に特定のワークスペースへの接続が切れた場合はどうなるか？ → **実装**: 処理は継続し、完了時に再接続を試みる。再接続できない場合はログに記録し、次回起動時に再試行する
- 生成されたメディアファイルはワークスペース間で共有可能か？ → **実装**: 可能（R2は共有、URLはパブリック）。データベースには生成元ワークスペースIDを記録する
- SQLite NULL uniqueness問題: `UNIQUE(team_id, enterprise_id)`制約で`enterprise_id`がNULLの場合、重複レコードが作成される → **実装**: DELETE-then-INSERT パターンで解決（`workspace-loader.ts`）
- Socket Mode制約: 1プロセスで複数のAPP_TOKENを使用できるか？ → **不可能**: Slack Bolt SDKのSocket Mode実装は1プロセスにつき1 APP_TOKENのみサポート。複数ワークスペースは別プロセスで対応

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムは各ワークスペース用の独立したプロセス（Socket Mode接続）で、各ワークスペースからのapp_mentionイベントを受信しなければならない
  - **Implementation**: 各プロセスは単一のAPP_TOKENでSocket Mode接続を確立（Socket Mode制約: 1 APP_TOKEN per process）
- **FR-002**: システムは各リクエストの送信元ワークスペースを一意に識別し、データベースに記録しなければならない
- **FR-003**: システムは受領確認メッセージ、完了メッセージ、エラーメッセージを必ず元のワークスペースの元のスレッドに返信しなければならない
- **FR-004**: システムは各ワークスペースごとに独立した.envファイル（`.env.ws1`、`.env.ws2`等）でSlack認証情報（`SLACK_WS1_BOT_TOKEN`、`SLACK_WS1_APP_TOKEN`）を管理しなければならない
  - **Implementation**: TEAM_ID、BOT_ID等のメタデータはSlack API `auth.test`エンドポイントから起動時に自動取得
- **FR-005**: システムは.envファイルから各ワークスペースの設定（BOT_TOKEN、APP_TOKEN）を読み込み、起動時にSlack APIから追加メタデータを取得しなければならない
- **FR-006**: 各ワークスペースは独立したデータベースファイル（`DB_PATH`環境変数で指定: `./data/bot-ws1.db`、`./data/bot-ws2.db`等）を使用し、workspace_idカラムで送信元を記録しなければならない
  - **Implementation**: 別プロセスアーキテクチャにより、データベースロック競合を回避
- **FR-007**: システムは生成されたメディアファイルを共有のR2バケットに保存し、パブリックURLを各ワークスペースで共有できなければならない
- **FR-008**: システムは既存の単一ワークスペース環境（`.env`ファイルの`BOT_TOKEN`、`APP_TOKEN`）から新しい.envファイルベースの構成（`.env.ws1`等）への手動移行を要求しなければならない
  - **Implementation**: 移行時に`.env`ファイルを`.env.ws1`にリネームし、`SLACK_WS1_BOT_TOKEN`、`SLACK_WS1_APP_TOKEN`形式に変更
- **FR-009**: システムは起動時にSlack API `auth.test`を呼び出してワークスペース認証情報を検証し、無効なワークスペースはログに記録してプロセス起動を中止しなければならない
- **FR-010**: システムは各ワークスペースを独立したプロセスで実行し、1つのワークスペースのエラーやクラッシュが他のワークスペースに影響しないようにしなければならない
  - **Implementation**: `start-ws1.sh`、`start-ws2.sh`等の個別起動スクリプト、プロセスマネージャー（pm2等）による複数プロセス管理

### Key Entities

- **Workspace**: 各Slackワークスペースを表す。一意のID、名前、Slackトークン（BOT_TOKEN、APP_TOKEN）、チームIDを含む
- **Request**: NotebookLM処理リクエスト。従来の属性に加えて、workspace_id（どのワークスペースからのリクエストか）を含む
- **Media**: 生成されたメディアファイル。ワークスペース間で共有されるが、生成元のrequest_id経由でワークスペースを追跡できる

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ボットは最低3つの異なるSlackワークスペースに同時接続し、各ワークスペースからのリクエストを正しく処理できる
- **SC-002**: 各ワークスペースからのリクエストは100%正しい送信元ワークスペースに返信される（誤ったワークスペースへの返信が0件）
- **SC-003**: 1つのワークスペースで発生したエラーや接続問題が、他のワークスペースのリクエスト処理に影響を与えない（分離率100%）
- **SC-004**: データベース内の全リクエストレコードにワークスペース識別子が記録されており、ワークスペース別のフィルタリングが可能
- **SC-005**: 新しいワークスペースの追加は、設定ファイル編集とボット再起動のみで完了し、コード変更は不要
- **SC-006**: 既存の単一ワークスペース環境から複数ワークスペース環境への移行が、データ損失なく実行できる

## Assumptions *(optional)*

- 全てのワークスペースで同じNotebookLMアカウントと認証情報を使用する（ワークスペースごとに異なるNotebookLMアカウントは不要）
  - **実装**: `USER_DATA_DIR`環境変数で各ワークスペースが独立したブラウザセッションを持つが、同じNotebookLMアカウントにログイン
- R2バケットは全ワークスペース共有で問題ない（生成されたメディアファイルのURLはパブリックなので、ワークスペース間で共有しても問題ない）
- ワークスペース設定の変更はボット再起動を伴う（ホットリロードは不要）
- 各ワークスペースは独立したSlack App/Botとしてインストールされている（同一のApp IDを共有するのではなく、各ワークスペースで個別にBotを作成）
  - **実装**: 各ワークスペースごとに個別のSlack App作成が必要（別のAPP_TOKEN）
- ワークスペース数は最大10程度を想定（大規模な数十～数百ワークスペースは想定外）
- 設定管理は.envファイルベースで、データベースや管理UIは不要
  - **実装**: `.env.ws1`、`.env.ws2`等の個別ファイルで管理
- Socket Modeを使用し、公開HTTPSエンドポイントは不要
  - **実装**: OAuth不使用、env-based configurationで対応
- クロスプラットフォーム対応（Unix/Linux/macOS、Windows 10/11）
  - **実装**: Bashスクリプト（`.sh`）とPowerShellスクリプト（`.ps1`）を提供

## Dependencies *(optional)*

- 既存のSlackBot実装（`src/services/slack-bot.ts`）
- 既存のデータベース実装（`src/lib/database.ts`）
- 既存のリクエストキュー実装（`src/services/simple-queue.ts`）
- SQLite データベース（`requests`テーブルにworkspace_idカラムを追加するスキーマ変更が必要）
- 設定ファイル読み込み機能（新規実装が必要）
- 各ワークスペースに個別にインストールされたSlack Botアプリ（各ワークスペースで個別にBot Tokenを取得）
- PowerShell 5.1+ (Windows環境でのみ必要)
