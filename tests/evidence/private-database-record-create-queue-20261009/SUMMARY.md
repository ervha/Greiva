# v0.61.0 Record作成端末queueの検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_RECORD_CREATE_QUEUE.md)、[判断](../../../docs/decisions/private-database-record-create-queue.md)。未送信Source/Pageからcreate intentを保持し、確認後に元wireを固定する。原create ACKとwrite receipt/history/currentを原子保存する。native13→14/server11保持。update/View queue、Record送信HTTP/runtimeとTable/List画面は後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| native重点 | 23 Pass | 初回20→追加22→delta/canonical23、最終Source ID guard23再確認 |
| 新SIGKILL | 6 trials Pass | enqueue/prepare/ACK各COMMIT前後 |
| 通常回帰 | 614 Pass | 新23＋旧591、PG199は別実行 |
| 全Postgres回帰 | 199 Pass | 既存signed HTTP/native cache/runtimeをnative14で確認 |
| help UI | 12 Pass | owned61、desktop/mobile、入力保持 |
| 型/frontend/native/features | Pass | flags0、server11/native14 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE61/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source342件一致（raw332、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending199と別PG199 Passを分ける。新外部依存/timeout/retry増加はない。

初回test syntax checkはSIGKILL loopのcallbackを閉じるbrace不足で失敗した。修正後にtypecheck/native/examplesと重点20を通し、size guard/remote Pageを追加した重点22もPassした。追加canonical UUID条件で初回通常613 Pass/1 Failとなり、raw native UUID helperが大文字を許す点をcreate専用の小文字guardで修正した。元report/logを保持し、重点23・最終通常614/PG199と分ける。

通常614/PG199/help12後、Source定義内のIDにもcreate専用guardを適用した。影響するnative createの重点23・型・normal/crash native/features・Windowsを再確認した。frontend/UIやserver処理を追加変更していない。最終source inventoryとWindows SHAはこのSource ID guardを含む実行物に対応する。

重点23は未送信SourceとPageの同時依存、wire未生成のsource/page待ち、Page bootstrap後の未送信bodyを保持した作成、型/null/zero/false/absence、remote Page、mutable input捕捉、exact enqueue/prepare/ACK/restart、原write envelope保持/read偽装拒否、read先行/late ACK、DB delta観測とcursor保持、invalid Scope/型/Name/日付/UUID、operation/Record/Source-Page衝突、strict ACK/wire/version1/applied/値、実SQLite trigger rollback、intent/index/wire/hash/ACK/history/projection/lookahead破損、非補修replay、元format/正確bigint/pending-only、schema13移行・foreign binding/partial DDL、concurrency/Auth refresh、実UTF8 over8MiB enqueue拒否を含む。

actual schema13→14はSource cacheと未送信Source queue、Page binary/本文queue、Record read cache、Task pendingを保持する。旧移行fixturesも最新14へ照合し、架空のschema13にschema14表を残すdowngrade fixtureを避ける。frame順/hash/scopeの検証は実Rust/SQLiteで行い、cacheの原create receiptは実操作proofへ照合する。

SIGKILL6 trialsはenqueue/prepare/ACKのCOMMIT前後でnative processを停止する。再起動後のintent/wire/ACKとcache/historyが各境界で一致し、同operationの再試行が1行だけ保存されることを確認する。server Record writerのSIGKILLやcreate HTTPを今回新たに検証したとはしない。

format試験は明示SQL fixtureで元wireを別key順にseedし、native再prepareが保存bytesを再生成しないことを確認する。sequence試験もsqlite_sequenceを9007199254740992へseedした後の実enqueueを確認し、長期運用や別build間の実起動と区別する。checksumは局所破損検知でAuth grantや悪意あるDB全体改変への署名ではない。

実Supabase正常login、Windows actual invoke/MS IME/Android/native credentials・offline grant/配備暗号化/native Gateは別条件。画面変更はなくhelp12だけ今回版で実行し、[v0.44.0 root64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。

[集約](verification.json)、[重点初回20](initial-record-create-store.json.gz)、[追加22](record-create-store.json.gz)、[canonical23](final-record-create-store.json.gz)、[最終Source guard23](source-ids-record-create-store.json.gz)、[syntax初回](typecheck-after-tests.log)、[元通常Fail](initial-normal.json.gz)、[元Fail log](normal-initial.log)、[最終通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-source-ids.log)、[frontend](frontend-build.log)、[native](native-source-ids.log)、[crash](crash-source-ids.log)、[features](native-source-ids-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
