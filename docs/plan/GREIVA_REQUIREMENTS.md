# Greiva 統合要件・アーキテクチャ仕様 v0.6

## 1. 文書の目的と位置付け

この文書は、Greivaの本番アーキテクチャ、製品境界、データ責務、および非機能要件について、現時点で合意した内容を統合するものである。`POC_SPEC.md` は技術仮説を検証するための限定仕様であり、本書はPoC後の本実装に引き継ぐべき要件を定義する。

未確定項目は実装者が独断で補完してはならない。「要決定」としてADRまたは個別仕様へ切り出す。

2026-09-30改訂: ユーザーの追加要求により、時間割・汎用定期予定の登録とCalendar表示を製品要件へ追加した。時間割は曜日＋時限を基本とし、時刻の直接指定にも対応する。曜日ごとの繰り返し、休講・振替・補講に相当する取消・変更・追加を扱う。大学専用にはせず、学期と時限は任意の設定として扱う。詳細設計案は`CALENDAR_TIMETABLE_SPEC.md`を参照する。この改訂はPoCの実装範囲・順序・Gateを拡張しない。

同日v0.3改訂: ユーザー指定により、ヘルプページと関連する利用案内を製品要件へ追加した。詳細案は`HELP_SUPPORT_SPEC.md`を参照する。

同日v0.4改訂: 将来のAI機能として、文章・音声からのPage作成、Task・予定登録と、アプリが提供する操作への段階的対応を追加した。共通の操作基盤の案と未決定事項は`AI_ACTION_SPEC.md`にまとめる。

2026-10-01 v0.5改訂: AI初期提供は作成・登録・録音整理、入口は共通パネル＋各画面、音声はアプリ内録音＋既存ファイル取込み、会話履歴は初期30日・期間変更・手動削除とする一括回答を反映。元録音は端末内を基本にし、選んだものだけクラウド保存する。提供時期は未決定で、PoCの範囲を変更しない。

2026-10-01 v0.6改訂: アプリ内更新を製品要件へ追加。起動時・定期検知、利用者が開始するダウンロード、「今すぐ更新／後で」と再起動前の確認を合意済み。保存済みの未送信データを保持する詳細案は`APP_UPDATE_SPEC.md`。未実装でありPoCの範囲を変更しない。

## 2. 製品原則

1. **Local-first**: ユーザーの確定した変更は、ネットワークがなくても端末に保存され、後から同期できる。
2. **Correctness over realtime**: Realtimeは体験改善であり、正確性の基盤ではない。WebSocketが停止してもcursor同期で回復できる。
3. **CRDTとStructured Syncの分離**: Page本文はCRDT、構造化データはoperation/cursor同期で扱う。両者の正本や競合規則を混同しない。
4. **明示的な競合保持**: 異なるfieldの変更は自動mergeする。同じfieldの意味的競合は、黙って片方を消さず、ユーザーが解決できる形で残す。
5. **Domain/UI/Infrastructureの分離**: UI、Domain、同期プロトコル、DB実装は相互に直接依存させない。
6. **PoCの本番化を禁止**: PoCで得た結論・テスト・設計は利用するが、PoCの妥協やコードを無審査で本番へ持ち込まない。

## 3. 対象プラットフォーム

| Surface | 方針 | ローカルデータ |
| --- | --- | --- |
| Windows | Tauri 2 desktopを主要対象とする | SQLite |
| Android | Tauri 2実アプリとして重点検証・提供対象とする | SQLite |
| macOS / iOS | 対応可能な設計を維持し、機材・署名環境が整い次第検証する | SQLite |
| Web | React Webアプリを提供する | SQLite WASM + OPFSを主、IndexedDBをfallback |

Apple実機の可否により、Domain、Editor、CRDT、Sync Protocolの再設計が必要になる構造は採用しない。

## 4. 採用アーキテクチャ

### 4.1 技術スタック

