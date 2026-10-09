# v0.57.0 DB差分取得・保存sessionの検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_CHANGES_SESSION.md)、[判断](../../../docs/decisions/private-database-changes-session.md)。captured Source/Authのsigned HTTP bounded pullをnative deltaへ接続する。server11/native12保持、画面runtime/作成・更新queue/Table/Listは後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| portable最終 | 13 Pass | durable cursor/型/unknown pair/最新progress/取消 |
| 専用client PG | 4 Pass | actual signed HTTP/JWKS＋2client/Rust SQLite |
| 通常回帰 | 537 Pass | 既存524＋新13、PG194は別実行 |
| 全Postgres回帰 | 194 Pass | 既存190＋新4、native57 |
| help UI | 12 Pass | owned57、desktop/mobile、入力保持 |
| 型/frontend/native/features | Pass | flags0、server11/native12 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE57/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source330件一致（raw320、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending194は別PG194 Passと区別する。新外部依存/timeout/retry増加はない。

初回typecheck Failは新testでRecord/View event unionをnarrowせずRecord値へ参照した箇所を修正した。初回portable12 Pass/1 Failはmutable input contextがfixtureの保存contextへ共有され、期待subjectも変化したためfixture保存contextをcloneした。初回log/reportを保持し、修正後13と最終通常537を別に記録する。実装のscope検査を弱めず、HTTP/native専用4は初回から全Pass。

portable13はSource/context/portsとrequest/responseのimmutable捕捉、local progress/未実行HTTP、max100/invalid limit、durable scope/journal/raw進捗/型、unknown pairのbusy保護/networkなし再保存、post-commit reload failure/偽成功/古いprogress、actual最新progress、private causeの非露出、load/HTTP/receive/reload中のcloseとexact bigint/filtered空windowを含む。native64MiB guardや署名検証をportable単体の証拠へ拡大しない。

専用PG4はowned v0.57.0へbuildしたdriverを使い、fixture署名/JWKSのactual API→captured connection/native factory→実SQLiteへ接続する。別clientIDの2SQLiteでRecord/Viewとgdb1 progressを保存し、一方のCOMMIT後invoke返却のみを消失させて同応答retryがHTTPなしで成功すること、max1の分割・再起動後の再開を確認する。新SIGKILL試験ではなく、原子保存kill証拠は[v0.56.0](../private-database-changes-store-20261009/SUMMARY.md)へ分離する。

read先行版を保持したままdeltaで履歴・active候補を保存し、実serverのremote-noop解決イベントを受けてresolvedBy/元proofを再起動後まで保持する。旧active readを受けても解決を消さない。filtered deleted Page/Viewの空windowはcursorを進めるだけで既存cacheを削除しない。Source deny403はconnection/旧sessionを閉じ、再connection/bootstrapでprogress・cache保持を確認する。削除ACK/queue清算/offline grantではない。

不正Sourceでの置換は旧sessionを閉じず、正しい置換/Auth refresh/native close中のlate signed pullは保存前に除外する。native closeはSource/content/changesの自sessionを閉じ、新HTTPを止める。factory/progressはlocalのみで通信を始めない。保存後に最新native progressを返し、古いretry reply cursorを現在位置と扱わない。

Page body/titleを生成せず、profile/email/tokenをDB contentへ追加しない。Auth login/identity adapterはfixtureで、実Supabase正常login、Windows actual invoke/MS IME/Android/native Auth・offline grant/配備暗号化/native Gateは別条件。UI変更はなくhelp12のみ今回版で実行し、[v0.44.0 root64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。

[集約](verification.json)、[portable初回](initial-focused.json.gz)、[portable最終](focused-final.json.gz)、[PG専用](initial-changes-client-pg.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型初回](typecheck-initial.log)、[型最終](typecheck-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
