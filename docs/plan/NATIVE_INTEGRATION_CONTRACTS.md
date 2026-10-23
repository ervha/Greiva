# Native機能統合契約と未接続箇所一覧（M2）

2026-10-20策定。ロードマップ（`docs/plan/DEVELOPMENT_ROADMAP_20261020.md`）の **M2（native機能統合）** に向けた契約。以下の一覧は着手時点の差分であり、タイトルの更新状況は次節を正とする。

## 0. v0.99.0 / v0.100.0の接続範囲

- タイトル編集、一覧への反映、`title_ready` による保存可否確認、SQLiteへの意図の記録を接続。文字数とUTF-8長は0〜4096、制御文字不可。空タイトルも下書き復元の対象。
- 版付きbaseとbootstrap受領が揃わない場合、タイトルはcontext付きメモリ下書き。画面で未保存を明示し、強制終了を超える保持を保証しない。本文の明示送信後「タイトルを取得」で版を読み、保持した意図を保存する。エラー文言の解析で保存成功を推定しない。
- 本文とタイトルは独立した明示操作。「タイトルを送信」はnativeが元のwireを準備し、`/v1/workspaces/:workspaceId/pages/:pageId/metadata/rename`へ送信、受領を検証して記録する。「タイトルを取得」は同prefixの`/metadata/read`へnative生成リクエストを送る。callerはhandleとpageIdだけを渡す。
- HTTPとローカルACKは元のadmission/世代に束縛。結果不明では自動再送せず元wireを保持、既知受領のcommit未確認はnativeキャッシュからHTTPなしで再確認。再認証・logout・closeでキャッシュを破棄する。offlineからのリモート操作は拒否する。
- 保存中、メモリ下書き、未送信数不明、送信結果不明、受領記録未確認、競合、拒否を分けて表示。タイトル書き込みもsavingに数え、失敗したtailはdurableで拒否しつつ未処理rejectionを防ぐ。
- タイトルと本文のcompositionで移動/送受信を止め、取得待ち中と反映待ち中の両方で新しいタイトルを保護する。合成イベントのDocker回帰は実Microsoft IMEの受入を代替しない。
- 競合にbase/local/remoteと履歴は保持・表示する。
- **v0.100.0（タイトル競合明示解決UIと履歴paginationの接続）**:
  - `NativeLocalPageEditor` / `NativePageSession` に「この端末の候補を選ぶ」「サーバーの候補を選ぶ」の解決選択UIを追加。未確定キュー（`titlePending > 0`）や保存中は解決選択を無効化し、`title_enqueue`へ明示的なresolution意図を記録してSQLite側の競合前提条件（`predecessor.is_none()`、`resolved_by.is_none()`）と整合。
  - 拒否されたタイトル変更（`titleRejected`）の表示セクションを追加。
  - タイトル操作履歴および競合一覧のキーセットページネーション（`titleHistory(more)`、`titleHasMore`）を追加。
- **次の統合単位**: Task/Relation（M2-②）、基本DB（M2-③）、M1の最新実機受入。

---

## 0.2. Task／Relationのnative通信基盤（v0.101.0）

この単位はM2-②の通信基盤。Task／Relationの新native画面への統合は次のPRとし、M2-②全体の完了とは扱わない。

- `native_structured_send(handle)`はSQLiteから1操作分の元wireを準備し、`/v1/workspaces/:workspaceId/sync/push`へ送信。`idle / acknowledged / conflict / rejected / send_unknown / ack_pending`を返す。Conflictはbase/local/remoteを保持し、拒否結果も履歴に残す。
- `native_structured_pull(handle)`はSQLiteのcursorからnativeで要求を構築し、同prefixの`sync/pull`へ1操作分（limit=1）を問い合わせる。`received`の場合だけ`hasMore`を返す。cursor、原文応答、tokenはWebViewへ返さない。続きも明示操作とし、この基盤は自動ループしない。
- 送受信は同一workspace内で直列化。元admission/認証世代/handleをHTTP開始時と結果採用時の双方で検査し、logout・再認証・close・失効後の遅着は採用しない。offlineからremoteを呼ばない。
- 応答は既存ACK/Pullと同じSQLite処理をrollback付きで検証してからnativeキャッシュへ保持する。scope、操作ID、保存済みwire、結果schema、cursor進行が不正な応答を既知受領として残さない。
- 既知応答のローカルcommitが未確認なら`ack_pending / store_pending`。明示再確認ではnativeキャッシュから同じ応答を適用し、HTTPを繰り返さない。別の方向の送受信は、その保存確認が終わるまで拒否する。close/logout/再認証ではキャッシュを破棄し、元の永続queueを保つ。
- WebViewのローカルcommand whitelistには`ack / pull / structured_validate_* / structured_pull_request`を追加しない。callerがwire、ACK、cursor、任意のresponseを与える入口は再開放しない。検証専用commandもnative内部からだけ使う。
- HTTP上限は送信wire/応答2 MiB、取得応答16 MiB。既存の他のtransport上限、Page本文同期、タイトル同期、DB schemaは変更しない。
- 型付きclient portまでは接続済み。UI、購読session、競合解決導線、取得完了/未送信の表示、実Windows入力受入は次の統合単位。

