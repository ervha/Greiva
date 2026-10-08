# Pageタイトル増分serverの全判断

2026-10-08 / v0.36.0。利用者の「区切りのcommitを続け、止めずに開発」指示に基づく自主判断。配備/破壊操作の許可を広げない。

1. title画面の次に順序付き増分serverを実装し、端末保存/session/UIは次の検証済み区切りへ分ける。
2. title版と独立したworkspace commit順を作り、値の変わらないConflict解決も通知する。
3. 明示schema4→5にし、本文/structured wireとnative7を保持する。
4. event/head/title/Conflict/operationを同transactionへ保存し、no-op/rejection/再送でeventを増やさない。
5. metadata writerだけをworkspace head lockで直列化し、commit順と採番順を一致させる。
6. headをresource/document前に予約し、bootstrap retryとrenameの逆順deadlockを防ぐ。
7. head/末尾不整合を拒否する。head0の初期化は新workspaceに限り、破損を自動repairしない。
8. exact bigint文字列と専用HMAC cursorを使い、workspace/epoch/stream/keyとcanonical表現・future位置を検査する。
9. 既存durable署名鍵を使い、key/epoch/owner/本文を再生成しない。
10. 毎queryを100 event＋101 lookahead/resource以内にし、全journal count/scanを追加しない。
11. raw順序/record/lookahead/末尾を検査し、破損ではpartial payloadやcursor進捗を返さない。
12. deleted Pageのpayloadを除外し、空頁でも取得位置を進める。削除通知/同期完了と解釈しない。
13. metadataはtitle操作当時の値とし、本文updatedAtだけの更新や候補nullで既存候補削除を指示しない。
14. upgradeでcurrent titleと全候補/解決操作を照合してseedし、不正seed/部分DDL/reinstallをrollbackする。
15. strict unit/実PG/CLI/HTTP/並行操作/期限/SIGKILLを検証し、fixtureと実Auth/native/暗号化の境界を保つ。
16. owned版/locks、source/依存、全回帰/build/証拠を確認してcommit/tag/pushし、短いメモを更新して端末保存へ続ける。

[契約](../development/PRIVATE_PAGE_CHANGES_SERVER.md)、[証拠](../../tests/evidence/private-page-changes-server-20261008/SUMMARY.md)、[判断索引](../plan/AUTONOMOUS_DECISIONS.md)。
