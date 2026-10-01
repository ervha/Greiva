# Greiva PoC 仕様書

## 1. Purpose / Non-goals

### 1.1 目的

本PoC（Proof of Concept）の目的は、Greivaを主要プラットフォームへ安全に展開するための技術仮説を検証することである。

検証対象の中核仮説は次のとおりとする。

> React + Tauri 2 + Tiptap + Yjs + Hocuspocus + SQLite を基盤に、日常利用に耐える編集・オフライン保持・同期を実現できる。

ここでいう「実現できる」は、画面上で一度動作することではない。少なくとも日本語IME、複数クライアントの同時編集、オフライン中の強制終了と復旧、ネットワーク断・再接続を経ても、定義した状態整合性とデータ保持要件を満たすことを指す。

### 1.2 非目標

本PoCは本番機能の先行実装ではない。以下は明示的に対象外とする。

- 本番UI/UX、デザインシステム、アクセシビリティの完成
- 認証・認可、組織・ワークスペース管理、課金、監査ログ
- Supabase Auth、Google Calendar、通知、検索、添付ファイル
- 完全なNotion互換のブロック体系、テンプレート、共有権限
- 本番用の可観測性、バックアップ、マイグレーション、水平スケール
- すべてのモバイルネイティブ機能の実装

PoCで得られたコードを、そのまま本番へ昇格させる前提は置かない。再利用対象は、検証結果、プロトコルの知見、テストケース、失敗条件、および採用可能と判断された設計である。

### 1.3 失敗時の原則

受入条件を満たせない場合、実装担当者は勝手に大規模な回避実装、別基盤への置換、要件緩和を行ってはならない。代わりに次を成果物として残す。

1. 最小の再現手順と必要な前提条件
2. 発生日時、環境、アプリ/サーバーのバージョン、ログ
3. 期待結果と実結果、およびデータ損失・非収束の有無
4. 原因候補と、確認済み/未確認の切り分け
5. 影響するGate、次に判断すべき選択肢

小規模な修正（明白な実装不備、テスト不備、設定不備の是正）は許可する。アーキテクチャを変える対応は、証拠を添えた判断記録を作成し、承認を得るまで実施しない。

## 2. Repository Structure

PoCはmonorepoとして管理し、責務を次のように固定する。

```text
greiva-poc/
├─ apps/
│  ├─ client/                 # React UI と Tauri 2 desktop shell
│  │  ├─ src/
│  │  └─ src-tauri/
│  ├─ api/                    # NestJS + Fastify: structured sync API
│  └─ collaboration/          # Hocuspocus Yjs collaboration server
├─ packages/
│  ├─ protocol/               # sync 操作、DTO、version/cursor の型と検証
│  ├─ sync/                   # client sync engine と永続化境界の共通ロジック
│  └─ shared/                 # ID、時刻、エラー、テストfixture等の非UI共通物
├─ infrastructure/
│  ├─ postgres/               # ローカル検証用 PostgreSQL 構成
│  └─ sqlite/                 # SQLite schema と開発用初期化
├─ tests/
│  ├─ e2e/                    # 複数client、offline、crash、network chaos
│  ├─ fixtures/
│  └─ evidence/               # 実行ログ、結果JSON、手順、添付の索引
├─ docs/
│  ├─ decisions/              # ADR / Gate 判定
│  └─ failures/               # 未解決失敗の再現記録
├─ POC_SPEC.md
└─ README.md
```

`packages/protocol` はクライアントとAPIが同じ操作定義を参照する唯一の場所とする。UIコンポーネントからHTTP/WebSocketペイロードを直接定義してはならない。

## 3. Required Technologies

| 領域 | 必須技術 | PoCでの役割 |
| --- | --- | --- |
| Client | React + TypeScript | エディタ、Task UI、同期状態表示 |
| Desktop | Tauri 2 | Windows/macOS desktop shell とローカルSQLiteへの安全な橋渡し |
| Editor | Tiptap + ProseMirror | Page編集、ブロック操作、IME検証 |
| Collaborative editor sync | Yjs | PageドキュメントのCRDT状態 |
| Collaboration server | Hocuspocus | Yjs WebSocket接続と文書更新の中継/永続化境界 |
| Local persistence | SQLite | オフラインのPage/Task/Relation/操作ログ/カーソル保持 |
| Structured API | NestJS + Fastify | TaskおよびRelationの操作同期 |
| Server persistence | PostgreSQL | structured syncのサーバー側正本と操作履歴 |
| Test | unit + integration + Playwright等のE2E | 下記の受入試験を自動化し、必要箇所を手動補完 |

