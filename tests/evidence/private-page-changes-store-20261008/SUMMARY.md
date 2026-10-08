# Pageタイトル増分の端末保存検証

2026-10-08 / v0.37.0。[契約](../../../docs/development/PRIVATE_PAGE_CHANGES_STORE.md)、[全16判断](../../../docs/decisions/private-page-changes-store.md)。bound native schema8を追加し、server5/本文/structured wireと通常rootを維持する。認証付きsession/runtime/UIは次工程。実Auth/Windows invoke・実IME/Android/native grant/配備暗号化は未検証。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回重点 | 45 Pass / 2 Fail | 未確定queueへの新解決と旧schema7エラー期待のfixture不備。元結果を保持 |
| 最終重点 | 49 Pass | 新native9＋既存40。catalog/cursor/replay、cache採用、pending/remote解決、window rollback、101件/破損lookahead、migration、SIGKILL2 |
| 通常全回帰 | 328 Pass / 93 Skip | 新native9＋既存319。専用PGは別run |
| PostgreSQL全回帰 | 93 Pass | server5と旧schemaの本文/structured/Auth/nonce/kill回帰 |
| 型/servers/frontend | Pass | 最終型と通常test flags0 build |
| Rust/native features | Pass | locked normal/crash examples、default crash hooks無効 |
| Windows cross-build | Pass | Docker debug/custom-protocol。host PE版/SHA照合のみ、未起動 |
| host/Docker source | 260一致 | raw250、CRLF/LFのみ10、既存診断5を除外 |
| 外部依存 | 不変 | npm315 / app Cargo501 / page-store Cargo118。owned版/locksのみ更新 |

初回型エラーはfixtureのexact optional `{crashRoot:undefined}` と同期closeの`.catch`で、初回重点の二件は未確定queueへ解決をenqueueしたfixtureとschema更新後の旧エラー期待だった。queue確定制約を緩めずfixtureを直し、pending解決の外部解決先行→rejectionを独立に検証した。元Failを後のPassで置換しない。

通常/PGの最初のPass後に、server作成済み・local bootstrap ACK未確定で増分を受ける順序を追加した。cacheだけ保存してtitle基底unknownを維持し、ACKの確定とcache採用を原子commitする。cacheと確認応答のcreatedAt不一致はACK/投影ごとrollbackする。これらの追加後に重点49、最終全回帰、型/buildを再実行した。

本文未取得Pageのcatalog受信は本文Docを暗黙作成しない。後の本文受信で版付き基底と候補を採用する。再開/filtered空頁/正確receipt再適用を検証し、pending localtitleとimmutable wireを保持する。別端末のresolvedByはlocal operationの存在を要求せず、既知解決の書換えは拒否する。received/hasMoreは取得の観測状態で、同期済みや削除ACKではない。

実Rust registry/SQLiteのCOMMIT前後SIGKILLでevent/catalog/receipt/cursorの原子性、同reply一回適用、quick_checkを照合した。bound7移行はbinaryとpendingを保持する。異主体で同じDBを直接開く場合のbinding拒否を検証する。registryはcontext別の固定pathを使うため、別contextで別DBを作れることをnative Auth grantの証明にしない。

画面は変更していないためroot/workspace/Auth E2Eを再実行していない。memory Auth/bootstrap fixtureと実SQLiteは実Supabase正常login/Tauri host invoke/実IMEの代用ではない。nativeはcursorのcanonical署名envelopeを確認し、server HMAC鍵を持たない。

[集約](verification.json)、[初回重点](initial-focused.json.gz)、[初回log](focused-initial.log)、[最終重点](focused.json.gz)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[型](typecheck-final.log)、[初回型](typecheck-initial.log)、[frontend](frontend-build.log)、[Rust](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[Docker exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理する。binary/BOMを正規化せず、credentials/DB/依存/cache/exeをGitへ含めない。

次はcaptured Auth transport/portable session/native runtimeを接続し、受信後の観測状態とworkspace表示を検証済みの区切りごとに進める。
