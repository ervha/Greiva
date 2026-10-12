# 個人workspace Windows候補 profile checkpoint

2026-10-12 / v0.74.0 / native16 / server11。[契約・再現手順](../../../docs/development/PRIVATE_PREVIEW_PROFILE.md)。

Docker builderと公開設定の検査、専用identifier/main window/workspace.html、限定CSP、成果物/metadata/hash、GUI・DBを開かないcompiled config検査CLIを追加した。既定PoCの起動とtauri.confは保持する。test hooks/SQLite bridgeを0に固定し、workspace .dataの新directoryだけへ出力する。既存出力・workspace外・親symlinkの外への脱出は拒否する。

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| profile境界unit | 3 Pass | [report](focused.json.gz)、[log](focused.log) |
| 全unit | 474 Pass | [report](normal.json.gz)、[log](normal.log) |
| 型 / production native features | Pass・crash hooksなし | [型](typecheck-final.log)、[features](native-features.log) |
| final Docker frontend + Windows candidate/CLI | Pass・custom-protocol | [frontend](frontend.log)、[Windows](windows.log)、[steps](steps.json)、[artifact](artifact.json) |
| actual built browser CSP | desktop/mobile 2 Pass | [final report](csp-final.json.gz)、[log](csp-final.log) |
| missing/existing/outside/symlink出力拒否 | 4条件・元成果物/外directory不変 | [集計](builder-refusal.json)、[missing](refused-missing.log)、[existing](refused-existing.log)、[outside](refused-outside.log)、[symlink](refused-symlink.log) |
| Windows host compiled config CLI / PE / SHA | 期待値と一致・GUI/DB未起動 | [compiled config](native-config.json)、[override](tauri-override.json)、[host照合](host-inspection.json) |
| Host/Docker source | 376：raw366、LF10、意図的excluded5 | [inventory](source-inventory.json)、[集計](verification.json) |
| 外部依存 | npm315/Cargo501・118 unchanged | [audit](version-audit.json) |

CSP試験はbuild済みfrontend hashを確認して実ブラウザーでworkspace画面を読み、明示APIへのfetch成功と未指定originのconnect-src違反・HTTP0件を検査する。実Tauri WebView/実Authやprivate API業務処理を検査したとはしない。初回CSP2も[別report](csp-initial.json.gz)へ保持し、path guard後の新directoryへ生成したfinal candidateで最終2を確認した。

全unitを実PG/native保存の全回帰へ読み替えない。保存/API/schemaと既存workspace画面は変更していない。直前[ヘルプv0.73.0の全画面98](../basic-database-help-20261012/SUMMARY.md)、[v0.72.0の通常775/実PG223](../private-database-view-screen-20261012/SUMMARY.md)は元versionの証拠として保持し、この区切りでは再実行していない。

## 元の失敗と境界

初回Windows buildは追加設定検査CLIのgenerate_context!にRuntime型を指定していなかったためE0283で失敗した。原[build](windows-initial.log)・[outer log](private-preview.log)を保持し、tauri::Context<tauri::Wry>を明示後、新directoryでcandidateとCLIを一緒に生成した。型指定の失敗をアプリの実invoke失敗へ読み替えない。

Windowsの検査CLIはexample側にdefault icon resourceがないwarningを出した[stderr](host-config-stderr.log)を保持する。exit0でidentifier/product/version/1つのmain window/workspace.html/CSP/bundleActiveを照合できた。CLIはGUI/event loopやapplication DBを開かず、候補GUIの起動合格・実IME合格としない。候補/CLIのSHA・PE版はhostで照合済み。

このbuild環境に有効な公開.envが配置されていなかったため、fixture provider/publishable keyとloopback APIを明示して構成を検証した。fixture設定のexeから実Supabaseへ正常loginできるとはしない。後続作業で過去に受領した公開設定の保存ファイルを発見したため、次はその設定の現在の公開鍵情報と専用APIを確認し、実接続用の候補を別directoryで生成する。

Native Auth custody/offline grant、Windows WebView/実invoke・MS IME、Android native/lifecycle、署名/installer・配備暗号化/backup/restore・配布・最終Gateは別の残条件である。公開設定と秘密鍵・個人認証情報を混ぜず、既存の保存済みデータは保持する。