バージョンは実装開始時点の安定版をロックファイルで固定し、`README.md` に記録する。PoC期間中の主要バージョン更新は、再検証なしに行わない。

## 4. Minimal Data Model

### 4.1 識別子と時刻

- IDはクライアントで生成するUUID v7または同等の時系列ソート可能な一意IDを使用する。
- `createdAt` と `updatedAt` はUTC ISO 8601文字列とする。
- 同期の順序判断に端末時計を使わない。サーバーが採番する操作順序とcursorを使用する。

### 4.2 Page

Page本文はYjsドキュメントとして管理する。PoCで必要なPageメタデータは次に限定する。

```ts
type Page = {
  id: string;
  title: string;
  yDocId: string;             // Hocuspocus document name と一致
  createdAt: string;
  updatedAt: string;
};
```

Pageの本文ブロックをSQLite/RESTの正規化テーブルへ二重保存しない。本文の正本はYjs update列である。

### 4.3 Task と Relation

```ts
type Task = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  due: string | null;         // YYYY-MM-DD、時刻なし
  version: number;            // server が更新ごとに単調増加
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type Relation = {
  id: string;
  fromType: "page" | "task";
  fromId: string;
  toType: "page" | "task";
  toId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
```

削除はPoC中はtombstone（`deletedAt`）で表現する。物理削除・墓石GCは対象外である。

### 4.4 ローカル同期状態

SQLiteには少なくとも `pages`、`tasks`、`relations`、`sync_operations`、`sync_state`、Yjs update保存領域を持つ。

```ts
type SyncOperation = {
  operationId: string;
  entityType: "task" | "relation";
  entityId: string;
  kind: "create" | "update" | "delete";
  baseVersion: number | null;
  payload: unknown;
  clientId: string;
  createdAt: string;
  status: "pending" | "acknowledged" | "rejected";
};

type SyncState = {
  stream: "structured";
  cursor: string | null;
  lastSuccessfulSyncAt: string | null;
};
```

## 5. Editor Requirements

### 5.1 必須ブロック

1ページ内で次を作成・編集・削除できること。

- Paragraph
- Heading 1 / 2 / 3
- Bullet list
- Ordered list
- Todo（checked状態を含む）
- Blockquote
- Code block
- Horizontal rule
- Toggle（折りたたみ可能な入れ子コンテンツ）

### 5.2 必須操作

- `/` によるSlash Commandで必須ブロックを挿入できる。
- `@` Mentionは固定のダミーEntity候補を選択できればよい。実在Entityとの同期は不要。
- ブロックのDrag & Dropによる順序変更を行える。
- Undo / Redoを行える。
- Markdown shortcut（例: `# `、`- `、`1. `、`[] `）が動作する。
- ブロック追加、削除、移動、入れ子化・解除は、同期後に双方で同じYjs状態へ収束する。

### 5.3 日本語IMEの必須検証

WindowsでMicrosoft IMEを用い、最低限次の順に実施する。可能な範囲でmacOS/iOS系WebKitおよびAndroidでも同じ観点を実施する。

1. 日本語を入力し、変換候補の選択、確定、再変換を行う。
2. 変換中・確定後に文字選択、削除、Undo、Redoを行う。
3. 同一Pageを別クライアントで開き、片方が日本語変換中にもう片方からYjs updateを送る。
4. compositionが中断、二重入力、文字欠落、カーソル逸脱、クラッシュを起こさないことを確認する。

IME問題の隠蔽を目的として、composition中の同期を恒久的に停止する実装は採用しない。問題が生じた場合は「失敗時の原則」に従い記録する。

## 6. Yjs / Hocuspocus Requirements

### 6.1 文書と接続

- Pageごとに1つのY.Docを持ち、Hocuspocus document nameは `page:{pageId}` とする。
- WebSocket認証はPoCでは不要。ただし接続元clientを識別するランダムな `clientId` を接続情報とログに含める。
- HocuspocusはYjs updateを受信順に永続化可能な境界を持つ。永続先の具体実装はPoCで選んでよいが、サーバー再起動後に最新文書を復元できなければならない。

### 6.2 収束試験

Client A/Bが同じPageを開いた状態で、各ケースを実施する。

| ケース | 操作 | 合格条件 |
| --- | --- | --- |
| 同一Paragraph | 同時に異なる箇所を編集 | 双方のYjs state vectorが一致し、両編集が保持される |
| 別Block | 各自が別Blockを編集 | 双方で同一順序・同一内容になる |
| Block追加/削除 | offlineで各自が追加・削除 | reconnect後に同一状態へ収束する |
| Block移動 | 同時またはofflineで移動 | クラッシュせず、双方の最終状態が一致する |
| Nested Block | Toggle内を移動・編集 | 親子構造を含め同一状態へ収束する |
| Todo | checkedを変更 | 最終Yjs状態が一致し、破損したnodeがない |

