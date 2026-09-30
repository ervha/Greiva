# STEP1-DESKTOP-CHECK — Tauri ネイティブ前提不足

状態: 未解決（環境によるコンパイル検証ブロック）。PoC 技術仮説の否定や Gate Fail は判定しない。

## 環境と証拠

- 実行日時: 2026-09-30T08:12:10.222Z（UTC）
- 担当: Codex。Git commit: null（初期commitなし）。ソース hash と依存版は [実行metadata](../../tests/evidence/step-1/summary.json)。
- Linux x86_64 / Debian 13、Rust/Cargo 1.98.1、Tauri 2.12.0、tauri-build 2.7.0、tauri-plugin-sql 2.5.0、glib-sys 0.18.1。
- [Cargo checkログ](../../tests/evidence/step-1/STEP1-DESKTOP-CHECK.log)。Cargo.lock 生成は成功、frontend/Node buildと型検査は成功。[Tauri CLI devログ](../../tests/evidence/step-1/tauri-dev.log)でも beforeDevCommand によるVite起動と locked Cargo run の呼出しを確認したが、同じGLib不足で停止した。

## 最小再現

前提: Rust 1.98.1 とこのリポジトリのCargo.lock、GLib/GTK/WebKitGTK開発パッケージがない同じLinux環境。管理環境の実行時は Rust を `/tmp/greiva-toolchains/` に導入し、CARGO_HOME/RUSTUP_HOME/PATH をその配下へ設定した。これらは成果物への依存ではなく試験環境のみ。

```sh
cd /workspace/Greiva
cargo check --locked --manifest-path apps/client/src-tauri/Cargo.toml
pkg-config --modversion glib-2.0 gtk+-3.0 webkit2gtk-4.1
```

期待: locked graphでTauri desktop crateのコンパイル成功。

実結果: Cargo check終了コード101。`glib-sys` build scriptが `glib-2.0 >= 2.70` をpkg-configで取得できず停止。GTK3/WebKitGTK4.1も環境確認で未導入。

データ損失・非収束: desktop実行前、永続化・同期は未実装のため該当なし。

## 原因候補の切り分け

確認済み: Rust導入、依存解決、Cargo.lock生成は成功。ネイティブシステムライブラリ不足が今回のコンパイル停止点。React画面のWeb E2Eは成功している。

未確認: 必要なOSパッケージを揃えた後のRustアプリ本体のコンパイル、Tauriネイティブ起動、SQLite pluginの実動作、Windows11/WebView2環境。今回の停止点以降に別問題がないとは判断しない。

## 影響と次の判断

Step 1 の desktopコンパイル・起動検証を完了できない。将来の Gate A（Windows Editor/IME）・Gate B（desktop SQLiteによる耐久化）の検証前提に影響する。Web起動やNode SQLite試験でdesktop要件を代替しない。

次の選択肢: Tauri公式のネイティブ開発要件を満たしたLinux環境でlocked checkを再実行する、またはP0のWindows11 + C++ Build Tools/Windows SDK/WebView2で `npm run desktop` を実行する。成功後もIME/Gateの判定は所定の後工程で行う。Tauriを他shellへ置換せず、Step 2には進まない。

## 再検証

2026-09-30 17:20:22 JST: 同じ作業環境で再実行し、同じ失敗を確認した。ソース・仕様・lockfileは初回検証と同一。[今回のログ](../../tests/evidence/step-1-recheck-20260930-1720/STEP1-DESKTOP-CHECK.log)、[環境と結果](../../tests/evidence/step-1-recheck-20260930-1720/summary.json)。状態は未解決のまま。技術置換・要件緩和は行わず、Step 2 には進んでいない。

2026-09-30 17:32 JST: 環境設定完了の連絡後、稼働セッションで同じ問題を再確認。[ログ](../../tests/evidence/step-1-environment-recheck-2026-09-30T08-32-32.197Z/DESKTOP-CHECK.log)。設定した環境と本セッションの対応・セットアップ反映状況は未確認。