| Layer | 採用方針 |
| --- | --- |
| Language | TypeScript |
| UI | React |
| Native shell | Tauri 2 |
| Editor | Tiptap / ProseMirror |
| CRDT | Yjs |
| Collaboration | Hocuspocus |
| Native local DB | SQLite（Tauri SQL経由） |
| Web local DB | SQLite WASM + OPFS（Web Worker内）、fallbackはIndexedDB |
| Web CRDT persistence | y-indexeddb |
| API | Node.js + NestJS、Fastify adapter |
| DB access | Repository Interfaceの背後でDrizzle |
| Server DB | PostgreSQL |
| Auth | Supabase Auth |
| Infrastructure | Supabaseを第一候補とし、PostgreSQL/Object Storageを利用 |
| Structured sync | Greiva独自operation/cursor protocol |
| Realtime | WebSocket notification。正確性はpull同期で保証 |
| External sync | Provider Adapter |
| Calendar | 内蔵Calendar・汎用定期予定/時間割モデル、外部連携はGoogle Calendar API / Provider Adapter |
| Monorepo | pnpm workspace + Turborepo |
| Web E2E | Playwright（Chromium / Firefox / WebKit） |

### 4.2 リポジトリ構造（本番）

```text
greiva/
├─ apps/
│  ├─ web/
│  ├─ desktop-mobile/
│  ├─ api/
│  ├─ worker/
│  └─ collaboration/
├─ packages/
│  ├─ domain/
│  ├─ application/
│  ├─ protocol/
│  ├─ sync/
│  ├─ editor/
│  ├─ crdt/
│  ├─ database/
│  ├─ commands/
│  ├─ ui/
│  └─ shared/
├─ database/migrations/
└─ docs/
```

依存方向は `UI -> application -> domain` とし、DB、HTTP、Supabase、Drizzle、Tauri、Yjs/Hocuspocus等はadapter層からのみ参照する。Domainは特定DBやUIフレームワークに依存しない。

## 5. データの責務と正本

| データ | クライアントの保持 | サーバー側の正本 | 同期方式 |
| --- | --- | --- | --- |
| Page本文 | Yjsローカル永続化 | Y.Doc binary snapshot/update | Yjs + Hocuspocus |
| Pageの検索/表示用Projection | キャッシュ可 | Tiptap JSON / plain text projection | CRDTから再生成 |
| Task / Relation等の構造化データ | SQLite replica + sync state | PostgreSQL entity + operation履歴 | operation push/pull + cursor |
| 時間割・定期予定 / 時間帯設定 / 繰り返し / 取消・変更・追加 | SQLite replica + sync state | PostgreSQL entity + operation履歴 | structured sync。Calendarの各回表示は再生成可能なProjection |
| User / session | 必要最小限の端末情報 | Supabase Auth | Auth SDK / API |
| 添付ファイル | ローカルキャッシュ可 | Object Storage | upload/download adapter |

### 5.1 CRDT永続化

- Y.Doc binaryがPage本文の一次正本である。JSONへ変換したものを正本にして再構築しない。
- サーバーは`crdt_documents`相当の保存領域に、`document_id`、`workspace_id`、`snapshot`、`schema_version`、`updated_at`を保持する。
- Tiptap JSONおよびplain textは検索、preview、export、AI、indexer用のProjectionであり、破損時にはY.Docから再生成可能であること。
- updateを無制限に積み上げず、閾値によりsnapshot化・compactionを行う。これはユーザー向けVersion Historyの削除を意味しない。

### 5.2 Local structured store

端末側SQLiteには、正規化したアプリデータに加え、少なくとも`sync_queue`、`sync_cursor`、`conflicts`、`local_settings`を持つ。サーバーのPostgreSQL schemaとの物理的一致は要求しない。ローカルDBはlocal-first replicaと同期状態を担う。

### 5.3 IDと順序

- クライアント生成IDはUUID v7または同等の一意IDとする。
- 端末時計は操作の正規順序・競合解決の根拠に使わない。
- サーバーが操作ID、entity version、cursorを採番する。

## 6. ドメインの最小モデル

PoC後の詳細スキーマは`DATA_MODEL.md`で定義する。ここでは境界を固定する。

- **Workspace**: データ分離、メンバーシップ、権限の境界。
- **Page**: メタデータとY.Docへの参照を持つ。本文ブロックを構造化DBへ二重保存しない。
- **Task**: title、status、due等の構造化属性を持ち、version付きoperationで同期する。
- **Relation**: Page/Task等のentity間のリンク。削除はtombstoneを用いる。
- **Schedule**: 定期予定・曜日ごとの繰り返し規則・一回単位の取消/変更・追加予定を扱う汎用の構造化モデル。時間割では学期と時限を設定できるが、大学固有の必須属性にはしない。論理境界の案は`CALENDAR_TIMETABLE_SPEC.md`、最終schemaは`DATA_MODEL.md`で定義する。開催時刻とTaskのdate-only dueを分離する。
- **Conflict**: 同一fieldの競合についてbase/local/remote/field/status/解決operationを保持する。
- **Event / Operation**: 同期用の不変記録。クライアント再送に耐える冪等キーを持つ。