表示テキストの見た目だけで判定しない。Yjs state vector比較、文書JSONスナップショット、クライアント間の再接続後比較を証拠に含める。

## 7. Local Storage Requirements

- Tauri desktop clientではSQLiteをローカル永続ストアとする。
- PageのYjs updateは受信・生成時にローカルへ耐久化し、復元に必要なsnapshot/update列を保持する。
- Task/Relationのローカル変更は、エンティティ更新と`sync_operations`追加を単一トランザクションで確定する。
- `acknowledged` 操作は再送しない。`pending` 操作はアプリ再起動後も保持し、接続復旧時に再開する。
- SQLite書き込み失敗、復元失敗、スキーマ不整合はユーザーに同期済みと誤表示してはならない。同期状態をエラーとして表示し、ログへ残す。
- ブラウザ実行を補助的に用いる場合も、desktopのSQLite要件を代替してはならない。

## 8. Structured Sync Protocol

### 8.1 対象と分離

structured syncはTaskとRelationのみを対象とする。Page本文はYjs/Hocuspocus経路で同期し、同じ更新をREST操作として送らない。

### 8.2 Client push

クライアントは`pending`操作を作成順でpushする。リクエストには`operationId`、`clientId`、`entityType`、`entityId`、`kind`、`baseVersion`、`payload`を含める。

APIは次を満たす。

- `operationId`を冪等キーとする。同じIDの再送は同じ確定結果を返す。
- 成功時はサーバー採番済みのentity、確定`version`、サーバー順序を返す。
- 不正なpayloadは恒久エラーとして`rejected`にする。
- version競合はHTTPエラーだけで終了させず、後述する競合結果を返す。

### 8.3 Client pull

クライアントは`cursor`を渡し、前回cursor以降のサーバー操作を順序付きで取得する。適用に成功した操作までをSQLiteトランザクションで反映してからcursorを更新する。

cursor更新前にクラッシュした場合は同じ操作を再取得してよい。適用処理はoperation IDまたはサーバー操作IDで冪等にする。

### 8.4 同期順序

接続時および再接続時は以下の順序を守る。

1. ローカルDBを開き、未確定状態を復元する。
2. pullを行い、既知のserver操作をローカルへ冪等適用する。
3. pending操作をpushする。
4. push後に再度pullし、他clientの確定操作と競合解決結果を取得する。
5. pendingが空であり、最新cursorまで適用済みの場合だけ「同期済み」と表示する。

## 9. Conflict Rules

### 9.1 Page本文

Page本文の競合はYjs CRDTに委ねる。競合ダイアログを出さず、接続回復後のYjs state収束を成功条件とする。意図した意味の保持までは自動判定しないが、構造破損やクライアント間の非収束は失敗とする。

### 9.2 Task / Relation

同一エンティティに対するversion競合は、サーバーの確定済み最新版を先に基準とし、クライアント操作をフィールド単位で再適用する。

- 異なるフィールドの更新: 両方を保持する（例: Aが`title`、Bが`due`を更新）。
- 同一フィールドの更新: last-write-winsで片方を黙って消さない。`base`、`local`、`remote`、対象fieldを保持した`Conflict`を生成する。
- 同一フィールドのConflict: 簡易UIでlocal/remoteのいずれかを明示選択し、その選択を新しい同期operationとして確定する。デザイン完成は不要。
- 削除と更新の競合: 削除を優先する。更新はrejectせず、削除済みの結果を返してローカルをtombstoneへ収束させる。
- createのID衝突: 同一IDかつ同一内容は冪等成功、内容が異なる場合はプロトコル異常としてrejectedにする。

同一field競合の内容と解決操作は、operation履歴とログで追跡可能にする。

## 10. Crash Recovery

### 10.1 必須シナリオ

ネットワークを切断した状態で次を行う。

1. Page作成と本文編集
2. Block追加、削除、移動
3. Task作成と変更
4. Relation作成
5. アプリプロセスを強制終了
6. ネットワークを戻さず再起動

再起動後、端末で保存完了した変更内容とpending操作が完全に残り、アプリが起動不能にならないこと。その後ネットワークを復旧し、PageはYjs経路、Task/Relationはstructured sync経路でサーバーへ反映され、別clientでも確認できること。

