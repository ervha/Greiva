# DB変更契約の判断

2026-10-09 / v0.49.0。[契約](../development/PRIVATE_DATABASE_CHANGES_CONTRACT.md)、[証拠](../../tests/evidence/private-database-changes-contract-20261009/SUMMARY.md)。回答済み初期DBの変更受信基盤。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | 実保存前にtyped packetを固定 | server/nativeで同じ意味を検証 |
| 2 | Record/Viewのdiscriminated union | payloadの種類を推測しない |
| 3 | snapshotとnullable候補 | 内容とConflict状態を一緒に表現 |
| 4 | resolvedByを保持 | remote no-opの解決も受信できる |
| 5 | Source/schemaを応答へ束縛 | 古い型定義や別DBへの適用を拒否 |
| 6 | canonical nested ID/Page binding | snapshotと候補のscopeを固定 |
| 7 | Source-bound parseを追加 | wire shapeだけで値/refsを承認しない |
| 8 | clone/deep freeze | 呼出元変更で受信済み値を変えない |
| 9 | Page-bound Nameを維持 | title/bodyの二重正本を作らない |
| 10 | default50/max100 | bounded受信を前提にする |
| 11 | raw progressとvisible gapを分離 | filter空windowでも位置を進められる |
| 12 | cursorを完了時にも必須 | 0/headの観測位置を保存可能にする |
| 13 | gdb1を別purposeへ | 作成一覧cursorを変更取得へ混用しない |
| 14 | durable世代/Source/deviceへ署名 | epochや端末を跨いだ再利用を拒否 |
| 15 | head/位置はexact BigInt | Number精度や端末時計に依存しない |
| 16 | schema10保持/契約8＋help12 | codec成功と実journal/native保存を分離 |
