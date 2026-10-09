# View一覧の判断

2026-10-09 / v0.48.0。[契約](../development/PRIVATE_DATABASE_VIEW_CATALOG.md)、[証拠](../../tests/evidence/private-database-view-catalog-20261009/SUMMARY.md)。回答済みTable/Listを進める。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | 保存の次に小さいView header一覧 | 端末のView選択へ列挙経路を渡す |
| 2 | default50/max100 | 応答範囲を固定 |
| 3 | name/layout/versionを返す | 選択時に詳細設定を一括取得しない |
| 4 | filter/sorts/列/Record/本文は除外 | 大きい設定は単一View read |
| 5 | Source別creation位置 | UUIDや端末時計を作成commit順へ扱わない |
| 6 | 旧Viewはstable ID seed | 過去の作成順を推測しない |
| 7 | head/View/history/ledger同transaction | partial位置と再送二重採番を防ぐ |
| 8 | Source UPDATE/SHARE lock共有 | createとcatalogの境界を揃える |
| 9 | gdv1で生成head固定 | 途中の新Viewは次の一覧へ |
| 10 | scope/device/purposeへ署名 | Source/Record cursor混用を拒否 |
| 11 | numeric列でlimit+1 | 文字列順とlookahead破損を避ける |
| 12 | deleted raw位置を進める | 空windowでも取得が止まらない |
| 13 | head読取は非修復 | 破損を空の成功やcache削除へ変えない |
| 14 | label/versionは現在観測 | 固定メンバーを全設定snapshotへ昇格しない |
| 15 | 明示9→10/native8保持 | 旧正本/receipt/鍵を変更しない |
| 16 | actual PG/HTTP/SIGKILL＋help12 | fixture元Failとnative未検証を分離 |
