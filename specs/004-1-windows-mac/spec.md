# Feature Specification: Cross-Platform Support and Multi-Bot Handling

**Feature Branch**: `004-1-windows-mac`
**Created**: 2025-10-13
**Status**: Draft
**Input**: User description: "1. Windows 環境で動くようにしたい。今は、Macでは、挙動を確認できたので、Windowsで起動を行えるようにするための方法をまとめてほしい。対応が必要ならコードでの対応を行う。これはP1 で対応する

2. 同時に複数のSlack Bot App からのリクエストを受けられるようにする。
受けたSlack Bot からのレスポンスにきちんと戻せるようにする。
これはP2。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Windows Environment Support (Priority: P1)

開発者がWindows環境でNotebookLM Slack Botを起動・実行できる。現在はMac環境でのみ動作確認済みだが、Windows環境でも同じ機能が問題なく動作する必要がある。

**Why this priority**:
- Windows環境は多くの企業で標準的に使用されている
- Mac専用では利用できるユーザーが限定される
- クロスプラットフォーム対応は基本的な要件
- 既存のMac実装が動作しているため、Windows対応は比較的明確

**Independent Test**: Windows PCでボットを起動し、Slackメンションに対して正常に音声・動画要約が生成され、Mac環境と同じ結果が得られることを確認する

**Acceptance Scenarios**:

1. **Given** Windows環境にNode.js 20+がインストールされている、**When** `npm install`を実行する、**Then** すべての依存関係が正常にインストールされる
2. **Given** Windows環境でボットが起動している、**When** SlackでURLをメンションする、**Then** Mac環境と同じように音声・動画要約が生成される
3. **Given** Windows環境でPlaywrightが実行されている、**When** NotebookLMの自動操作を実行する、**Then** ブラウザが正常に起動し、UI操作が正常に完了する
4. **Given** Windows環境でファイルパス処理が実行される、**When** データベースファイルやメディアファイルにアクセスする、**Then** パス区切り文字の違いによるエラーが発生しない

---

### User Story 2 - Multi-Bot Handling (Priority: P2)

複数の異なるSlack Bot App（異なるワークスペースまたは異なるボット設定）からのリクエストを同時に受け付け、それぞれのリクエスト元に正しく応答を返せる。

**Why this priority**:
- 複数のチームや組織で同じボットインスタンスを共有できる
- 運用コストを削減できる（1つのサーバーで複数ボットを処理）
- Windows対応（P1）が完了してから対応する方が効率的
- 現状は単一ボットで運用可能なため、P2が適切

**Independent Test**: 2つの異なるSlack Bot Appを設定し、それぞれからURLをメンションして、各ボットに正しい応答が返ることを確認する

**Acceptance Scenarios**:

1. **Given** 2つの異なるSlack Bot Appが設定されている、**When** Bot A と Bot B から同時にメンションを受ける、**Then** 両方のリクエストがキューに追加される
2. **Given** Bot AとBot Bからのリクエストがキューに存在する、**When** 処理が完了する、**Then** それぞれのリクエスト元のスレッドに正しく結果が投稿される
3. **Given** Bot Aのリクエストが処理中、**When** Bot Bからメンションを受ける、**Then** Bot Bのリクエストは正しくキューに追加され、Bot Aの処理完了後に処理される
4. **Given** 複数のボットからリクエストが来ている、**When** エラーが発生する、**Then** エラーメッセージは正しいボットのスレッドに投稿される

---

### Edge Cases

- Windows環境で長いパス名（260文字以上）を扱う場合の動作は？ → エラーメッセージを表示し、短いパス名を推奨
- Windows環境でのファイルアクセス権限エラーが発生した場合は？ → エラーメッセージをSlackに投稿し、管理者権限での実行を推奨
- 複数ボットで同じURLが同時にリクエストされた場合は？ → それぞれ独立して処理し、2つのノートブックを作成
- Bot設定（トークン）が無効な場合は？ → 起動時にエラーメッセージを表示し、設定の確認を促す
- Windows環境でPlaywrightのブラウザダウンロードが失敗した場合は？ → エラーメッセージを表示し、手動インストール手順を案内
- メモリ不足で複数ボットからのリクエストを処理できない場合は？ → エラーメッセージをSlackに投稿し、リクエストはキューに残す

## Requirements *(mandatory)*

### Functional Requirements

**US1: Windows Environment Support (P1)**

