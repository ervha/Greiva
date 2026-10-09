# v0.54.0 View端末保存の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_VIEW_CACHE.md)、[判断](../../../docs/decisions/private-database-view-cache.md)。native10→11、server11保持。View設定/read観測/既知候補のcacheで、差分cursor・送信queue・HTTP runtime・画面は後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回Rust build | Fail | 共通value validatorのmodule参照を訂正、元log保持 |
| 訂正後Rust build | Pass | Record cell validatorを再利用 |
| 初回native7 suite | 96 Pass / 5 Fail | 新View22はPass、旧移行fixture4＋旧schema期待1を訂正 |
| 訂正後native7 suite | 101 Pass | View22＋Record17＋Source13＋旧native49 |
| 通常回帰 | 486 Pass | 既存464＋新22、PG187は別実行 |
| 全Postgres回帰 | 187 Pass | server11保持 |
| help UI | 12 Pass | owned54、desktop/mobile、入力保持 |
| 型/frontend/native/features | Pass | flags0、native11 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE54/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source322件一致（raw312、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending187は別PG187 Passと区別する。timeout/retry・外部依存を増やしていない。

新View22条件でTable/Listと全設定の順序/再起動/同応答retry、Unicode label120/121とfilter text65536/65537、列unique/Name/既知参照、sort方向/unique/8件境界、filter group深さ3/4・children20/21・predicate100/101、6型のoperator/値をportable/raw native双方で確認する。name/visible/filter/sortsのwhole-field三値候補4条件は配列順を保持し、layoutの成立しない三値は拒否する。

候補21件とheaders101件を分割し、終端/空readから解決・削除を推論しない。seed候補の未観測base/remoteを創作せず、整合する後着旧版は履歴だけを保持してcurrentを戻さない。矛盾baseline/候補はreceipt/historyごとrollbackする。同版divergence/候補ID変更、scope/対象/件数/order/extra fields、receipt/history/projection/candidate/baseline/lookahead破損を拒否する。

schema10→11で既存Record/Source/Page/pending保持、foreign identity/partial DDL rollback、並行exact観測とAuth refresh旧instance拒否を確認する。COMMIT前後の実native driver SIGKILL2試行でcurrent/history/receipt/候補が同じ境界で回復し、同応答retryが重複しない。今回suiteの他SIGKILLは既存Record/Source等の回帰として区別する。

初回Rust compile Failは新View validatorが自moduleのcellを参照していたため、既存Record cellの参照へ訂正した。[元log](native-build-initial.log)と[訂正後](native-build-corrected.log)を保持する。初回native5 Failは旧schemaを再現するfixture4件がView表を除いていなかったことと、通常PoCの拒否errorに旧schema10を期待した1件である。View表を先に除去し、最新11を期待して再確認した。元[report](initial-view-store.json.gz)/[log](view-store-initial.log)を保持し、実装の移行/帰属検証を緩めていない。

Page body/title/Record値をViewへ複製しない。read cacheはoperation ACK/全active候補/削除ACK/全DB同期/native grantを表さない。Auth adapterはfixture、実Supabase正常login、Windows invoke/MS IME/Android、配備暗号化/native Gateは別条件。UI変更はなくhelp12のみ今回のowned版で実行し、[v0.44.0 root64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。

[集約](verification.json)、[native101](view-store.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[packages](packages-build-initial.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
