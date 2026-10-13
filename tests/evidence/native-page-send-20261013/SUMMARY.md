# Native Page送信基盤 — v0.90.0

[実装契約](../../../docs/development/NATIVE_PAGE_SEND.md)。Docker内の合成provider・署名JWT/JWKS・隔離PG schema・実SQLiteを使用し、実account本文/credentialを保存しない。

- 通常Rust34 Pass/Fail0。明示fixture3件は通常runでignored、専用runnerでは3 Pass/Fail0として実行した。
- 追加gate5件で、FIFO/不正receipt拒否、close後のlate ACK拒否、logout中断、送信中のexpiry、並行sendと同時local入力を確認。元pending/wireを保持した。
- 実TLS/署名API/PG経路でPage bootstrap receiptのworkspaceを改変し拒否。次のrequestはserver commit後に応答を失い、元wireを保持。3度目の同wire再送とappendをACK保存した。
- HTTP4回に対しdurable server frame2件。独立Y.Docで正確な本文/vector一致。native SQLite再openで未送信なしを確認した。redirect trap0と無信頼TLS拒否、既存認証/再起動/device revoke fixtureも再検証。
- 最初の実HTTP試験はfixtureのschema1のままPage routeを呼び、2 Pass/1 Fail。Page schema3まで正式migrationして解消し、元Failログを保持。
- 最初の候補buildは公開algorithm設定不足、次はDocker PATHのcargo-xwin未検出で失敗。元ログを保持し、既存toolchainをPATHに指定して最終buildはPass。host版0.90.0/SHA/compiled設定、native/auth/Editor/build script/manifestのsource一致を確認した。ホストtoolchainは追加しない。

native Page送信はRust基盤で、Tauri IPC/画面操作にはまだ公開していない。remote読取、既知receiptのnetworkなしACK再試行、offline lease接続と最新候補のWindows本文invoke/IMEは次工程。Windows起動の直接証拠は直前v0.89.0の隔離候補まで。

最終frontend/windows logのSDK PDB/chunk-size等の警告は保持。非GUI compiled-profile inspectorの既知default icon resource警告も保持し、GUI起動結果とは分ける。gzipは元byte hashとdecompress後hashを照合した。