- **FR-001**: システムはWindows 10以降の環境で起動し、正常に動作しなければならない
- **FR-002**: システムはWindowsのパス区切り文字（バックスラッシュ）を正しく処理しなければならない
- **FR-003**: システムはWindows環境でPlaywrightブラウザを正常に起動し、NotebookLM自動操作を実行しなければならない
- **FR-004**: システムはWindows環境でSQLiteデータベースファイルを正常に作成・アクセスできなければならない
- **FR-005**: システムはWindows環境でCloudflare R2へのファイルアップロードを正常に実行できなければならない
- **FR-006**: システムはWindowsとMacの両環境で同一の機能を提供しなければならない
- **FR-007**: システムはWindows環境での起動手順とトラブルシューティング情報をドキュメントに含めなければならない

**US2: Multi-Bot Handling (P2)**

- **FR-008**: システムは複数の異なるSlack Bot Appからのリクエストを同時に受け付けなければならない
- **FR-009**: システムは各リクエストにボット識別子（Bot Token/App ID）を関連付けて保存しなければならない
- **FR-010**: システムは処理完了時、リクエスト元のボットを使用して正しいスレッドに応答を投稿しなければならない
- **FR-011**: システムはエラー発生時も、リクエスト元のボットを使用して正しいスレッドにエラーメッセージを投稿しなければならない
- **FR-012**: システムは環境変数または設定ファイルで複数のボット設定（トークン、App Token）を管理できなければならない
- **FR-013**: システムは各ボットのリクエストを独立して処理し、他のボットのリクエストに影響を与えてはならない

### Key Entities

**US2で追加されるエンティティ**:

- **Bot Configuration**: ボット設定情報（Bot Token, App Token, Bot識別子）
- **Request**: 既存のリクエストエンティティに「ボット識別子」フィールドを追加

## Success Criteria *(mandatory)*

### Measurable Outcomes

**US1: Windows Environment Support**

- **SC-001**: Windows環境でボットが正常に起動する成功率が95%以上
- **SC-002**: Windows環境での処理時間がMac環境と比較して±10%以内
- **SC-003**: Windows環境での全機能（音声・動画生成、Slack統合、R2アップロード）が100%動作する
- **SC-004**: Windows環境でのセットアップ時間が30分以内（ドキュメント整備により）

**US2: Multi-Bot Handling**

- **SC-005**: 複数ボットからのリクエストが100%正しいボットに応答される
- **SC-006**: 2つのボットから同時にリクエストを受けた場合、両方とも15分以内に処理が完了する（シリアル処理のため、最大30分）
- **SC-007**: ボット識別の誤りによる応答ミスが0件
- **SC-008**: 複数ボット対応後も、既存の単一ボット運用が影響を受けない（後方互換性100%）

## Assumptions

**US1: Windows Environment Support**

- Windows 10以降の64bit環境を想定
- Node.js 20+とnpmはユーザーが事前にインストール済み
- Windowsファイアウォール設定でNode.jsの通信が許可されている
- Playwright Chromiumのダウンロードに必要なインターネット接続がある
- 現在のコードはNode.js標準パスモジュールを使用している（プラットフォーム依存の低減）
- SQLiteはクロスプラットフォーム対応済み
- AWS SDK（R2用）はクロスプラットフォーム対応済み

**US2: Multi-Bot Handling**

- 各ボットは独立したSlack Workspace または 異なる設定を持つ
- 現在の実装はSocket Modeを使用しており、複数接続をサポート可能
- 各ボットのトークンは環境変数または設定ファイルで管理
- NotebookLMアカウントは共有（複数ボットでも1つのNotebookLMアカウントを使用）
- 処理はシリアルなので、複数ボットからのリクエストも順次処理される

## Scope

### In Scope

**US1: Windows Environment Support**
- Windows環境でのセットアップドキュメント作成
- パス処理のクロスプラットフォーム対応確認・修正
- Windows環境でのテストと動作確認
- Windows環境でのトラブルシューティングガイド

**US2: Multi-Bot Handling**
- 複数ボット設定の管理機能
- リクエストへのボット識別子の紐付け
- ボット別の応答送信機能
- ボット別のエラー通知機能

### Out of Scope

**US1:**
- Linux環境のサポート（将来対応を検討）
- Windows ARM環境のサポート
- 32bit Windows環境のサポート

**US2:**
- ボットごとの処理優先順位設定
- ボットごとの並列処理（NotebookLMアカウント制約により不可能）
- ボットごとの使用統計・分析機能
- 動的なボット追加・削除機能（再起動で設定反映を想定）
