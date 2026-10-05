# Workspace別Page耐久保存の検証

2026-10-05 / v0.22.0。追加native13＋実PG1、通常193 Pass/66 PG Skip、専用PG66 Pass/0 Skip、型/frontend/通常Windows cross-build Pass。source109をbuild前後で照合、外部npm315/両Cargo依存不変。

- private local schema5→6はbinding確認後の同一open transaction。structured data/queueを保持、orphan/partial/foreign bindingはrollback、通常PoCはprivate6を拒否。
- Page作成/appendでbinary/digest/正確なprepared wire/送信待ちをatomic保存。再起動offline復元、同wire再送、先頭frame順序、ACKのscope/digest/order/wire/receiptを検証。
- remote importでmetadata/binary/headをatomic保存。echoを再送せず、pendingあり/遅いreadで本文・metadata/headを戻さない。missing/corrupt bytes/wire拒否、600k diffの保存/復元。
- create/append/ACK/receive各COMMIT前後で実Rust driver SIGKILL8条件。再起動後は全て前か後のatomic state、同bytes/wire retryで重複なし。
- signed fixture JWT＋実HTTP＋2つのRust SQLiteでbootstrap/append ACK喪失、offline restart、並行2peer編集/全文/vector収束、失効403時のpending保持。

[verification.json](verification.json)、[通常report](vitest.json.gz)、[実PG report](postgres-vitest.json.gz)、[版監査](version-audit.json)、[source](source-inventory.json)、[Windows build](windows-build.json)、[全16判断](../../../docs/decisions/private-page-durable-store.md)。

初回関連試験はPass。任意rustfmtがDocker toolchainに未導入だったため整形は見送り、host toolchainを追加せずcompile/型検査を実行した。native Repositoryはbytes/checksum/bindingの境界で意味的Yjs decoderではない。serverが構文を検査し、次のclient sessionでもsubmit/apply前に検査する。

通常UI/Tauri IPC/Editor/Hocuspocus継続認可/captured Page session/実ユーザーAuth/新native IME/Androidは未完成。専用API/previewはv0.21/schema3を保持し、v0.18 UI回帰証拠を継承。旧PoC/DB/IMEデータは変更せず、telemetry未実装/未収集。
