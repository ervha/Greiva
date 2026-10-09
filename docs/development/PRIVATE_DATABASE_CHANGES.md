# DB変更履歴と差分取得

2026-10-09 / v0.50.0。[typed契約](PRIVATE_DATABASE_CHANGES_CONTRACT.md)を実Postgresへ接続する。[判断16件](../decisions/private-database-changes.md)、[証拠](../../tests/evidence/private-database-changes-20261009/SUMMARY.md)。server10→11、native8保持。端末DB replica/queue/cursor保存、captured runtime、Table/List操作画面は後続。

## 保存と明示移行

`installPrivateDatabaseChangesSchema`のみが既存server10から11へ進める。Sourceごとに永続UUID journalEpoch/headとpositive bigint順のRecord/View eventを追加する。既存Sourceが空でもhead0と世代を保存し、新規Sourceではdefinition/receipt/ledgerと同transactionにheadを初期化する。読取側で不足headや世代を補修しない。

移行はschema version UPDATE lockで既存transactionのversion SHAREを排出する。current/history/scopeを照合したRecord、Viewと、元request/result/base/remote historyへ照合した全既知候補をseedする。解決済み候補のresolvedByは新operationのrequest/resultとchosen field/historyにも照合する。Source内Record ID順、次にView ID順、各currentと候補ID順である。過去commit時刻/順序を復元したとはしない。旧snapshot/history/候補JSON/receipt/鍵/Page本文を変更しない。DDLや不正seedで全rollbackし、readinessは列を読取確認するだけである。

配備は旧API writerを止め、backupと明示移行を行い、schema11対応APIへ切り替える手順を別途必要とする。readiness/startupが自動移行したとはしない。Docker testのisolated schemaは利用者の本番DBへ適用した証拠ではない。

writerは既存Source UPDATE lock内でcurrent/history/三値候補/解決状態/operation ledgerとevent/headを原子保存する。新規・値が変わるupdate・新候補・remote選択の内容no-op解決がeventを生成する。複数候補は同じ結果snapshotで別eventを持つ。通常unchanged/拒否/同一operation再送はeventを増やさない。headと最大位置の整合、int64 overflowを検査し、SQL/COMMIT失敗で成功を返さない。Page Name/title/bodyはRecordへ複製しない。

## 認証付き取得

`POST /v1/workspaces/:workspaceId/databases/:sourceId/changes/pull`はJWT検証後、owner/device/workspace epoch/active Sourceを同transactionで照合する。protocol1/clientId/cursor/limit default50/max100。gdb1は永続鍵とworkspace/epoch/device/Source/journalEpoch/位置へ束縛し、終端0/headでも次cursorを返す。cursor不正400、認可拒否403、storage/history不整合503、JWT不正401を固定応答にする。値・本文・メール・tokenをログへ追加しない。

取得は事前に観測headとbounded metadata indexを読み、Page ResourceをID順SHARE、次にSource SHARE/head SHAREを取る。Record writerのPage-before-Source順に合わせる。固定観測範囲を再読し、immutable raw/header/scope/連続順/historyと候補の元ledgerを検査する。lookaheadも検査する。事前観測後の新eventは次pullへ回し、当該応答headを後から大きくしない。期限はlock待機後とCOMMIT前にも検査する。

1windowは最大100件かつPostgres `octet_length(event::text)`合計64MiBまで。最初にindexのみを読み、選んだwindow＋1lookaheadのpayloadを取得する。payload読取は最大128MiB＋metadata/envelopeで、HTTP送信byte数の厳密な上限ではない。trusted constructorの小さい予算は実PGのUTF8分割テストに使うだけで、HTTP利用者は予算を変更できない。単一eventが予算を超える場合は位置を飛ばさず503にする。最大100件のsnapshotはheader catalogより大きいので、端末側もbounded処理が必要となる。

deleted Record/View/Pageのeventはvisible応答から除外するがraw位置は進める。空windowでもhasMore中は進み、次cursorで再開する。Resourceの欠損/別workspace、RecordのPage binding変更はstorage不整合で拒否する。削除ACK、cache purge、送信queue ACK、全DB/Pageの同期済み表示へ扱わない。既存Source/Record/View catalog/read/write、Page/Task APIの互換を保持する。

## 検証境界

専用PG23条件にはmigrationの両側の実lock待機、101件のnumeric順、byte window、filtered空進捗、競合/remote no-op、observed-head race、ledger/history/lookahead/gap/head不整合、署名JWT/JWKS fixtureの実HTTPを含む。Record createとView remote no-op resolutionをCOMMIT前後で実SIGKILLする4試行を2条件内に実行する。実Supabase user login/Windows invoke・Microsoft IME/Android/native Gate、配備暗号化・保守/削除契約は別の未検証条件である。
