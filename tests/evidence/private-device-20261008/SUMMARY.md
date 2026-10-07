# 端末ID永続化と再ログインの検証

2026-10-08 / v0.27.0。検証済みissuer＋subjectごとのclientIdをnative固定rootへ保存し、再ログイン時の保存先を維持する。通常画面のlogin/catalog/editor compositionは次工程。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 新通常試験 | 12 Pass | native adapter3、login2、実Rust SQLite7（並行登録・restart・境界・missing DB・COMMIT前後SIGKILL） |
| 通常 | 246 Pass / 69 Skip | PG専用は次行で実行。通常の型/保存/同期回帰を含む |
| PostgreSQL | 69 Pass | signed fixture HTTP＋実Rust registry/SQLite。logout→kill→新Auth→同ID→同Page/pending exact wire再open→送信、server登録件数不変 |
| 通常画面 | 64 Pass | keyboard/selection/合成composition/offline/既存編集・Task/Relationの回帰 |
| Auth画面 | 12 Pass | desktop/mobile dark。native IPC doubleでreload同ID、取消・遅着・安全エラー・fallbackなし。実native invokeではない |
| 型/frontend | Pass | 通常buildのtest hooks/SQLite flags=0 |
| native/crash driver | Pass | Dockerのlocked Rust build、crash featureは専用driverだけ |
| Windows cross-build | Pass | Docker既存cache、debug/custom-protocol、exe FileVersion0.27.0。起動・IME未実施 |
| source/依存 | Pass | 検証cache内source221：raw207一致、CRLF/LFのみ14一致。外部npm323/両Cargo lock118・501不変 |

通常・PG・画面の最終reportに失敗/自動retryはない。実装中にissuerの `/auth/v1` をorigin用検査へ直接渡す箇所を修正した。最初のfocused23 Pass後にmissing metadata拒否の1試験を追加し、最終通常suiteで確認した。全画面suiteは各1 worker、利用者credentialを使わず独立schema/一時SQLiteで実施。

source inventoryからcacheにないperformance/render診断config・試験とWindows専用fixtureの5ファイルを除外し、一覧を記録した。今回実行したsuite/config/新実装を含む221ファイルを照合。BOM/binaryを改変して比較しない。Windows候補はignored `.data/workspace-device/windows-debug/greiva-poc.exe` に保持し、既存releaseを置換しない。コンパイラの既存SDK検出/PDB不在警告は残る。

再現コマンド（Docker内、既存PostgreSQL fixture設定）：

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
node scripts/verify-native-features.mjs
```

[集約](verification.json)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[通常画面](root-ui.json.gz)、[Auth画面](auth-ui.json.gz)、[型](typecheck-final.log)、[native](native-build-final.log)、[crash driver](crash-build-final.log)、[frontend](frontend.log)、[Windows](windows-cross.log)、[exe](windows-build.json)、[通常feature](native-features.json)、[source](source-inventory.json)、[外部依存](version-audit.json)。reportの環境configを除いてgzip化し、秘密鍵/JWT等のpatternを確認した。logは行末空白と末尾の余分な空行を整理し、内容を保持した。traceやDBは収録しない。

端末IDはAuth grant/物理端末証明ではない。実Windows WebView2/Tauri invoke/Microsoft IME、Android、実Supabase正常login、OS credential/offline権限、旧private rootの自動取り込み、通常アプリcomposition、暗号化の配備保護は未完成。利用者の追加手操作を求めず、次は通常compositionと残るnative認証契約を進める。[契約](../../../docs/development/PRIVATE_DEVICE_IDENTITY.md)、[全16判断](../../../docs/decisions/private-device-identity.md)。
