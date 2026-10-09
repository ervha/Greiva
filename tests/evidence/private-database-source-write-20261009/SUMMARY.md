# v0.60.0 DB作成の送信・状態管理の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_SOURCE_WRITE.md)、[判断](../../../docs/decisions/private-database-source-write.md)。端末queueの元wireをcaptured Authのcreate HTTPへ接続し、unknown enqueue/HTTP/ACKを同操作で回復する。server11/native13を保持。Record/View queueとTable/List画面は後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| portable重点 | 20 Pass | writer10/runtime10、初回成功 |
| actual signed HTTP/native PG重点 | 3 Pass | 初回成功、JWKS/PG/Rust SQLite |
| Source queue native | 23 Pass | 既存21＋pending-only2、通常回帰内 |
| 通常回帰 | 591 Pass | PG199は別実行 |
| 全Postgres回帰 | 199 Pass | 新HTTP3＋旧196 |
| help UI | 12 Pass | owned60、desktop/mobile、入力保持 |
| 型/frontend/native/features | Pass | flags0、server11/native13 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE60/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source340件一致（raw330、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending199と別PG199 Passを分ける。新外部依存/timeout/retry増加はない。初回server buildコマンドはbuild:serverのtypoで未実行となり、build:serversへ修正したlogを分ける。試験Failやnative schema変更をこのtypoから推論しない。

portable重点は捕捉context/ports/input、元wire、empty queue/networkなし、invalid request/reply/Scope/operation/定義拒否、unknown HTTP元bytes再送、unknown ACK元pairのnetworkなしretry、prepare failure、busy/close/遅着、local opening/enqueue/pending-only reload、unknown enqueue/保存後reload failureの同intent保持、reloadでunknownを消さないこと、ACK成功後の一覧失敗/catalogFresh=false、fixed error/private cause非表示、observer例外/再入close、Auth/session closure、共有store保持を含む。

追加native2はstrict pendingOnly booleanとsequence keyset/global pending、101件完了後の101件未送信をmax100＋lookahead/nextAfterで取得する実Rust/SQLite試験。完了履歴を返すdefault falseと未送信だけのtrueを分ける。既存Source21のSIGKILL6 trialsは通常回帰で再実行されるが、新しいcrash境界を追加したとはしない。

actual HTTP3は署名ES256/JWKS fixture→bootstrap/固定create API→Postgres→native Registry/Rust SQLiteを使う。offline enqueue、enqueue保存後return loss、server COMMIT後HTTP response loss、native ACK保存後return loss、同operation/元bytes/元ACKの再試行と再起動、writer置換/Auth refresh/native store close中の遅着response、device403/connection閉鎖とpending保持・再bootstrap後の回復を確認する。server側の作成数/operation数が一度だけで、email/tokenが保存request/resultへ混入しない。

ACK成功後のcatalog reloadだけが失敗した場合、旧一覧はstaleだがACKは確認済みである。retryAckを作らずreloadで回復する。read/catalog観測が操作ACKや全同期完了を意味しないこと、runtime.closeが共有workspace storeを閉じないことを契約に記載する。

実Supabase正常login、Windows actual invoke/MS IME/Android/native credentials・offline grant/配備暗号化/native Gateは別条件。画面変更はなくhelp12だけ今回版で実行し、[v0.44.0 root64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。

[集約](verification.json)、[portable初回](initial-source-write-focused.json.gz)、[HTTP初回](initial-source-write-pg.json.gz)、[server typo](server-build-initial.log)、[修正server](server-build-final.log)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