汎用プロパティ、record、entityの最終抽象化レベルは要決定である。初期段階ではTaskとRelationを明示モデルとし、早期のEAV化は避ける。

## 7. 同期要件

### 7.1 Structured sync

- クライアントの変更は、ローカルentity更新とoperation enqueueを単一トランザクションで確定する。
- pushは`operationId`を冪等キーとし、ACK喪失後の同一operation再送で二重作成・二重更新を起こさない。
- pullはcursor以降の操作を順序付きで取得し、ローカル適用成功後にのみcursorを進める。
- 起動・再接続時は、ローカル復元、pull、pending push、再pullの順で収束させる。
- WebSocket通知を受けられなくても、cursor pullで完全に復旧する。

### 7.2 競合規則

- 異なるfield: 自動mergeして双方の変更を保持する。
- 同じfield: `base`、`local`、`remote`を含むConflictを作成する。受信順LWWで黙って一方を破棄しない。
- Conflict解決: ユーザーが候補を選択するか、明示入力した値で新しいoperationを作る。
- 削除対更新: 削除を優先し、更新側はtombstoneへ収束する。
- Conflictと解決履歴は追跡可能に保持する。

### 7.3 外部連携

Google Calendar等の外部同期はProvider Adapterを経由する。Domainまたはsync coreが特定Provider APIへ直接依存してはならない。双方向同期規則、権限、rate limit、削除・競合の扱いは、個別の`INTEGRATION_SPEC.md`で確定する。

## 8. 製品機能要件

### 8.1 Page / Editor

- ブロック型のPage編集、見出し、リスト、Todo、引用、コード、divider、toggleを提供する。
- Slash Command、Mention、Drag & Drop、Undo/Redo、Markdown shortcutを提供する。
- 日本語IMEで、入力、変換、確定、再変換、選択、削除、Undo/Redoを日常利用可能な品質で提供する。
- 同時編集とoffline/reconnect後に、Yjs stateが収束する。

### 8.2 Task / Relation

- Taskの作成、変更、完了状態、期日を扱う。
- PageとTaskを含むentity間Relationを扱う。
- offlineで作成・変更・削除でき、再接続後に同期される。
- 異fieldの更新は自動で保持し、同field競合は解決可能なConflictとして提示する。

### 8.3 主画面・Inbox・Calendar・View

Home、Inbox、Board Viewは製品機能として候補に含むが、要求詳細、優先順位、初期リリース範囲は未確定である。Calendarには時間割・汎用定期予定を登録・表示する製品要件を追加する。いずれもPoCには含めない。本実装前に、それぞれの利用者、主要ジョブ、情報構造、操作、受入条件を個別仕様にする。

#### Calendar / 時間割・定期予定

- Greiva内で時間割・定期予定を登録し、通常のCalendarビューに各回を表示できる。Google Calendar接続を利用条件にしない。
- 時間割は曜日＋時限（1限・2限等）を基本の登録方法とし、利用者が時限の開始・終了時刻を設定できる。汎用予定は時刻の直接指定や「午前」「早番」等の時間帯プリセットでも登録できる。
- 予定名、繰り返す曜日、適用期間を管理する。学期・終了日・時限は大学等の利用時に設定できるが、定期予定すべてに必須にはしない。
- 原則の曜日ごとの繰り返しと、特定の回の取消（休講等）・日時変更（振替等）・追加（補講等）を分離する。例外を登録しても他の回を意図せず変更しない。
- 定期予定の変更範囲は「この回だけ／この回以降／全体」を選べるようにする。「この回以降」は過去の予定を保持し、既存の休講・振替への影響を変更確定前に示す。
- まとめて変更する際は既存例外の引き継ぎ案を自動で用意し、一覧で確認・修正してから確定する。休講は対応する回へ引き継ぎ、振替先の日時は保持する。対応先を判断できない例外は個別に確認し、無断で破棄しない。
- 通常予定と時間割・定期予定を識別でき、表示切替できる。予定の重複を隠さず、内容・日時・例外の種別を確認できる。
- 登録・編集・閲覧は既存のlocal-first / structured sync方針に従う。繰り返し定義と例外・追加予定が正本であり、表示する各回を重複した独立予定として保存しない。
- 詳細UI、時刻・例外・変更範囲のルール、受入条件は`CALENDAR_TIMETABLE_SPEC.md`で整理する。初期リリースの採用時期、外部カレンダー同期、インポート、通知、Page/Taskとの連携は要決定とする。

