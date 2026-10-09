# Record一覧の判断

2026-10-09 / v0.45.0。再開指示と回答済みAに沿う実装。[契約](../development/PRIVATE_DATABASE_RECORD_CATALOG.md)、[証拠](../../tests/evidence/private-database-record-catalog-20261009/SUMMARY.md)。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | writerの次へ小さいheader catalog | 端末受信/画面の前に列挙経路を作る |
| 2 | default50/max100 | 取得範囲を明示する |
| 3 | 値/title/bodyをheaderに入れない | 大きい内容は明示したRecord/Pageだけ取得 |
| 4 | Page参照と現在観測versionを返す | Name/本文正本を複製しない |
| 5 | creationOrderを別columnへ | UUID/端末時計の生成順をcommit順と混同しない |
| 6 | 旧Recordはstable ID順seed | 過去の作成順を推測して創作しない |
| 7 | 新規head/Record/ledgerは同transaction | partial位置や再送二重採番を防ぐ |
| 8 | 既存Source UPDATE lockを共有 | catalogとcreateの読取/commit境界を揃える |
| 9 | observed head固定のgdr1 | 途中の新規作成を次の一覧へ分ける |
| 10 | cursorへSource/device/purposeも束縛 | 他Sourceやgds1との混用を拒否 |
| 11 | numeric columnでlimit+1 | 文字列順とlookahead破損を避ける |
| 12 | filtered raw位置を進める | empty windowでも続行できる |
| 13 | 非active Pageを表示しない | filterを削除ACK/cache purgeへ扱わない |
| 14 | header versionは現在の観測 | 固定範囲を全内容の同期完了へ昇格しない |
| 15 | 明示7→8/read-only/native8保持 | 既存snapshot/receipt/鍵を自動変更しない |
| 16 | SIGKILL/全PG＋help12に限定 | backend変更へ必要な回帰、旧UI証拠は旧版のまま |
