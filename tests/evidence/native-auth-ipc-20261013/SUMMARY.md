# Native authentication IPC — v0.86.0

[IPC契約](../../../docs/development/NATIVE_AUTH_IPC.md)。Docker自動試験とWindows非GUI compiled-mode inspectorを分ける。

- client追加8 Pass：browser fallback拒否、余計なtoken/identity field、不正capability/expiry、owner/context/request capture、logout中の遅いlogin拒否、cancel/dispose/expiry、malformed handle/secret cause除去、永続logout不明の分離。
- 全unit502/59 files、型/frontend build Pass。Rust通常29 Pass/Fail0。専用fixture2は通常でignore、source変更のないv0.85.0のTLS/署名HTTP/PG証拠を参照し、このcheckpointで再実行したとはしない。
- 最終通常Windows build、全3公開設定を埋め込んだWindows buildを別検査。版0.86.0/PE/SHAとhost/Docker native source・manifest/lockを照合。
- Windows inspectorを直接実行し、通常modeはconfigured false/旧command有効/SQL plugin有効、native modeはconfigured true/旧command無効/SQL plugin無効というcompiled flagを確認。実GUI/IPC呼出しやAuthを実行するprogramではない。
- 一部だけの設定を渡すbuildは固定errorで拒否（`partial.log.gz`）。期待した拒否であり正常buildのFailではない。外部依存版は変更せず、既存zeroizeをapp直接dependencyへ追加した。

初回client型検査はschema/typeの誤ったexport名で失敗し、既存local context schemaとsync型へ修正後に型/全unitを確認。native compile後にhandlerのmodule path/app ID scopeを明示し、最終buildで確認。原compile/型エラーを製品受入Passへ読み替えない。

`type.log.gz`/`port.log.gz`/`unit.log.gz`/`rust.log.gz`/`build.log.gz`/`windows.log.gz`/`configured.log.gz`/`partial.log.gz`、normal/configured profile・artifact/host exe JSON、version-auditを参照。gzipは元byte hashと一致。既存chunk-size/PDB warningを残す。

既存実API/0.82.0候補を置換せず、実account/本文は取得・送信していない。新UIへのmount、実WebView invoke、Windows自動復元、remote sync/ACK、offline lease/7日期限の結合、Android/既知IME再変換Failの受入は未完了。