---

## 0.3. Task／Relation UIとnative session統合（v0.102.0）

この単位はM2-②のUI・セッション統合段階。Task／Relationを新native workspace（`NativeLoginController` / `NativeAuthScreen` / `NativeStructuredSession` / `PrivateStructuredPanel`）に統合。

- `NativeStructuredSession` は `NativeStructuredPort`（snapshot / mutate / sendStructuredFor / pullStructuredFor）を保持し、ローカル32フレーム有界バッチ同期、snapshotの不変凍結、mutate再試行（`retryMutation`）、セッション失効ガードを提供。
- `NativeLoginController` が structured session をライフサイクル管理（`#openStructured` / `#closeStructured`）。画面選択・再接続・ログアウト・offline切替時に安全に破棄・再生成。
- `structuredDraft`（`setStructuredDraft`）フラグと native composition ガードにより、タスク・リレーション入力中の不用意なPage切替やログアウト・再接続を保護。
- `PrivateStructuredPanel` を Web／Native 両セッション契約に対応させ、Task作成・状態更新・アーカイブ、Relation作成・削除のGUIをネイティブ環境へ完全露出。
- Windows実機/Microsoft IMEでの実入力受入、基本DB（M2-③）、M1実機受入は次以降の統合単位。

## 1. 安全境界原則（セキュリティ・整合性契約）

新native入口への機能統合においては、以下の安全境界を例外なく維持する。

1. **生トークン（Raw Token）・クレデンシャル非露出**:
   - Supabase access token、暗号化キー、署名秘密鍵、内部API bearer token を WebView（フロントエンドJS）へ渡さない。
   - リモート通信（送受信・ACK・Pull・Catalog）は必ず Rust ネイティブ側の `NativeWorkspaceGate`（認証済みセッション）が安全に代行する。
2. **Caller-Owned 認証・勝手なACKの再開放禁止**:
   - フロントエンドが任意のワイヤやACKを偽造してSQLiteに書き込む従来の脆弱な経路（`workspace_execute` 経由での不正なACK等）を許容しない。
   - 承認済みセッション（`WorkspaceAdmission`: workspaceId, streamEpoch, clientId）にすべての通信・ACK・cursor を束縛する。
3. **世代（Generation）・Admission 束縛**:
   - アカウント切り替え、ログアウト、再接続、セッション失効が発生した場合、古い世代の handle による遅着レスポンスやコミットを即座に破棄する。
4. **ローカル永続化先行とオフライン耐性**:
   - ユーザー入力はまずローカル SQLite（またはメモリ下書き）へ安全に記録され、ネットワーク通信と独立して耐久性を保つ。
   - オフライン時はリモート通信を試みず、ローカル実行可能なコマンド（`local_command`）のみを許可する。

---

## 2. 領域別 未接続箇所一覧

### ① タイトル / メタデータ連携（M2-①）

| レイヤ | 現状の実装 | 新nativeでの未接続箇所・必要な変更 |
| --- | --- | --- |
| **Rust / SQLite** | `private_title.rs` に `title_enqueue`, `title_prepare`, `title_ack`, `title_receive`, `title_load` 実装済み。 | 接続済み（`WorkspaceRegistry` / `local_command` で許可済み）。 |
| **Rust / Gate** | `NativeWorkspaceGate` に `send_page_status`, `read_page`, `catalog_pages` のみ存在。 | タイトルの安全な送信（`title_send`）・受信（`title_read`）または Page 送受信との連動が必要。 |
| **API / Server** | `/v1/workspaces/:workspaceId/pages/:pageId/metadata/rename`, `/metadata/read` エンドポイント提供済み。 | 接続可能（既存エンドポイントを再利用）。 |
| **TS / Client** | `NativePageSession` は初期ロード時の title のみ保持。`setTitle` が未実装。 | `NativePageSession.setTitle(title)` を実装し、ローカルへのタイトル変更キューイング（`title_enqueue` または `page_create`/メタデータ更新）を接続。 |
| **UI / Screen** | `NativeLocalPageEditor` で `session.setTitle` が渡されず、input が readOnly。 | タイトル入力欄を活性化し、ローカル保存・Page一覧（`NativeAuthScreen` の `state.pages`）のタイトル反映を連動。 |

