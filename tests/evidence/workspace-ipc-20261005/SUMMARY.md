# Native workspace IPC境界の検証

2026-10-05 / v0.24.0。追加native5＋port6、通常219 Pass/66 PG Skip、専用PG66 Pass/0 Skip、型/frontend/通常Windows cross-build Pass。source114をbuild前後で照合、外部npm315/両Cargo依存不変。実Docker Browser2がPass。

- fixed app-owned root/context hash、同ID/別issuer・owner・workspace・client・epochのDB binding、世代handle、close/reopen/process restart/failed openで旧handle拒否。
- unknown/raw SQL/path/extra field拒否と安全なerror。実SQLite create COMMIT前で停止させ、closeが待機して元storeへcommit後にhandleを失効させる。queueは保持。
- NativeWorkspaceStoreのverified context/generation capture、遅着open cleanup、request分離/固定handle/Page、Auth refresh/close/cleanup失敗、構文不正bytes/loadを検証。
- signed fixture HTTP＋実PG/2つの既存Rust SQLiteと新registry/SQLiteを接続。native adapter経由のread/save/ACK、Auth refresh旧port拒否、同context再openでpending保持/失効403を確認。
- 実Docker Browser2でPage WebCrypto/base64/sessionとTauri browser module/native adapter port doubleの固定handle/bytes/取消を検証。default Web native fallbackを拒否。
- Tauri workspace_open/close/execute登録を通常Windows cross-buildで確認。通常PoC command/DB/capability、専用API v0.21/schema3、local6/wire1は保持。

[verification.json](verification.json)、[通常report](vitest.json.gz)、[実PG report](postgres-vitest.json.gz)、[browser report](playwright.json.gz)、[版監査](version-audit.json)、[source](source-inventory.json)、[Windows build](windows-build.json)、[全16判断](../../../docs/decisions/native-workspace-ipc.md)。

初回型検査TS2345はmockが任意invoke<T>を保持できない点と試験protocolVersionのnumber型。IPC応答をunknown/runtime検査へ固定し、literal1を宣言して再検証Pass。compiler flagsを緩めずignored失敗logを保持。browser config envを削除して選択reportをscanした。

local handleはrepository bindingでnative Auth/権限grantではない。通常UI未接続、実Tauri invoke/起動/IME、native token custody/失効後offline保持契約、実ユーザーAuth/Android/Hocuspocusは未完成。browser invokeはport double、native driverは実libraryでTauri runtimeとの同一証拠にしない。旧PoC/DB/IMEデータは変更せず、telemetry未実装/未収集。