### 8.4 認証・権限・共有

- 認証はSupabase Authを採用候補とする。
- Workspace、member、role、resource accessの境界を持つ。
- 共有と完全な権限モデルはPoC対象外であり、初期リリース前に認可モデルとRow Level Security方針を確定する。

### 8.5 検索・AI・通知・ファイル

検索、通知、file storage、automation、plugin、public APIはアーキテクチャ上の拡張境界のみを確保する。初期実装の必須機能とは見なさず、個別のプロダクト判断なしに追加しない。AIは下記の将来機能の方向を追加し、具体的な提供時期・範囲は別途決める。

#### 将来のAI・文章/音声操作

- 文章・音声入力からPageを作成し、Task・予定を登録できるようにする。将来追加するアプリ操作にも段階的に対応する。
- AI初期提供は作成・登録・録音整理から開始し、既存編集・削除とAIへの検索依頼は順次追加する。作成に必要な現在の対象・関連データの読み取りは初期段階から使う。アプリ初期リリースへの同時搭載を意味しない。
- 共通AIパネルと各画面の文脈からの入口を併用し、同じ操作基盤・確認方針を使う。具体的な配置・platform別UIは後続設計で定義する。
- 音声入力元はアプリ内録音と利用者が選んだ既存音声ファイルとする。取込みはアプリ管理下へのコピーとし、保持期限で元のファイルを削除しない。対応形式・長さ/容量上限は未決定。
- 音声は短い操作指示に加え、会議・講義等の長い録音からPage作成とTask・予定候補の抽出に対応する。抽出候補は一覧から登録したいものを選び、一括登録する。Pageは要点を整理したノートと折りたたんだ全文文字起こしで構成する。
- アプリ側の元録音は初期設定で30日間保存し、期間を変更できる。期限後は元録音を削除し、作成したPageと文字起こしは保持する。
- 元録音は基本は端末内とし、必要な録音だけ利用者が選んでアプリのクラウドへ保存できる。Page/文字起こしの同期、音声のクラウド保管、AI Providerへの送信は分ける。保存・削除処理の詳細、候補の保持・処理上限、外部Provider側の保持条件は別途決める。
- AIによる解釈を、通常の画面操作と共通のapplication commandへ接続する案とする。Page本文のCRDT、構造化データの保存・同期、認可とConflictを迂回するAI専用経路を作らない。
- 提供中の操作だけを扱い、必要な対象・日時・変更範囲を検証し、実際の保存・実行結果を表示する。音声は認識結果を訂正できる設計とする。
- 新規作成は直接実行し、既存データの変更・削除は確認してから実行する。必要情報が曖昧な場合は質問で解決し、権限・入力検証を省略しない。
- AIは入力に加え、現在のPage・予定と、それに関連するノートやTaskを参照できる。関連先でも認可を通し、無関係なworkspaceデータの自動横断検索は今回の方針に含めない。
- 外部送信は初回設定で送信先・データの種類を許可し、その範囲内では毎回の確認を省略できる。後から変更・解除でき、許可範囲の拡大は追加の許可を得る。操作実行の確認とは別に扱う。
- アプリ側のAI会話履歴は初期30日保存で、期間変更・手動削除ができる。会話削除で作成したPage・文字起こし・Task/予定を削除したり再実行したりしない。元録音・実行識別・監査記録・Provider側の保持条件は別契約とする。
- AI/音声Provider、端末内対応、費用、提供時期、履歴の保存先・同期・期限適用、送信設定の保存・同期の詳細は未決定。設計の追加によってPoCへ実装しない。
- 詳細案・将来の受入条件は`AI_ACTION_SPEC.md`を参照する。

### 8.6 ヘルプ・利用案内

