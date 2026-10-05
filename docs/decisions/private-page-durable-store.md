# Workspace別Page耐久保存の全判断

2026-10-05、v0.22.0。利用者の継続開発/自律判断委任に基づき、追加手操作なしで端末保存を先行する。

1. 新workspace-bound Rust/sqlx RepositoryへPage保存/送信待ち/receiptを追加する。通常PoC PageStore/旧SQLiteへの帰属推定や移行は行わない。
2. private local schemaは6、server schemaは既存3、wireは1として区別する。空の新規DBまたは既存binding検査済みschema5だけをupgradeする。Task/Relation queue/prepared/cursor/bindingを保持する。
3. schema5に既存Page metadataがある場合は送信履歴の帰属が不明なので拒否する。partial table/異なるowner/issuer/workspace/client/epochはrollbackし、内容を採用・削除しない。通常PoCはprivate6を開けない。
4. Page作成は初期metadata/bytes/digest/正確なbootstrap wire/送信待ちを同じSQLite transactionでcommitする。再送用のtitle/initial update/clientを後から作り直さない。
5. local appendはbytes/digestと送信待ちwireを同じtransactionに保存し、commit完了前の送信可能性を作らない。同bytes再入力ではqueueを重複させない。
6. pendingはPage別の保存seq順でprepareし、bootstrapを後続appendより先に確認する。seqはdecimal string。prepare時はnative digest/client/schema/wire/実保存bytesと初期bootstrap identityを再検査する。
7. nativeはサイズ・binding・checksum・canonical base64urlを検査するbinary repositoryで、Rust内の意味的Yjs decoderではない。Yjs構文/依存/clockの検証はserverと次工程のclient adapterで担う。既存crateを増やさず小さなbase64url encode/decodeを実装し、実Yjsと600k bytesで検証する。
8. 初期titleのUTF-16長/update512KiBをserver requestに合わせる。remote合成diffは入力frame上限を流用せず保存する。新しい製品Doc最大規模/保持期限/GCを創作しない。
9. ACKはbound scope/Page/schema/digest/order、正確なdurable prepared wireと先頭pending seqを照合してreceiptをatomic commitする。別frameをskipしたACK/違うwire/foreign responseではpendingを消さない。
10. server ACKの最新head/vectorやbootstrap updatedAtは再送時に変わり得るため、応答全体の不変性を要求しない。digest/serverOrder/初期createdAtは保持して変化を拒否し、最初のreceiptは保存する。
11. remote readはscope/metadata/digest/canonical bytes/headを検査してmetadata/bytes/headを同じtransactionへ保存する。受信bytesを再送queueへ入れず、後の同bytes通知もremote echoとして重複送信しない。Editorへのapplyは端末commit後とする次工程の契約。
12. 遅いreadのbinary情報は保持するがserver headを戻さず、古いmetadataで新しい状態を上書きしない。pendingがあるときもlocal updatedAt/titleを守り、ACKでlocal binaryを置換・破棄しない。
13. loadは自動空Pageを作らず、private管理行/metadata/digest/bytes/headを検査する。missing/corrupt bytesやprepared wireは失敗として保持する。APIはpendingと観測headだけを返し、それを全peer同期/権限/offline利用許可の証明にしない。
14. 既存test-only JSON-lines native driverにPageコマンドを追加する。Tauri IPC/通常UIには未接続で、test bridgeを製品Web永続化へ転用しない。logout/失効後offline閲覧の製品方針を仮定しない。
15. create/append/ACK/receiveの各COMMIT前後8条件で実driver SIGKILLを行う。再起動時にbinary/queue/receipt/headが全てcommit前または後の状態で、同wire/bytes retryが重複しないことを確認する。
16. 新native13＋実PG1、通常/PG/型/frontend/Windows buildと外部lock/sourceを確認する。signed fixture HTTP＋2つのRust SQLiteでACK喪失/並行編集/収束/失効pending保持を検証。Docker toolchainのrustfmt未導入は任意整形を見送り、host toolchainを追加しない。backend/UI変更なしで専用APIはv0.21/schema3と既存画面証拠を保持する。

[手順と残範囲](../development/PRIVATE_PAGE_DURABILITY.md)、[証拠](../../tests/evidence/private-page-store-20261005/SUMMARY.md)、[全判断索引](../plan/AUTONOMOUS_DECISIONS.md)。次はcaptured auth/workspace/Pageのclient sessionと保存前後のYjs検査を接続する。