2026-10-01のユーザー判断（A）: 保存済みと表示した全変更を復元保証の対象とする。画面に反映されていても「保存中」の入力は、保存完了前の強制終了では失われる可能性がある。保存中と保存済みを明示し、連続入力の保存待ち時間を改善する。未commit入力の保持を保証したと表示しない。この判断は保存済み変更・Task/Relation queue・cursorの原子性や再送の保証を弱めない。

### 10.2 書き込み境界

- Task/Relation: エンティティ変更と操作キュー登録は同一SQLiteトランザクション。
- Page: UIで「保存済み」または同期可能と扱う更新は、Yjs updateのローカル耐久化が完了してから表示する。
- 強制終了は少なくとも、編集直後、ローカル永続化直後、push中、pull適用中の4箇所で試験する。
- 編集直後の試験も維持する。終了直前の保存表示、最後の保存済み状態、実際のSQLite commit済みupdate、復元内容を記録する。保存中の場合は未commit入力のみを保証対象外とし、全commit済みupdateの完全復元と、保存済みblock/本文・pendingの保持を検証する。保存済みと表示していた場合は終了直前の全文・Yjs state一致を必須とする。

## 11. Network Chaos Tests

テスト環境でクライアントとサーバー間に、接続断、遅延、再接続、重複送信を発生させる。各ケースでクラッシュ、データ消失、無限再送、非収束がないことを確認する。

| ケース | 実施内容 | 合格条件 |
| --- | --- | --- |
| 完全offline | 編集後に再接続 | ローカル保持後、最終的に同期する |
| push中断 | 操作送信直後に切断 | 再送しても重複作成せず、1回だけ確定する |
| pull中断 | cursor更新前に切断/終了 | 再取得・再適用しても整合する |
| 高遅延 | 500ms、2秒、5秒の遅延 | UIが誤って同期済みと表示しない |
| 一時的な接続反復 | connect/disconnectを連続 | pendingが失われず、無限ループしない |
| collaboration再起動 | 編集中にHocuspocus再起動 | reconnect後にYjsが収束する |
| API再起動 | structured sync中にAPI再起動 | 操作が冪等に回復する |

パケット改ざん、悪意あるクライアント、分散DB障害は本PoCの対象外とする。

## 12. Platform Tests

優先度はWindows desktopをP0とする。他プラットフォームは実行可能な環境がある場合の互換性シグナルとして扱う。

| プラットフォーム | 優先度 | 最低検証 |
| --- | --- | --- |
| Windows 11 + Tauri | P0 | Editor全操作、日本語Microsoft IME、offline/crash/reconnect、structured sync |
| macOS + Tauri | P1 | 起動、編集、Japanese IME、同時編集、offline復旧 |
| iOS WebKit | P2 | ブラウザで編集、IME、reconnect時のcomposition確認 |
| Android Chrome | P2 | ブラウザで編集、IME、reconnect、基本block操作 |

P1/P2を検証できない場合は未検証として記録し、P0の合否を成功として偽装しない。

## 13. Performance Tests

性能目標は本番SLOではなく、技術的な明白な破綻の早期発見を目的とする。測定機種、OS、build種別、データセットを証拠に含める。

| 対象 | データ/条件 | 判定基準 |
| --- | --- | --- |
| 初期起動 | 空DB、release build | main UI表示まで3秒以内を目安。超過時は内訳を記録 |
| Page復元 | 1,000ブロック程度のPage | 編集可能になるまで2秒以内を目安 |
| ローカル編集 | 1,000ブロックPageで連続入力 | 入力遅延、フレーム落ち、IME破綻が実用を妨げない |
| Yjs同期 | A/Bで同一Page、100回程度の小更新 | reconnect後30秒以内にstate vectorが一致 |
| structured sync | 1,000件のTask操作キュー | クラッシュなし、重複なし、最終整合。所要時間を記録 |

数値を満たさないことだけで即不採用とはしない。ただし、原因の内訳、再現性、改善見込み、採用リスクをGate判定に反映する。

## 14. Acceptance Criteria

PoC全体の合格には、少なくとも以下を満たすことが必要である。

1. 必須ブロックと必須操作をWindows desktopで実行できる。
2. 日本語IMEの必須検証でデータ消失、二重確定、composition破綻、クラッシュがない。
3. Yjs同時編集・offline編集の各ケースで、再接続後の双方のstate vectorが一致する。
4. offline編集後に強制終了しても、再起動後offlineのままで端末保存が完了した全変更とpending操作を復元できる。保存中の入力の扱いはSection 10に従う。
5. 再接続後、Page、Task、Relationがサーバーおよび別clientへ反映される。
6. structured syncが重複送信と途中終了を冪等に処理する。
7. 異なるfieldは自動mergeし、同一field競合は値を失わずConflictとして保持・解決できる。
8. 必須の自動テスト、手動試験記録、ログ、Gate判定が提出される。

