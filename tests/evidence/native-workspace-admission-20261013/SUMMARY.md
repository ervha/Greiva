# Native workspace admission — v0.85.0

[実装契約](../../../docs/development/NATIVE_WORKSPACE_ADMISSION.md)。Docker内の架空accountと隔離PG schema/実SQLiteを使用し、実ユーザーのcredential/本文は送らない。

- 通常Rust29 Pass / Fail0。専用fixtureを要する2件は通常でignoreし、TLS/HTTP/PG runnerで2 Pass（Fail/ignore0）を別実行した。
- 追加local gate4件：login前拒否、restart→OS restore→stable device・元pending復帰、logout→再認証、expiryでhandle閉鎖、別ownerで旧Page不在、旧handle拒否、同owner復帰、wrong client、cancel/後続openで旧bootstrap遅着拒否、logout中のbootstrap取消。
- ACK/pull/receive自己申告を拒否した後もlocal wireは不変。保存済みPage/pendingをlogoutで削除しない。
- 実TLS→Rust→製品署名HTTP controller/verifier→製品PG bootstrap transaction→実SQLiteを通した。close/reopen→refresh→同context/client/wire、provider logout確認、PGでdevice revoked→HTTP403→新handleなし・元wire保持を独立storeで確認。
- Node counterと実PGからworkspace1/device1/revoked1、正常bootstrap2＋失効bootstrap1を確認。requestはclientIdだけ。fixture schema・証明書/秘密鍵は終了後削除。
- 最終型/frontend/Windows cross-build、native source/manifest/lock・Windows版/PE/SHAを確認。外部依存の版追加なし。既存chunk-size/PDB warningを保持。

## 元の失敗

初回compileは借用registryをHRTB callbackへ保持できず失敗。Arc所有へ修正しcompileと通常Rustを再確認。PG runner初回はschema名の規則違反（`fixture-initial.log.gz`）、次はbootstrap requestの余分なprotocolVersionを実APIに拒否されたため専用Rust1 Fail/1 Pass（`fixture-wire-fail.log.gz`）。requestを既存strict schemaの`{clientId}`へ修正し、全専用2 Passを確認した。server validationを緩めていない。

`rust.log.gz`/`fixture.log.gz`/`type.log.gz`/`build.log.gz`/`windows.log.gz`、`artifact.json`/`host-exe-inspection.json`/`version-audit.json`を参照。gzipは元byteのhashと一致。通常IPC/UI・native remote sync/ACK/offline lease・7日復元・Windows実起動/IMEは未接続/未実施で、既知IME再変換Failを維持する。