- アプリ内から利用方法と問題解決の手順を探せるヘルプページを提供する。ヘルプ専用の検索、カテゴリ、FAQ、ショートカット一覧を備える設計とする。ユーザーデータの全文検索とは別の機能境界とする。
- Page/Editor、Task/Relation、Calendar/定期予定・時間割、保存・同期・offline等について、提供中の機能に対応した案内を用意する。
- 画面やエラーから関連する説明へ直接移れる文脈ヘルプを提供し、編集内容と元の操作位置を保ったまま戻れるようにする。
- 最初の使い方や新機能の案内は、閉じる・後で読む・再表示ができる。長い必須ツアーや利用者の実データを勝手に書き換える練習は設けない。
- 基本ガイド・FAQ・重要な問題解決手順はアプリに同梱し、取得済みのアプリではofflineや未ログインでも参照できる。Webの初回offline起動の対応範囲は配信方針と合わせて確定する。説明はアプリ版、platform、機能の提供状態と対応させる。
- 診断情報の確認・コピー/書き出しへの導線を整理する。秘密情報と本文を含めず、利用者が内容を確認して選択した範囲だけ扱う。問い合わせ先と送信機能の具体化は別途決定する。
- 詳細な情報構造、記事管理、操作、受入条件は`HELP_SUPPORT_SPEC.md`で整理する。ヘルプUIや記事は本要求追加によってPoCへ先行実装しない。

## 9. 非機能要件

### 9.1 信頼性

- ユーザーが確定した変更を、offline、端末再起動、app kill、通信遮断で黙って失わない。
- APIまたはcollaboration serverの再起動後に自動回復し、重複適用・無限再送・cursor破損を起こさない。
- 同期エラー、ローカル永続化エラー、復元失敗を「同期済み」と誤表示しない。

### 9.2 性能と規模

初期目標は日常利用可能性であり、本番SLOは別途確定する。以下は破綻検知の必須テスト規模とする。

- Page: 100、1,000、10,000 block
- Task: 100、1,000、10,000 record
- pending operation: 100、1,000、10,000
- Yjs concurrent edits: 高頻度更新、offline/reconnect、block移動、nested block、Undo/Redoを含む

10,000 blockで全blockをDOMに置くことは要件ではない。性能問題が確認された場合、virtualization等は問題と証拠を踏まえて設計判断する。

### 9.3 互換性

- WindowsとAndroidをP0とし、日本語IME、ソフトウェアキーボード、text selection、copy/paste、scroll、background/resume、app kill、network switchingを実機で確認する。
- WebはChromium、Firefox、WebKitをPlaywrightで継続検証する。
- AndroidでWebViewベースの編集体験が日常利用に耐えない場合、FlutterまたはNative UIとの再比較を行う。場当たり的な回避で採用を継続しない。

### 9.4 セキュリティと運用

- 認証情報・refresh token・外部Provider tokenをログ、CRDT projection、同期operationに含めない。
- workspace境界を越えた読み書きを防ぐ認可テストを作る。
- DB migration、backup/restore、監査、監視、秘密情報管理、rate limitの本番要件は初期リリース前に確定する。

### 9.5 アプリ内更新

- desktopアプリで起動時・定期的に公開版の更新を検知し、利用者がダウンロードを開始できるようにする。設定から手動確認もできる。
- 取得後は「今すぐ更新／後で」を選び、終了・再起動前に確認する。IME compositionと端末保存を妨げず、保存済みの未送信データを保持する。
- 署名・platform・互換性を確認した配布物だけを導入し、取得/保存/導入/migrationの失敗を成功扱いにしない。詳細案は`APP_UPDATE_SPEC.md`。未実装の製品設計でありPoCの範囲・順序は変更しない。

## 10. テスト戦略

```text
Unit
  -> Integration
    -> Sync Simulation
      -> E2E / Real Device
```

- **Unit**: Domain規則、operation生成、merge、Conflict生成・解決、idempotency判定。
- **Integration**: Repository、Drizzle transaction、PostgreSQL、SQLite migration、Hocuspocus persistence。
- **Sync Simulation**: offline、duplicate、retry、out-of-order、timeout、server/client restart、同field競合、異field merge。
- **E2E / Real Device**: Editor、IME、app lifecycle、network switching、実端末での復旧。

Network Chaosではlatency、disconnect、reconnect、timeout、duplicate request、out-of-order response、server restart、client restart、app terminationを注入する。Happy Pathのみで同期の正しさを判断しない。

## 11. 段階的な成果物

PoCがGate A/B/Cを通過した場合、次の順で本番設計へ進む。