## 15. Gate A / B / C

### Gate A: Editor viability

判定対象はTiptap + Yjs下での編集体験、特に日本語IMEである。

- Pass: 必須ブロック/操作とWindows日本語IMEシナリオが通り、別client更新中もcompositionの破綻がない。
- Conditional: 軽微で再現性の低い表示不具合のみ。再現・影響・対策候補を記録し、先へ進む承認を要する。
- Fail: データ消失、入力不能、頻繁なcomposition破綻、クラッシュ、または回避なしに日常利用できない遅延。

### Gate B: Offline and convergence viability

判定対象はYjs/HocuspocusおよびSQLiteによるデータ保持・収束である。

- Pass: offline強制終了復旧、A/B競合、collaboration再起動を経てもデータ損失なく収束する。
- Conditional: P1/P2未検証または性能の改善課題のみ。P0の正確性は満たしていること。
- Fail: 再現可能なデータ損失、非収束、構造破損、再起動不能、無限再接続。

### Gate C: Structured sync viability

判定対象はTask/Relationの操作ログ、cursor、冪等性、競合解決である。

- Pass: offline、再送、pull中断、競合同期後にローカルとサーバーが定義どおり収束する。
- Conditional: 性能目安未達だが、正確性・再現性・原因が明確で改善可能性がある。
- Fail: 操作の消失/重複、cursor不整合、競合規則違反、クラッシュ後に回復不能なキュー破損。

各Gateの結論は `docs/decisions/gate-a.md`、`gate-b.md`、`gate-c.md` に、Pass / Conditional / Fail、証拠リンク、未解決リスク、次の判断を記録する。ConditionalまたはFailでは、承認なしに次Gateを成功扱いで進めない。

## 16. Required Test Evidence

各試験は少なくとも次の情報を残す。

- テストID、実行日時、担当者、Git commit、依存バージョン
- OS、端末、ブラウザ/Tauri build、ネットワーク条件
- 前提条件、操作手順、期待結果、実結果、Pass/Fail
- clientIdごとのログ、API/Hocuspocusログ、同期cursor、operation ID
- Yjs state vectorおよび比較した文書JSON（必要な場合）
- 強制終了やネットワーク断の時点
- 失敗時の最小再現手順、原因候補、関連するGate

自動テストの結果は機械可読な形式（例: JUnit/JSON）と人間が追える要約を保存する。動画・スクリーンショットはIME、強制終了、視覚的なエラーなどログだけでは確認しづらいケースに限定し、`tests/evidence/` の索引から辿れるようにする。

## 17. Deliverables

- 実行可能なmonorepoとセットアップ手順を含む`README.md`
- Client、API、collaboration server、SQLite/PostgreSQL開発構成
- 必須Editor機能とYjs統合
- Pageローカル永続化、Task/Relation操作キュー、cursor同期
- 単体・統合・E2Eテスト、およびnetwork chaos用の実行手順
- `tests/evidence/` の試験結果と証拠索引
- Gate A/B/Cの判定記録
- `docs/failures/` の未解決問題記録（存在する場合）
- 技術選定の結論: 採用、条件付き採用、または不採用。結論と根拠、残余リスク、次の検証を明記する。

## 18. Codex Implementation Order

実装は次の順序で行い、後段の機能を先に作って前段の未検証リスクを隠さない。

1. monorepo、型共有、ローカル開発環境、テスト基盤を作る。依存バージョンを固定する。
2. Tauri + Reactに最小Tiptap Editorを組み込み、必須block、Slash Command、Undo/Redo、Markdown shortcutを実装する。
3. Windowsで日本語IME試験を行い、Gate Aの初回証拠を作る。Fail時はここで止め、失敗記録を作る。
4. PageへYjsとHocuspocusを接続し、A/Bの同時編集・offline/reconnect収束テストを作る。
5. SQLiteへYjs updateとPageメタデータのローカル永続化を実装し、offline強制終了・再起動試験を作る。
6. Task/Relation、`sync_operations`、`sync_state`、NestJS API、PostgreSQLを最小モデルで実装する。
7. push/pull/cursor/冪等性/競合解決を実装し、network chaosとcrash recoveryを自動試験する。
8. Gate B、Gate Cの証拠を収集し、性能試験とP1/P2互換性試験を可能な範囲で実行する。
9. Gate判定と技術選定結論を作成する。Fail/Conditionalを隠すための範囲拡張は行わない。

各段階で仕様と実装が矛盾する場合は、実装側で黙って解釈を変えず、矛盾箇所・選択肢・影響範囲を記録して判断を求める。
