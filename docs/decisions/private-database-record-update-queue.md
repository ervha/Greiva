# Record更新・競合解決端末queueの判断

2026-10-09 / v0.62.0。[契約](../development/PRIVATE_DATABASE_RECORD_UPDATE_QUEUE.md)、[証拠](../../tests/evidence/private-database-record-update-queue-20261009/SUMMARY.md)。既存Record writer/cacheの端末耐久性に関する自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | native14→15/server11保持 | 独立update操作表を追加 |
| 2 | 確認済みSource/Record要求 | 架空baselineを作らない |
| 3 | 元の実base history捕捉 | 意味ある編集を暗黙LWWにしない |
| 4 | 同Record未ACK updateは1件 | 自己ACK versionへの暗黙変換を避ける |
| 5 | busyは既存operation付き無書込み | unknown保存と区別し、新draftを守る |
| 6 | 本文の端末取得を要求しない | 確認済みPage bindingで操作する |
| 7 | 解決候補と元choiceを捕捉 | remoteの変化で選択を変えない |
| 8 | 最古1件/元wire固定 | 元formatとidempotencyを保持 |
| 9 | context/base/candidate/wire checksum | 局所破損検知、Auth grantではない |
| 10 | canonical ID/6型/UTF8 8MiB | 不正・送信不能な操作を保存しない |
| 11 | create/update operation ID共通衝突防止 | server Record ledgerに合わせる |
| 12 | applied/conflict/rejected原結果を保持 | ACKと編集値の適用を混同しない |
| 13 | ACK/cache/history原子保存 | 原write receiptを架空readにしない |
| 14 | 解決appliedだけresolvedBy原子確認 | rejectedで候補を消費しない |
| 15 | no-change remote選択も新operation | 値の変更と解決を分離する |
| 16 | read/delta/late ACK境界 | first proof/cursor/currentを保持 |
| 17 | exact replay非補修 | 欠損history/projectionを成功にしない |
| 18 | max100/keyset＋32MiB window | 大きいbase/ACKで無制限fetchしない |
| 19 | bound移行/strict IPC/認証世代 | 旧queueと私有データを保持 |
| 20 | 実SQLite/SIGKILL6＋全回帰 | View queue・Record HTTP/runtime・画面へ続行 |
