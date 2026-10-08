# Page情報受信画面の検証

2026-10-08 / v0.39.0。[契約](../../../docs/development/PRIVATE_PAGE_CHANGES_SCREEN.md)、[全16判断](../../../docs/decisions/private-page-changes-screen.md)。個人workspace previewへ明示受信/catalog/本文有無/再確認を接続する。server5/native8・本文/structured wire・通常root入口を維持する。実Auth/Windows invoke・実IME/Android/native grant/配備暗号化は未検証。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| controller重点 | 15 Pass | 新5＋既存10。catalog/body/cache再開、pending/wire/body identity、dirty/composition保留、exact再確認、bounded101 |
| 初回workspace | 39 Pass / 1 Fail | desktop既存Task title fillで30秒timeout。ログイン後の同HTML再読込で未ログイン画面へ戻った。元結果を保持 |
| 分離Task再確認 | 1 Pass | 他の検証終了後に同操作をdesktopで実行 |
| 最終workspace | 40 Pass | desktop/mobile-dark-reduced-motion。新受信操作8＋既存32 |
| 通常root/Auth | 64 / 12 Pass | 通常editor/selection/CRDT/storeと認証画面回帰 |
| 通常全回帰 | 346 Pass / 94 Skip | 新controller5＋既存341。PGは別run |
| PostgreSQL全回帰 | 94 Pass | actual signed HTTP/two native storesを含むserver/本文/title/structured/kill |
| 型/servers/frontend | Pass | 最終型と通常test flags0 build |
| Rust/native features | Pass | locked normal/crash examples、default crash hooks無効 |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE版/SHA照合のみ。未起動 |
| host/Docker source | 265一致 | raw255、CRLF/LFのみ10、既存診断5を除外 |
| 外部依存 | 不変 | npm315 / app Cargo501 / page-store Cargo118。owned版/locksのみ更新 |

初回Task失敗は新受信操作のFailではなく、既存Taskフォームへのfill待機で発生した。traceは同じfixture HTMLを短い間隔で再取得し、Vite接続をやり直した後のsigned-out snapshotを示す。保存まで到達していない。workspace E2Eをnormal/native検証と同時実行し、npm test/typecheckの前処理がimportされているpackage distを再buildしていた。共有previewでbuild:packagesを実行すると同じ再読込とmemory Authの解除が起きることを再現した。初回traceと重なるため同時buildの干渉と判断し、build/type/通常検証が完了してからbrowser suiteをsequentialに実行する。アプリのTask保存を修正したとはしない。元report/logと限定trace/hashを保持し、他検証終了後に同操作1件、次に全40件をsequentialに再確認した。timeout拡大や自動retryでPassへ置換しない。

受信操作は本文未取得catalog/認証付きopen、reloginのnetwork-free cache、native結果不明で旧一覧維持/同pair通信なし再確認、transport失敗でcache維持を確認する。取得中にtitleのdirty/compositionを開始してもvalue/selection/focus/readonly状態とbody nodeを保持し、取消後のlocal refreshで受信titleを表示する。別端末のresolvedByでactionable候補を消してもbody同期表示を変えない。360px dark/reduced-motionで横overflowを検査する。

browser/UI fixtureとnative durability/署名認証は証拠を分ける。actual Rust/SQLite/PGと署名HTTPの回帰は同sourceで実施するが、実Supabase正常login/Tauri host invoke・Microsoft IME/native Androidへ広げない。synthetic compositionの実操作はnative IME候補/再変換の検証ではない。root入口を昇格せず、deleted eventの空windowをcache削除へ解釈しない。

[集約](verification.json)、[重点](focused.json.gz)、[初回workspace](initial-workspace-ui.json.gz)、[初回log](workspace-ui-initial.log)、[限定trace](reload-trace-summary.json)、[再現](reload-reproduce.json)、[再現build](reload-reproduce-build.log)、[Task再確認](reload-workspace-ui.json.gz)、[最終workspace](workspace-ui.json.gz)、[root](root-ui.json.gz)、[Auth](auth-ui.json.gz)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[型](typecheck-final.log)、[frontend](frontend-build.log)、[Rust](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[Docker exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除去/gzip、logは行末空白のみ整理する。binary/BOMを正規化せず、credentials/DB/依存/cache/exeをGitへ含めない。

次はaccepted P2のヘルプ・復旧案内など、利用者の手操作や配備設定に依存しない工程へ続ける。

共有T3 previewではfixture login/作成/title確認/明示受信を操作してlabelと表示状態を確認した。Dockerの[desktop](workspace-changes-desktop.png)/[mobile](workspace-changes-mobile-dark-reduced-motion.png) captureで余白・状態の区別・折返しとneutral paletteを確認した。実Auth/native IMEの証拠ではない。
