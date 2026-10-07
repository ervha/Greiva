# 個人workspace画面の検証

2026-10-08 / v0.29.0。専用workspace entryでlogin→stable native device→登録→保存済み/remote一覧→create/open/edit/syncを接続。旧root/CSPは保持し、本番の既定入口への昇格は別工程。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 通常 | 258 Pass / 69 Skip | 新controller7、旧native/runtime/同期回帰 |
| PostgreSQL | 69 Pass | signed fixture HTTP＋実PG/Rust SQLiteでcontroller create/edit/sync、close/reopen pending、Auth refreshによる一覧取消 |
| 新画面 | 10 Pass | PC/360px dark/reduced motion、keyboard/pointer、logout/relogin exact pending、ACK loss、pagination外local優先、remote-only download、取消、Web fallbackなし、selection/合成composition、failed draft保持 |
| 既存画面/Auth | 64 / 12 Pass | 今回の直前のroot/editor/login回帰。最後の新画面専用表示修正は旧画面のcode pathを変更せず、通常/PG/新画面を再確認 |
| 型/fixture型 | Pass | app/test全体＋Vite型を指定した新TSX fixtureの独立noEmit |
| Rust/frontend/Windows | Pass | normal/crash driver、通常hooks=0 frontend、Docker debug/custom-protocol。実Windows起動/IMEは未実施 |
| source/依存 | Pass | source232一致（raw220、CRLF/LFのみ12）、cacheにない診断5を明示除外。外部npm315/両Cargo118・501 entry不変 |

初回型検査はimmutable配列の型で失敗し、readonly契約へ修正した。fixture用の追加型検査はVite型が欠けて失敗し、検査configへ `vite/client` を追加。製品の型を緩めていない。

最初のcontroller6 Fail/画面2 Pass・8 Failは、検証用handleの `fixture` がhex形式ではなく、製品のstrict検査で拒否された。fixtureを契約へ合わせた。次の画面8 Pass・2 Failは、一文字目の保存失敗で編集が停止した後も複数キーを入力する試験の期待が不適切だった。一回で挿入したdraftを保持する操作に変えた。再確認10 Pass後の画像レビューでdarkタイトルの黒色と、ACK後に古い一覧pending数が残る問題を発見した。共有色とactive Pageの実pendingで表示を更新し、色・件数のassertionを追加して10 Pass、通常258/PG69を再確認した。

PG初回69 Failは実行時の接続先指定ミス。リポジトリの既存開発用DB設定へ戻し69 Passを確認し、初回reportを別保存した。失敗を後のPassで置換しない。既存SDK/PDB警告は残る。auto retry=0。実利用者credentialは使用しない。

Docker主な再現：`npm run typecheck`、`npm test`、既存fixture設定で `npm run test:postgres`、`npx playwright test --workers=1`、`npm run test:auth-e2e -- --workers=1`、`npm run test:workspace-e2e`、normal flags=0の `npm run build`。Rust normal/crash examplesとWindows cross-buildは前checkpointと同じlockedコマンド/既存cache。独立fixture型はclient tsconfigをextendし、types=vite/client、include=新fixture TSXだけにしてnoEmit。

[集約](verification.json)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[新画面](workspace-ui.json.gz)、[既存画面](root-ui.json.gz)、[Auth](auth-ui.json.gz)、[初回unit](initial-unit.json.gz)、[初回画面](initial-workspace-ui.json.gz)、[storage試験の旧期待](storage-check-workspace-ui.json.gz)、[PG初回](initial-postgres.json.gz)、[型](types.log)、[fixture型](fixture-types.log)、[Rust](native.log)、[crash](crash.log)、[frontend](frontend.log)、[Windows](windows.log)、[exe](windows-build.json)、[feature](native-features.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportはconfig除外/gzip、logは行末空白/末尾空行のみ整理、secret/JWT patternを確認。DB/trace/credential/実行物をGitへ含めない。

[desktop](workspace-desktop.png)、[360px dark](workspace-mobile-dark-reduced-motion.png)、[修正前desktop](before-visual-desktop.png)、[修正前dark](before-visual-mobile.png)、[契約/自主判断14件](../../../docs/development/PRIVATE_WORKSPACE_SCREEN.md)。実Supabase正常login、実Tauri invoke/Microsoft IME、Android、native Auth/grant/CSP、OS credential/offline権限、rootへの昇格、Task/Relation scoped画面とmetadata同期は未完成。

外部npm数の説明はv0.31.0で323の誤記を315へ訂正。元のversion-audit.jsonと実行結果は変更していない。
