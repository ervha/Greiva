# v0.58.0 DB差分画面用runtimeの検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_CHANGES_RUNTIME.md)、[判断](../../../docs/decisions/private-database-changes-runtime.md)。local opening/reload・明示bounded pull・unknown再保存・観測状態と閉鎖を接続する。server11/native12保持、永続作成・編集queueとTable/List画面mountは後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| portable重点 | 11 Pass | 状態/1window/unknown/close/observer |
| 専用runtime PG・最終 | 2 Pass | actual signed HTTP/JWKS＋Rust SQLite |
| 通常回帰 | 548 Pass | 既存537＋新11、PG196は別実行 |
| 全Postgres回帰 | 196 Pass | 既存194＋新2、native58 |
| help UI | 12 Pass | owned58、desktop/mobile、入力保持 |
| 型/frontend/native/features | Pass | flags0、server11/native12 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE58/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source333件一致（raw323、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending196を別PG196 Passと区別する。新外部依存/timeout/retry増加はない。

portable11はlocal開設/再読込の無通信、各syncの1window/max100/途中hasMoreと観測head、unknownのbusy/再読込でもpair保持/同応答retryによる最新progress、transport/storage/protocolのsafe errorと旧data保持、HTTP/receive/reload中のclose、Auth/session閉鎖、opening失敗・observer例外/observerからの再入close、共有store非所有、immutable stateを含む。単体はnative port fixtureで、actual invocationは次のPGへ分ける。

初回PG0 Pass/2 Failは新fixtureのschema名suffixが40文字を超えたため短縮した。中間PG1 Pass/1 FailはPage load.pendingが件数なのに配列lengthを期待した箇所をtoBe(1)へ修正する。初回・中間log/reportを保持し、最終2と全回帰を分ける。schema guardやpending保持の検査を弱めず、timeout/retryを増やさない。portable11は初回から全Pass。

専用PG2はowned v0.58.0へbuildしたdriverを使い、fixture署名/JWKSのactual API→captured connection/native factory/runtime→実SQLiteへ接続する。Source読取後offlineとし、runtime opening/reloadの無通信・取得時transport errorと既存data保持を確認する。Record101更新＋初期Record/Viewでhead103のactual journalを作り、最初のsyncが100で停止してhasMoreを残すことを確認する。途中に新更新を加えてhead104とし、次のsyncで104まで取得する。閉鎖後もshared storeのPage pending1とDB進捗104を保持する。

COMMIT後invoke返却のみを失わせ、runtimeがunknownを保持すること、local reloadで保存位置2を読めてもretryを消さないこと、networkなし同応答retryで観測を確定することを確認する。再起動では保存済みprogressをlocalに読み、観測headflagを新しい取得成功へ偽装しない。Auth refresh/native close中のlate signed pullを除外し、private dataを閉鎖時に消す。新SIGKILL試験ではなく、原子保存kill証拠は[v0.56.0](../private-database-changes-store-20261009/SUMMARY.md)へ分離する。

observedHeadは確認したwindowのnative progress.hasMoreがない状態だけで、全DB同期・Page送信・operation queue ACKを示さない。背景loop/poll/retryや画面mountを追加したとはしない。Page body/title/profile/email/tokenをdelta状態へ生成しない。Auth login/identity adapterはfixtureで、実Supabase正常login、Windows actual invoke/MS IME/Android/native Auth・offline grant/配備暗号化/native Gateは別条件。

UI変更はなくhelp12のみ今回版で実行し、[v0.44.0 root64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。

[集約](verification.json)、[portable](initial-focused.json.gz)、[PG初回](initial-changes-runtime-pg.json.gz)、[PG中間](after-schema-changes-runtime-pg.json.gz)、[PG最終](changes-runtime-pg.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