ユーザー指定による追加要求の整理・設計案の記録はPoC中でも行える。本番の詳細契約や採用判断はPoCの結果を踏まえて確定し、設計文書の追加だけを根拠にPoCの実装順序を変更しない。

1. `ARCHITECTURE.md`: 境界、依存方向、deployment、責務。
2. `TECH_STACK.md`: 採用バージョン、採用理由、代替案、更新方針。
3. `DATA_MODEL.md`: workspace/Page/Task/Relation/Conflict/operationの論理・物理モデル。
4. `SYNC_SPEC.md`: operation schema、cursor、retry、idempotency、conflict、tombstone、reconciliation。
5. `CRDT_SPEC.md`: Y.Doc schema、binary persistence、projection、compaction、version history。
6. `EDITOR_SPEC.md`: block schema、IME、mobile gesture、accessibility、extension方針。
7. `AUTHZ_SPEC.md`: Supabase Auth、workspace role、resource authorization、RLS。
8. `INTEGRATION_SPEC.md`: Google Calendar等Provider Adapterの契約。
9. `CALENDAR_TIMETABLE_SPEC.md`: 汎用定期予定・時間割登録、Calendar表示、期間・時刻・例外の規則、受入条件。
10. `HELP_SUPPORT_SPEC.md`: ヘルプ、文脈案内、学習導線、問題解決、記事更新と受入条件。
11. `AI_ACTION_SPEC.md`: 文章/音声入力、共通操作基盤、確認・実行、参照範囲、受入条件。
12. `APP_UPDATE_SPEC.md`: 更新検知、利用者によるダウンロード・導入、保存/再起動、署名・配布・互換性と受入条件。
13. `IMPLEMENTATION_PLAN.md`: リリース単位、依存、移行、受入条件。

## 12. 本書の決定事項と要決定事項

### 決定済み

- React / Tauri 2 / Tiptap / Yjs / Hocuspocus / SQLiteを中核候補とする。
- structured dataとCRDT本文を分離する。
- PostgreSQLはDrizzle Repository経由でアクセスする。
- Web local storeはSQLite WASM + OPFSを主、IndexedDBをfallbackとする。
- CRDT本文の正本はY.Doc binaryであり、JSON/textはProjectionである。
- operation IDの冪等性、cursor pull、Conflict保持、offline crash recoveryを必須とする。
- WindowsとAndroidを優先し、WebKitを早期検証する。
- 時間割・汎用定期予定をGreiva内で登録し、Calendarへ表示する。曜日ごとの繰り返しと取消・振替・追加を扱い、時間割は曜日＋時限を基本とし、時刻も直接指定できる。
- ヘルプページと関連する利用案内を用意し、公開する機能の使い方・問題解決手順へアプリ内から到達できるようにする。
- 将来のAI機能として文章・音声からPage作成、Task・予定登録を行い、アプリの操作へ段階的に対応できる設計とする。
- アプリ内更新を起動時・定期的に検知し、ダウンロードは利用者が開始する。導入は「今すぐ更新／後で」と再起動前の確認を設け、端末保存済みの未送信データを保持する。

### 要決定

- 初期リリースに含めるHome、Inbox、Boardの具体機能と優先順位、Calendar・定期予定/時間割の提供時期と詳細設計案の採用範囲。
- Workspaceのrole定義、共有モデル、RLSポリシー。
- 検索、AI、通知、添付、automationのリリース時期と詳細要件。
- AI操作の関連参照の判定・深さ・上限、外部送信設定の保存・同期・版管理、音声/AI Providerと端末内対応、費用、履歴・録音の保存方式/期限適用・削除契約、対応音声形式・処理上限、提供時期・platformと後続操作の公開順序、複合依頼の確認・実行単位。
- Version History、CRDT snapshot保持期間、compactionポリシー。
- Object Storage、backup/restore、監視、運用SLO、コスト上限。
- アプリ内更新の提供時期・対象OS、配布形式・endpoint、定期確認間隔、署名鍵・公開運用、cache・migration・復旧契約。
- Flutter/Native UI再比較を行う具体的なAndroid Gate Bの閾値。
- ヘルプの初期記事と提供時期、記事配信・翻訳の運用、問い合わせ先と対応方法。

実装者は要決定事項を仮定して恒久実装へ進めず、判断記録と選択肢を提示する。
