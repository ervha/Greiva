# 認証付きPage編集接続の検証

2026-10-07 / v0.26.0。`PrivatePageEditorSession` がlive Y.Doc・captured native store・認証付きPage HTTP sessionを接続する。通常アプリへのlogin/catalog/editor compositionは次工程。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 新unit | 10 Pass | 保存順序、正確なwire再送、remote commit/echoなし、composition待機、Auth遅着、Page close/再open、保存失敗、破損/別connection、同Page置換、同期中入力 |
| 通常 | 234 Pass / 69 Skip | unit/実SQLiteを含む全通常suite。PG専用は次行で別実行 |
| PostgreSQL | 69 Pass | 実HTTP＋署名fixture＋Rust registry/SQLiteでeditor edit→commit→sync、refresh→プロセス再起動→local再openを追加確認 |
| 通常画面 | 64 Pass | 新3＋既存61。keyboard/Undo/Redo、復元/ACK loss、blur後selection、合成composition、保存失敗/コピー可能本文、360px、既存drag/Todo/Toggle/remote/offline/Task/Relation |
| ログイン画面 | 8 Pass | 独立Auth画面のdesktop/mobile dark回帰。実利用者credentialは使用しない |
| 型/frontend | Pass | 所有版0.26.0、通常build flags=0、検証fixtureは通常build entryに含めない |
| Windows cross-build | Pass | 既存cacheを使う通常debug/custom-protocol。診断/crash hooksなし。release package/起動/IME試験ではない |
| source/依存 | Pass | ホスト/Dockerのsource226がSHA-256一致。外部npm315と両Cargo lock不変、所有manifest/lock一致 |

初回fixtureは `/@fs` から未変換HTMLを読んでbodyが出ず3 Fail、次の相対script経路もroot外へ解決できず3 Fail。通常Vite HTML入口と明示test moduleへ修正した。読み込めた後は2 Pass/1 Fail。PMのrelative選択はoffset7で正しかったが、同期buttonから本文へelement.focusするとDOM caretが先頭へ戻り、`peer abXcd` が `Xpeer abcd` になった。before/afterの診断を残し、非compositionのview.focusでDOMへ選択を戻した。修正後の専用3と全64がPass。viewはsession propの切替で未確認表示を更新し、別Docへ移る時はDocに対応するeditorを作り直して復元する。

Docker cacheのnpm workspace symlink所有権、offline未cache依存、login shellによるcargo PATHを修正。初回型検査のNodeNext拡張子/fixtureのundefined型も修正し、型を緩めていない。自動retryは0、最終browser suiteは順番に1 worker。通常/PG試験は既存suiteの分離schema/一時SQLiteを使い、利用者DBを変更していない。

T3 previewはstatus/open/navigationまで進んだがsnapshot/evaluateがtimeout、その後host unavailableとなった。明示されたfallbackに従いDocker Chromiumで画面操作とdesktop/360px screenshotを確認した。browserのnative invokeはdouble。実HTTP/PG/Rust registryのruntime試験とは証拠を分ける。実Windows WebView2/Tauri invoke/Microsoft IME、Android、実Supabase正常login/refreshの新しい証拠ではない。

追加のsession prop切替試験では全63 Pass/1 Fail。破棄されたTiptap viewをcomposition effectが参照し、本文の再表示に失敗した。保存済み本文と新runtimeはreadyのまま保持されていた。イベント解除用DOMをcaptureし、destroy済みeditorを除外、Docが変わる境界でeditorを再生成した。pageerrorも失敗条件へ追加し、専用3を再確認した。失敗reportと最終全画面結果を別々に保存する。

[切替時の全画面失敗](root-switch-failure.json.gz)、[切替再確認の失敗](switch-recheck.json.gz)、[切替の専用最終](switch-final.json.gz) も保持する。

push時に同じbranchの仕様書更新v0.25.2が先行していたため、その上へrebaseした。VERSION/変更履歴/状況の競合は0.26.0を最新にし、0.25.2の記録を保持した。検証済みcommitとrebase後の実装・依存・VERSION・試験コードのGit差分がないことを確認した。トグル仕様を実装済みとは扱わず、文書統合だけでアプリ試験を繰り返していない。

Docker内の主な再現コマンド：

```sh
cargo build --locked --manifest-path apps/client/src-tauri/crates/page-store/Cargo.toml --examples --target-dir .data/native-target
cargo build --locked --manifest-path apps/client/src-tauri/crates/page-store/Cargo.toml --examples --features crash-test-hooks --target-dir .data/crash-target
npm run typecheck
npm test
npm run test:postgres
npx playwright test --workers=1
npx playwright test -c playwright.private-login.config.ts --workers=1
VITE_GREIVA_TEST_HOOKS=0 VITE_GREIVA_TEST_SQLITE=0 npm run build
cargo xwin build --locked --manifest-path apps/client/src-tauri/Cargo.toml --target x86_64-pc-windows-msvc --features custom-protocol --target-dir .data/windows-target
```

Windows build toolsはDocker内のみ。公式cargo-xwin v0.23.1 binaryの公開SHA-256を確認し、既存xwin/LLVM/cacheを再利用した。通常Windows debug exeの実ファイルはignored `.data/private-editor/windows-debug/` へ保持し、hash/flagsは [build metadata](windows-build.json) に保存する。既存release artifactと置換しない。

[集約](verification.json)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[全画面](root-ui.json.gz)、[Auth画面](auth-ui.json.gz)、[最初のfixture](initial-fixture.json.gz)、[fixture再確認](fixture-recheck.json.gz)、[選択失敗](initial-selection.json.gz)、[選択再確認](selection-recheck.json.gz)、[選択診断](selection-diagnostic.json.gz)、[専用最終](focused-final.json.gz)、[型](types-final-verified.log)、[frontend](windows-frontend.log)、[cross-build](windows-cross.log)、[版/依存](version-audit.json)、[source](source-inventory.json)。reportは環境configを除いてgzip保存し、JWT/private key/公開key pattern検査を通した。未収録traceはDockerの一時artifactへ残る。

[desktop](editor-desktop.png)、[360px](editor-mobile.png)、[全18判断](../../../docs/decisions/private-page-editor.md)、[契約/残工程](../../../docs/development/PRIVATE_PAGE_EDITOR.md)。既存専用API/preview/schema、旧Page/DBは保持。通常アプリcomposition、metadata rename/delete、native Auth/grant/offline保持、継続認可付きHocuspocusと実IMEは残工程。追加の利用者手操作待ちはない。
