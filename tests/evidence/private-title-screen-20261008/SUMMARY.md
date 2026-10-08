# Pageタイトル画面の検証

2026-10-08 / v0.35.0。workspace previewへtitle draft・保存/取消・確認・三値解決/拒否履歴を接続。[画面契約](../../../docs/development/PRIVATE_PAGE_TITLE_SCREEN.md)、[全18判断](../../../docs/decisions/private-page-title-screen.md)。実Auth正常系・Windows invoke/Microsoft IME・Android・native credential/offline grant・配備暗号化は未検証。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 初回型検査3回 | Fail、修正済み | optional prop、fixtureの基底型、ESM型importの拡張子。元logを別々に保持 |
| local履歴境界の初回 | 8 Pass / 1 Fail、修正済み | 101操作/201候補で、終了した操作履歴が先頭へ戻ることを実SQLiteで再現 |
| 追加試験の型 | Fail、修正済み | 正のstartで前要素を参照する試験コードのnoUncheckedIndexedAccess指定不足（TS2532） |
| 最終型 | Pass | packages/servers/client/testsの型 |
| focused | 19 Pass | actual Rust registry/SQLite title runtime9、workspace controller10 |
| 最終通常全回帰 | 315 Pass / 83 Skip | title/session/store/HTTP、本文/structured/Auth、SIGKILL。PGは専用run |
| PostgreSQL | 83 Pass | 実DBのmetadata/本文/structured/期限/transaction crash、署名fixture HTTP＋actual native store |
| workspace画面 | 32 Pass | 既存18＋title14。desktop / mobile dark・reduced-motion各16 |
| 既存root画面 | 64 Pass | 本文/Undo・Redo/選択保持・blur/remote/IMEイベント/既存editor回帰 |
| Auth画面 | 12 Pass | 既存ログイン/登録/refresh/失効/固定error回帰 |
| Rust/build | Pass | locked normal/crash examples、default crash hooks無効、通常test flags0 frontend/servers |
| Windows cross-build | Pass | Docker debug/custom-protocol、host PE版/SHA照合。実行・IMEは未実施 |
| 外部依存 | 不変 | npm315、app Cargo501、page-store Cargo118。owned版/locksのみ更新 |
| host/Docker source | 252一致 | raw242、CRLF/LFのみ10、既存診断5を除外。binary/BOMを正規化しない |

初回型検査はdisplayTitleのexplicit undefined許容不足（TS2375）、fixtureの未知基底string/undefined（TS2322）、型importのESM拡張子不足（TS2835）で失敗した。prop型の修正、未知基底の明示拒否、`.js`指定後にfocusedとworkspace試験を通し、最終全型/全回帰で再確認した。これらを後の成功で置き換えない。

最初の全回帰・画面試験通過後、local historyのoperation/candidate続頁が独立して終了する条件を追加し、8 Pass/1 Failで再現した。operation101件と候補201件で100→1→0と100→100→1へ進む際、終了側のnullを初期cursorとして扱い先頭100件を再表示していた。最後のkeyを独立保持し、空windowでも前keyを保持する修正後に、途中storage failureの同key再試行と空window/pending保持を含めてfocused19/通常315/PG83/workspace32、型/frontend/Windows buildを再確認した。root64/Auth12はこのlocal history修正の前に実施し、影響するworkspace画面を修正後に再試験する。

title画面の7条件を各projectで実行する。keyboard Enterの明示保存、offline title renameと本文状態分離、sidebar pending/logout・再ログイン保持、composition中Enter拒否/dirty input・focus・選択保持、保存失敗時のcopyable readonlyと同ID再確認、lost HTTP ACKの同wire、三値/new resolution/解決履歴、stale rejectionの候補/元入力保持、remote/local101件のbounded続頁と取消focusを検証する。画面doubleは既存Page/structured doubleへ専用title経路を追加したもの。実Tauri IPC、実SQLiteやprovider認証の代用とはしない。

controller追加2条件でdraft/結果不明のnavigation禁止、同ID復旧、offscreen/再connect時の一覧title pending、本文composition中のtitle network禁止、本文Doc/text保持とcleanupを確認する。actual native runtimeの既存101 pending試験をlocal history続頁100→1→先頭100と異なる件数の候補201へ拡張し、読取でpendingを消費しないことを確認する。PG試験はproduction transport/runtime・signed fixture・実DB/SQLiteを通すが、実Supabase正常loginではない。

desktop/mobileのtitle画像を確認し、neutral light/dark、入力/ボタン折り返し、本文とtitleの別表示を確認した。compositionはbrowser合成eventで、Windows実IMEのPassやPoC Gate変更を意味しない。title更新で本文editorをremountせず、候補query完了を全端末同期済みと表示しない。本文metadataからmutable titleを戻すこともない。

Docker再現：locked normal/crash examples、`npm run typecheck`、`npm test`、DB設定済み`npm run test:postgres`、`npm run test:workspace-e2e`、`npm run test:e2e`、`npm run test:auth-e2e`、`node scripts/verify-native-features.mjs`、`VITE_GREIVA_TEST_HOOKS=0 VITE_GREIVA_TEST_SQLITE=0 npm run build`、通常Windows debug/custom-protocol cross-build。hostは版/SHA検査だけで実行しない。compiler-family/SDK PDB warningを保持し、build終了コードを確認する。server schema4/native schema7を維持し、配備/upgradeを実行していない。

[集約](verification.json)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[初回focused](focused.json.gz)、[最終focused](focused-final.json.gz)、[履歴境界の元失敗](pagination-initial.json.gz)、[元失敗log](pagination-initial.log)、[追加試験の型](typecheck-pagination.log)、[workspace](workspace-ui.json.gz)、[root](root-ui.json.gz)、[Auth](auth-ui.json.gz)、[初回型](typecheck-initial.log)、[fixture型](typecheck-before-fixture.log)、[import型](typecheck-before-extension.log)、[修正後型](typecheck.log)、[最終型](typecheck-final.log)、[frontend/servers](frontend-build.log)、[Rust](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows log](windows-build.log)、[Docker exe](windows-build.json)、[host PE](host-exe-inspection.json)、[source照合](source-inventory.json)、[依存](version-audit.json)、[PC画像](workspace-title-desktop.png)、[mobile画像](workspace-title-mobile-dark-reduced-motion.png)。reportはconfigを除外してgzip、logは行末空白のみ整理する。sourceはraw一致とCRLF/LFだけの差を分け、binary/BOMを正規化しない。既存診断5ファイルを除外し、件数はsource reportへ記録する。DB/credentials/依存/cache/exeをGitへ含めない。

残条件：metadata delta、削除/復元/保持/GC、通常アプリ入口/native credential/offline grant、実Auth正常系、Windows invoke/実IME、Android、配備DB/backup暗号化。追加の利用者手操作依頼はない。
