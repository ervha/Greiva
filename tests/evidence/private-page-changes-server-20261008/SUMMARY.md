# Pageタイトル増分server検証

2026-10-08 / v0.36.0。[契約](../../../docs/development/PRIVATE_PAGE_CHANGES_SERVER.md)、[全16判断](../../../docs/decisions/private-page-changes-server.md)。server schema5を追加し、native7/本文/structured wireは維持する。端末保存/session/UI、実Auth/Windows invoke・実IME/Android/native grant、配備暗号化は次工程/残条件。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| strict unit | 4 Pass | protocol、bigint上限/JS safe integer超過、scope/namespace/key/署名/canonical cursor、filtered空頁 |
| 初回専用PG | 9 Pass / 1 Fail | 腐敗fixture SQLで未使用$1と$2を渡した型推論エラー。元結果を保持 |
| 最終専用PG | 10 Pass | creation/title/Conflict/同値解決の一回commit、upgrade/rollback、並行create/rename、filtered続頁、腐敗/期限、CLI/HTTP/実起動、SIGKILL2 |
| 通常全回帰 | 319 Pass / 93 Skip | 新unit4＋既存315。専用PGは別run |
| PostgreSQL全回帰 | 93 Pass | 既存83＋増分10。既存schema1–4の本文/structured/Auth/nonce/kill回帰 |
| 型/servers/frontend | Pass | 最終型・servers、通常test flags0 build |
| Rust/native features | Pass | locked normal/crash examples、defaultでcrash hooks無効 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE0.36/SHA照合のみ。host未起動 |
| host/Docker source | 258一致 | raw248、CRLF/LFのみ10、既存診断5を除外 |
| 外部依存 | 不変 | npm315 / app Cargo501 / page-store Cargo118。owned版/locksのみ更新 |

初回PGの一件は試験コードのSQL引数不備で、lookahead破損拒否そのものへ到達していなかった。未使用引数を除いた後に破損lookahead/欠番/head不整合を503相当で拒否することを確認した。元Failを後のPassへ置き換えない。

全回帰後に、既存CLI/HTTP条件へproduction `startPrivateApi`、ES256署名fixture/JWKS、実listener/fetchの増分200、必要table欠損のstartup schema拒否を追加し、最終型/serversと専用10条件を再実行した。JWT fixtureは実Supabase正常loginの証拠ではない。schema4旧routesとschema5新routeのmountは別条件として扱う。画面を変更していないためroot/workspace/Auth E2Eは再実行していない。

Migrationは既存current titleとresolved candidateのseed、本文bytes/digestと署名鍵不変、reinstall/不正title/部分DDLのrollbackを照合する。writerはhead→resource/document順を使い、同Pageのcreation retry/renameと複数Pageの並行操作で順序が連続する。期限中のhead待ち、COMMIT前後SIGKILLでtitle/eventの原子復旧、同nonce retryによるevent二重化防止を確認する。

Deleted Pageはpayloadを返さず、raw順序を進めてevents空の続頁を許可する。lookaheadを含め最大101 eventとresourceを検査し、headはindex一件だけ読む。全journal count/scanをqueryごとに行わない。after/read/headの意味を区別し、最終頁到達を全端末や本文のsyncedへ広げない。

Docker再現：明示schema4→`npm run init:private -w @greiva/api -- --page-changes`、locked normal/crash examples、`npm run typecheck`、`npm test`、DB設定済み`npm run test:postgres`、専用unit/PG、native feature確認、test flags0 `npm run build`、通常Windows cross-build。配備先のschemaは変更していない。Windows compiler-family/SDK PDB warningを保持し、exit0とPE版/SHAを確認する。

[集約](verification.json)、[unit](focused.json.gz)、[初回PG](initial-changes-pg.json.gz)、[初回log](changes-pg-initial.log)、[最終専用PG](changes-pg.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[最終型](typecheck-final.log)、[servers](server-build-final.log)、[frontend](frontend-build.log)、[Rust](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[Docker exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理する。source raw/CRLF-LF差を分け、binary/BOMを正規化しない。既存診断5を除外する。DB/credentials/依存/cache/exeをGitへ含めない。

次は端末への原子受信/cursor耐久化、captured Auth/session/runtime、workspace表示を検証済み区切りごとに接続して継続する。
