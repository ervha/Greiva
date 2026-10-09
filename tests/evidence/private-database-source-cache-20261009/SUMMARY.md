# v0.51.0 DB定義端末保存の検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_SOURCE_CACHE.md)、[判断](../../../docs/decisions/private-database-source-cache.md)。actual Rust/SQLite Source cacheの証拠で、native9/server11。Record/View replica・queue・DB cursor/runtimeと画面は後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回native重点 | 61 Pass / 1 Fail | 新13＋旧4suite49。Unicode不一致を保持 |
| 修正後専用 | 13 Pass | actual Rust/SQLite、SIGKILL2 |
| 最終専用 | 13 Pass | current最新保存版照合の追加も確認 |
| 通常回帰 | 439 Pass | 既存426＋新13、PG185は別実行 |
| 既存Postgres回帰 | 185 Pass | server11変更なし |
| help UI | 12 Pass | owned51、desktop/mobile、検索・入力保持 |
| 型/API/frontend/native/features | Pass | 通常flags0、native9 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE51/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source315件一致（raw305、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending185は別PG185 Passと区別する。timeout/retry・依存を増やしていない。

初回はnativeのUTF16単位120文字と既存ZodのUnicode codepoint120文字が一致せず、emoji61文字をportableが許可した後nativeが拒否した。[元report](initial-source-store.json.gz)と[log](source-store-initial.log)を保持する。既存Zodの実挙動を確認しnativeをcodepointへ変更、emoji120許可/121拒否を検証した。ECMAScript trimのFEFF/各空白拒否、0085許可もnative/portableで照合する。fixtureの期待だけを緩めた結果ではない。

6型/Select option/1個のName、canonical IDs/safe版/positive exact order/response bindingを検査する。portableを迂回したraw IPCでもprofile/path/extra fields、不正scope/type/refs/重複を拒否し無書込みにする。unknown SourceはnullでPageやdefault entityを作らない。同じ応答の再送と並行受信は1履歴、異なる同版・creation位置変更・別Source位置衝突は全rollbackする。

古い受信版を履歴へ追加してもcurrentを最新のまま保つ。snapshot/receipt/projection/lookahead破損は空cacheや自動修復へ変えない。最終確認ではcurrentを保存済みの古い有効履歴へ改変した場合も拒否する。最新版照合を追加した後に専用13・通常439・native/crash/Windows buildを再確認し、追加前[通常439](normal-before-projection.json.gz)も区別して保持する。

101件のUUID keyset/max100＋lookahead、schema8→9でPage本文/structured pendingの不変、foreign binding/DDL rollback、Auth refresh後の旧instance拒否を確認する。既存Page/title/metadata/queue移行fixtureは新Source表を取り除いて旧schemaを再現し、旧受入を削除せずnative9へ再実行する。

実native registry driverをSource受信COMMIT前後でSIGKILLする2試行。history/receipt/currentが同時に0または1行で回復し、再送後に1行だけ残る。Docker実driver証拠で、Windows actual Tauri invoke/MS IME/Android/native Auth/offline grantではない。read response保存を送信queue ACKやJWT署名検証、全DB同期完了へ扱わない。版2はlate replyのfixtureで、Source編集機能を実装したとはしない。

UI変更はなくhelp12のみ今回のowned版で実行する。[v0.44.0のroot64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。実Auth/host invoke/MS IME/Android、配備暗号化/削除/保守と全DB/native Gateは別条件。

[集約](verification.json)、[修正後](source-store.json.gz)、[最終専用](source-store-final.json.gz)、[通常](normal.json.gz)、[既存PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[frontend](frontend-build.log)、[native最終](native-build-final.log)、[crash最終](crash-build-final.log)、[features](native-features.log)、[Windows最終](windows-build-final.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
