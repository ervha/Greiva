# v0.52.0 DB定義取得・保存sessionの検証

2026-10-09 / Docker。[契約](../../../docs/development/PRIVATE_DATABASE_SOURCE_SESSION.md)、[判断](../../../docs/decisions/private-database-source-session.md)。captured Authのactual HTTP→native Source cache接続。server11/native9保持、Source作成/Record/View queue・内容replica/DB差分cursor/画面は後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| portable重点 | 8 Pass | strict scope/型/範囲、immutable ports、unknown retry、世代取消 |
| 初回client PG | 1 Pass / 1 Fail | 403時のfixture期待を訂正、元結果保持 |
| 修正後client PG | 2 Pass | signed actual HTTP＋Rust/SQLite cache |
| 通常回帰 | 447 Pass | 既存439＋新8、PG187は別実行 |
| 全Postgres回帰 | 187 Pass | 既存185＋新2 |
| help UI | 12 Pass | owned52、desktop/mobile、入力保持 |
| 型/API/frontend/native/features | Pass | flags0、server11/native9 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE52/SHA、未起動 |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118 |

host/Docker source318件一致（raw308、CRLF/LFのみ10）、既存診断5件を明示除外。通常reportのpending187は別PG187 Passと区別する。timeout/retry・依存を増やしていない。

portableのreadは6型/Source/contextを照合して同request/responseをnativeへ渡す。catalogはheadersだけでreceiveせず、max100/raw範囲/初回0/循環とfiltered空window/exact bigintを検査する。関数receiver/context捕捉、呼出元変更から独立したclone/freeze、HTTP失敗の無書込み、結果不明pair保持/別操作busy/networkなしretry、close後late HTTPとadmitted旧store commitを確認する。

実schema11 APIにJWT署名/JWKS fixtureを与え、captured PrivateWorkspaceConnection→NativeWorkspaceStore factory→実Rust/SQLite driverを接続する。open/catalogで定義を保存せず明示readで6型定義を保存し、再起動後に保持する。COMMIT後のinvoke返却だけをfixtureで失わせ、同じ応答のretryがHTTPを追加せず成功する。これはSIGKILL試験ではなく、native commitの強制終了証拠は[v0.51.0](../private-database-source-cache-20261009/SUMMARY.md)に分ける。

初回client PGのFailは403をtransportとして扱いlocal accessが続くとfixtureで期待したためだった。既存connectionは403で全体を閉じるので、closed/旧native access拒否へ期待を訂正した。新connection/bootstrap/native openでcacheが保持されることを確認する。元[report](initial-source-client-pg.json.gz)/[log](source-client-pg-initial.log)を保持し、認可を緩めていない。

session置換/Auth refresh中の遅着signed HTTPはnative保存前に除外する。同じIDsで新bootstrapしても旧Source session/storeは復活しない。connection close後に新HTTPを呼ばない。server Source ledgerへAuth email/tokenを保存しない。Auth login/identity adapterはfixtureで、実Supabase正常login、native Auth/offline grant/Windows invoke/MS IME/Android、配備暗号化/native Gateは別条件。削除Sourceのcache保持を削除ACKや全同期と扱わない。

UI変更はなくhelp12のみ今回のowned版で実行する。[v0.44.0のroot64/Auth12/workspace52](../private-database-record-20261008/SUMMARY.md)は旧版証拠として保持する。

[集約](verification.json)、[重点](initial-focused.json.gz)、[client PG](source-client-pg.json.gz)、[通常](normal.json.gz)、[全PG](postgres.json.gz)、[help](workspace-ui.json.gz)、[型](typecheck-final.log)、[API](api-build-initial.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理。credential/DB/dependencies/cache/exeをGitへ含めない。
