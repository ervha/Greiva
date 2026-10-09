# Record作成端末queueの判断

2026-10-09 / v0.61.0。[契約](../development/PRIVATE_DATABASE_RECORD_CREATE_QUEUE.md)、[証拠](../../tests/evidence/private-database-record-create-queue-20261009/SUMMARY.md)。既存Record create writer/cacheの端末耐久性に関する自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | native13→14/server11保持 | 独立create操作表を追加 |
| 2 | createを先に独立検証 | update/新操作解決を実装済みにしない |
| 3 | pending intentをconfirmedと分離 | 架空version/Recordを作らない |
| 4 | Source定義とcreate intent捕捉 | 非同期中の入力変化を排除 |
| 5 | confirmed/pending Source proof要求 | 任意の定義で未所属DBへqueueしない |
| 6 | local Page document要求 | Name/本文Pageを別に複製しない |
| 7 | Source/Page待ちを明示 | 確認前にwireを作らない |
| 8 | local bootstrap原ACK検査 | wire/binary/digest/scope/createdAtを照合 |
| 9 | remote Pageの既存head許容 | local bootstrapを捏造しない |
| 10 | bootstrap後のbody pendingは独立 | 本文未送信をRecord確認と混同しない |
| 11 | 最古1件/元bytes固定 | 順序とoperation idempotencyを保持 |
| 12 | context/intent/wire checksum | 局所破損検知、Auth grantではない |
| 13 | enqueue前UTF8 8MiB guard | 永久にprepareできない操作を保存しない |
| 14 | operation/Record/Source-Page一意 | ID衝突を再利用や上書きにしない |
| 15 | original ACK/cache/history原子保存 | 片方だけ確認済みになることを防ぐ |
| 16 | write receiptの元queue proof | 架空read envelopeへ変換しない |
| 17 | read/deltaでqueue消さずlate保護 | 観測・ACK・cursorを区別 |
| 18 | exact replay非補修 | 欠損projection/historyを成功にしない |
| 19 | bounded pending/keysetとschema移行 | 旧queue/本文/typed replicaを保持 |
| 20 | native23/SIGKILL6＋全回帰 | update/View queue・HTTP/runtime・画面へ続行 |
