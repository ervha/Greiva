# v0.59.0 DB作成端末queueの検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_SOURCE_QUEUE.md)、[判断](../../../docs/decisions/private-database-source-queue.md)。pending定義・元wire/checksum・原create ACKとcache/historyを原子保存する。native12→13、server11保持。作成HTTP/session/runtime、Record/View操作queue、Table/List画面は後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| native重点 | 147 Pass | 新21＋旧126、実Rust/SQLite |
| 新SIGKILL | 6 trials Pass | enqueue/prepare/ACKのCOMMIT前後 |
| 通常回帰 | 569 Pass | PG196は別実行 |
| 全Postgres回帰 | 196 Pass | 既存signed HTTP/cache/runtimeもnative13で再確認 |
| help UI | 12 Pass | owned59、desktop/mobile、入力保持 |
| 型/frontend/native/features | Pass | flags0、server11/native13 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE59/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source335件一致（raw325、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending196を別PG196 Passと区別する。新外部依存/timeout/retry増加はない。

初回Rust compileは2か所の複数変数宣言をletへ分けた。次のexample driver compileはResultを返さないmain内の?を既存のmissing-field拒否方式へ合わせた。両Fail logを保持し、その後のlibrary/examples・checksums build/147 native Pass・最終buildを分ける。実データの故障・試験Failを隠して成功へ置き換えない。

新21はmutable inputの捕捉、pending定義がconfirmed cacheへ入らないこと、同operation enqueue/prepare/ACK/restart、原create envelope保持/readへの偽装防止、read先行でqueueを消さないこと、late ACKで最新版を戻さないこと、ID/Source/scope/型/sequence/wire binding、実SQLite trigger failure・同version矛盾のACK/cache rollback、intent/index/wire/hash/ACK/history/projection/lookahead破損、非補修replay、正確bigint/format保持、schema12→13・foreign binding/partial DDL、concurrency/Auth refreshを含む。

format互換試験は保存wire/hashを明示SQL fixtureで旧formatに相当する別key順へseedし、actual native prepareが元bytesを再生成せず返すこと、ACK/restartが成功することを検証する。異なるbuild間の実起動証拠ではない。sequenceはsqlite_sequenceを9007199254740992へseedし、次のactual native enqueue/prepare/ACKが9007199254740993を正確に保持する。長期運用の実発生とfixture seedを分ける。

実SIGKILL6 trialsはenqueue/prepare/ACK各2境界でnative processを停止する。enqueueはintent有無、prepareは元wire/hash有無、ACKはqueue応答とcache/history確認の有無を同境界で確認し、再起動後の同operation再試行が一度だけ保存されることを確認する。server側Source create kill・署名/HTTP送信を今回追加したとはしない。

Source定義validatorをpureに分け、pendingを架空version/creationOrderで検証・保存しない。context/operation/定義checksumと元wire文字列checksum/意味を照合する。局所破損検知で、悪意あるDB全体改変への署名/Auth grantではない。cache create ACKは元操作・定義・wire/response proofを検査し、readと同snapshotのACKを受けても最初の元receiptを保つ。read intakeはcreate ACKを拒否し、readだけでqueueを清算しない。

actual schema12 migrationはSource cache・DB delta/Record・progress、Page binary/pending、Task pendingを保持する。旧native126もnative13へ移行した状態で再確認する。actual native IPCの証拠で、作成HTTP/session/runtimeは次工程。実Supabase正常login、Windows actual invoke/MS IME/Android/native Auth・offline grant/配備暗号化/native Gateは別条件。

UI変更はなくhelp12のみ今回版で実行し、[v0.44.0 root64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。

[集約](verification.json)、[重点147](initial-source-queue-store.json.gz)、[Rust初回](native-build-initial.log)、[driver初回](native-build-after-syntax.log)、[修正build](native-build-after-driver.log)、[checksum build](native-build-checksums.log)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
