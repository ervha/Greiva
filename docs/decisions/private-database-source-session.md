# DB定義取得・保存sessionの判断

2026-10-09 / v0.52.0。[契約](../development/PRIVATE_DATABASE_SOURCE_SESSION.md)、[証拠](../../tests/evidence/private-database-source-session-20261009/SUMMARY.md)。初期DBの認証付き取得と端末保存を接続する自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | portable Source session | HTTPと端末commitの境界を固定 |
| 2 | contextと関数receiverを捕捉 | 呼出元変更で保存先を変えない |
| 3 | 明示catalog/read | openだけでnetworkを開始しない |
| 4 | catalogはheader観測のみ | 定義受信/fullsync/ACKと分離 |
| 5 | max100/raw進捗/循環検査 | 空filter windowでもbounded再開 |
| 6 | Source-bound strict response | 別workspace/Source/型を保存しない |
| 7 | request/response clone/freeze | retry pairを呼出元から独立 |
| 8 | 1操作と結果不明pair | 新HTTPが未知commitを置換しない |
| 9 | retryは同response・networkなし | 新応答では元保存結果を確認できない |
| 10 | closeでpair解放 | 再起動では明示readへ、送信queueとは別 |
| 11 | trusted path/既存Auth HTTP再利用 | inputからorigin/保存先を注入しない |
| 12 | NativeWorkspaceStore factory | captured connection/storeを具体的に接続 |
| 13 | 置換/refresh/closeで旧世代取消 | late HTTPとadmitted commitを分離 |
| 14 | 401/403は既存connection閉鎖 | fixtureのtransport期待をclosedへ訂正 |
| 15 | portable8＋actual HTTP/native PG2 | Auth login fixtureと実HTTP/SQLiteを区別 |
| 16 | server11/native9保持 | Source作成/Record/View queue・delta/UIへ続行 |
