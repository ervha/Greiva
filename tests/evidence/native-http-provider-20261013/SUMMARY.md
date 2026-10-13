# Native HTTP provider — v0.84.0

Dockerで[固定native HTTP provider](../../../docs/development/NATIVE_HTTP_PROVIDER.md)を検証。実ユーザーのcredential/本文や本番鍵は取得しない。

- Rust通常25 Pass / Fail 0。fixtureを要する1件は通常実行でignoreし、`scripts/test-native-http-provider.mjs`の専用実行で1 Passを確認。未実施として隠さない。
- 実TLS providerとRust client、実Greiva HTTP署名APIで13条件。正常login/refresh rotation/local logout確認、provider logout非2xx、期限切れ、不正署名、owner不一致、foreign issuer、不正/余計なsession field、redirect、非JSON、上限超過、重複token field、refresh応答失敗。
- trusted test CAだけでfixture TLSを許可。製品constructorのuntrusted TLS拒否、redirect trap0、password各1/refresh対象各1/provider revoke各1をNode側counterで独立確認。refresh失敗後のrestoreでproviderを再呼出ししない。
- JWTは一時fixture ES256署名。APIは製品の署名verifier/HTTP controller、JWKSだけは公開fixture transport。fixture証明書/秘密鍵は一時directoryで生成し、終了後消去する。
- 型/frontend/通常Windows cross-build、host/Docker native source/manifest/lock hash、PE/実版/SHAを確認。ログgzipは元byteのhashと一致。既存chunk-size/SDK debug PDB warningを保持。
- `dependencies.json`にTLS追加を記録。既存外部依存版は保持し、npm外部依存は変更しない。初回offline解決は未cacheのhyper-tlsで失敗したため、Docker内だけで固定依存を取得した。

`rust.log.gz`/`fixture.log.gz`/`deps.log.gz`/`main-deps.log.gz`/`type.log.gz`/`build.log.gz`/`windows.log.gz`、`artifact.json`/`host-exe-inspection.json`を参照。fixture response/ログに実account/tokenを混ぜない。

Windowsはbuild検査だけ。実Supabase refresh/失効、起動復元UI、通常IPC/workspace admission・7日offline、Android/既知IME再変換Failの受入を完成扱いにしない。既存の実API/0.82.0検証候補を置換しない。
