# Windowsの保存層transaction境界 — 4条件Pass

2026-10-05（JST）。実WindowsでDocker-cross-built Rust/SQLite診断driverを動かし、[controller](../../../scripts/test-windows-store-boundaries.mjs)の4条件すべてがPass。[report](report.json)、[独立したYjs全文再構成](yjs-audit.json)、[buildの実版・hash](build.json)。hostは既存Node v26.1.0。global toolchain/SDKを追加しない。

| 条件 | 観測・照合 |
| --- | --- |
| Page append commit直前 | 所有PIDと実barrier markerを照合。read-only readerには未commit updateが見えず、強制終了後も元のPageと3 pending操作を保持。再試行でdeltaを保存 |
| pull適用後/cursor更新直前 | 受信entity/receipt/cursorが未commitで外へ漏れず、終了・復元後は元snapshot。再受信でcursor/orderを更新し、同じcursorの再適用で重複なし |
| 端末保存完了後 | Page、Task/Relation、pending3件を復元 |
| prepared wire保存後 | 同じoperation IDとwireを復元。pending3件保持 |

全ケースでSQLite integrityとPage digestを検査。実OSで回復したupdate byte列をDockerのYjsで再構成し、3段落の全文・構造・clockを照合した。再試行したPage条件だけが`first unsaved`へ進み、他は初期全文を保持する。synthetic fixtureのみで、既存user DBを使わない。

driverの実source版は**0.6.24**、`crash-test-hooks`あり、SHA-256 `f8d0ec40263e5ec393ffbd2a4c4a675f25a6b26edabf01c5747a1006f7f955ee`。0.6.25とのRust repository/command実装差分はなく、manifest版だけが異なる。通常0.6.25 Tauriはcrash hooksなしの別exe。診断driverの版を0.6.25へ書き換えない。

pull responseは制御したfixtureで、実API/POST/ACKの全crash条件をWindowsで検証したという意味ではない。通常Tauri UI/IPCの内部全境界、Microsoft IME、native起動/入力性能の不足をこのCLIで解消扱いにしない。

初回controllerは公開snapshotに存在しない`lastServerOrder`を期待して停止した。実SQLiteの`last_server_order`を読む検査へ訂正し、別の新規fixtureで再実行した。[report](report.json)はportable controllerの最終run。過去のfixtureは.dataに保持し、上書きしない。

[再現手順](../../native/README.md)。`audit-recovered-updates.mjs`はDockerで`/tmp/windows-native-fixture.json`に[fixture](../../native/windows-store-fixture.json)、`/tmp/windows-native-report.json`にreportを置いて実行する。SQLite/実行物はGitに含めない。
