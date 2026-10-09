# v0.55.0 DB内容取得・保存sessionの検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_CONTENT_SESSION.md)、[判断](../../../docs/decisions/private-database-content-session.md)。captured Source/AuthのRecord/View read→native cacheとheaders catalog。server11/native11保持、差分cursor/解決状態の受信・作成/更新queue・Table/List画面は後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| portable重点 | 13 Pass | scope/型/immutable ports/unknown同応答retry/取消 |
| 専用client PG | 3 Pass | actual signed HTTP/JWKS＋Rust/SQLite cache |
| 通常回帰 | 499 Pass | 既存486＋新13、PG190は別実行 |
| 全Postgres回帰 | 190 Pass | 既存187＋新3、native55再build後 |
| help UI | 12 Pass | owned55、desktop/mobile、入力保持 |
| 型/frontend/native/features | Pass | flags0、server11/native11 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE55/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source325件一致（raw315、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending190は別PG190 Passと区別する。@greiva/syncに既存owned Domainへの直接参照をmanifest/lockへ記載し、外部依存を追加・更新しない。timeout/retryを増やしていない。

portable13でcaptured context/Source/receiver、header観測の無書込み、型/Source/schema/Record・Page/View binding、after/limit/raw進捗/初回0/循環/filtered空window/exact bigintを検査する。結果不明はkind/ID/request/responseをimmutableに保持し、別kind/read/catalogをbusyとする。同じ応答retryでは新HTTPを行わない。private causesを公開せず、HTTP/protocol failureではretryを作らず、close後late HTTPとadmitted旧store commitを除外する。

専用PGは確認済みnative v0.54.0 driverを再利用して3 Pass、全PG190はowned v0.55.0へ再buildしたdriverで3条件も再確認する。schema11のactual APIにJWT署名/JWKS fixtureを与え、captured connection/native factory→実SQLiteへ接続する。catalogはheadersのみでcache空を保持し、明示readで6型Record値とordered View設定を保存する。COMMIT済みのinvoke返却だけを失わせ、同応答retryがnetworkなしで成功し再起動後も保持する。新SIGKILL試験ではなく、原子保存kill証拠は[v0.53.0](../private-database-record-cache-20261009/SUMMARY.md)/[v0.54.0](../private-database-view-cache-20261009/SUMMARY.md)へ分ける。

実serverのstale編集からRecord/View三値候補を作り、native受信・再起動で保持する。server remote解決後の空readではcache候補を勝手に解決しない。解決状態は次の差分受信で処理する。Source削除時の403は既存connection閉鎖で旧native accessを拒否し、新connection/bootstrapでcache保持を確認する。削除ACK/retention/offline grantを表さない。

session置換/Auth refresh/native close中のlate signed readを保存前に除外する。native store closeは自Source/content sessionを閉じ、新HTTPを停止する。cacheへPage body/titleを暗黙生成せず、Source/profile/email/tokenをRecord/View ledgerへ追加しない。Auth login/identity adapterはfixtureで、実Supabase正常login、Windows invoke/MS IME/Android/native Auth・offline grant/配備暗号化/native Gateは別条件。

UI変更はなくhelp12のみ今回のowned版で実行し、[v0.44.0 root64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。

[集約](verification.json)、[重点](initial-focused.json.gz)、[client PG](initial-content-client-pg.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[packages](packages-build-initial.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