### ② Task / Relation 連携（M2-②）

| レイヤ | 現状の実装 | 新nativeでの未接続箇所・必要な変更 |
| --- | --- | --- |
| **Rust / SQLite** | `structured.rs`, `structured_sync.rs` に `tasks`, `relations` テーブル、`snapshot`, `mutate`, `prepare`, `ack`, `pull` 実装済み。 | 接続済み（`WorkspaceRegistry` / `local_command` で許可済み）。 |
| **Rust / Gate** | `NativeWorkspaceGate` に structured のリモート送受信メソッドが未定義。 | 接続済み（`structured_send`, `structured_pull` を Gate に追加済み、v0.101.0）。 |
| **API / Server** | `/private/workspaces/:workspaceId/structured/mutate`, `/pull` 提供済み。三値Conflict（applied / stale / conflict）処理あり。 | 接続済み（既存エンドポイントを再利用）。 |
| **TS / Client** | 旧 `PrivateStructuredSession` が存在するが、新native入口（`NativeLoginController`）には未接続。 | 接続済み（`NativeStructuredSession` / `NativeStructuredPort` を `NativeLoginController` に統合、v0.102.0）。 |
| **UI / Screen** | `NativeAuthScreen` に Task/Relation の表示・操作UIがない。 | 接続済み（`PrivateStructuredPanel` を `NativeAuthScreen` に統合、v0.102.0）。 |

### ③ 基本データベース（Source / View / Record）連携（M2-③）

| レイヤ | 現状の実装 | 新nativeでの未接続箇所・必要な変更 |
| --- | --- | --- |
| **Rust / SQLite** | `private_database.rs` に `database_source_*`, `database_view_*`, `database_record_*` 等全コマンド実装済み。 | 接続済み（`WorkspaceRegistry` / `local_command` で許可済み）。 |
| **Rust / Gate** | リモート同期メソッドが未定義。 | 安全な Database 送受信メソッドの Gate 追加。 |
| **API / Server** | `/private/workspaces/:workspaceId/database/*` 提供済み。 | 接続可能（既存エンドポイントを再利用）。 |
| **TS / Client** | 旧 `PrivateDatabaseSession` 等が存在するが新nativeには未接続。 | 新nativeセッションポートへの組み込み。 |
| **UI / Screen** | `NativeAuthScreen` に Database の一覧・テーブル/リスト表示がない。 | 基本DB定義・レコード編集・ビュー切り替えのUI統合。 |

---

## 3. M2-①（タイトル/metadata変更受信）の具体的設計

M2-① では、安全境界を維持しつつ最も小さく確実に動作する以下のフローを確立する。

### 3.1. ローカル入力とタイトル変更保存
1. `NativePageSession` に `setTitle(title: string)` を追加。
   - `PageEditor` のタイトル変更ハンドラ（`onChange`）から呼び出し可能にする。
   - 入力文字数の検証（0〜4096文字、制御文字検証）を行う。
2. タイトル変更はローカルストアへ即時反映：
   - `executeFor(handle, { command: 'title_enqueue', pageId, intent: { operationId, title } })` を実行。
   - セッションの `snapshot.title` を更新し、リスナーへ通知。
   - 親コントローラー（`NativeLoginController`）へタイトル変更を通知し、Page一覧（`state.pages`）の該当タイトルの表示をリアルタイムに更新。

### 3.2. リモート送受信との連携
1. 送信時（`sendPage`）:
   - 本文（`page_send`）だけでなく、保留中のタイトル変更（`title_prepare`）が存在する場合に安全にサーバーへ反映し ACK を記録する経路を整理。
2. 受信時（`readPage` / `catalogFor`）:
   - サーバー側で更新されたタイトルおよびメタデータを取得し、ローカルストアおよびエディタ表示へ正しく反映。

---

## 4. 実施順序

1. **契約書の作成と scratch 記録**（本ステップ）
2. **`NativePageSession` へのタイトル変更機能の追加（ローカル保存・検証）**
3. **`NativeLoginController` および `NativeAuthScreen` のタイトル双方向反映**
4. **単体テスト・画面回帰テストの作成と検証**
5. **PR作成、CI通過、マージ、v0.99.0 タグ付け**
