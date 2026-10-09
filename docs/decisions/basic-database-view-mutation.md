# View変更の判断

2026-10-09 / v0.46.0。[契約](../development/BASIC_DATABASE_VIEW_MUTATION.md)、[証拠](../../tests/evidence/basic-database-view-mutation-20261009/SUMMARY.md)。回答済みAのTable/List設定を保存基盤へ進める。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | portable Domainでintentとplanを分ける | server/nativeの権威ある保存へ共通契約を渡す |
| 2 | 設定5fieldを初期対象にする | 未合意group等を追加しない |
| 3 | ID/Source bindingをimmutableにする | ViewからRecordを複製しない |
| 4 | Source/schemaを捕捉する | 古い定義や別Sourceへ誤適用しない |
| 5 | 空/undefined/未知patchを拒否 | 欠落と明示filter nullを分ける |
| 6 | Name表示とtyped refsを検証する | 初期queryと設定契約を共通化 |
| 7 | clone/deep freeze | 呼出元の配列変更でintentを変えない |
| 8 | 検証scaffoldは保存しない | 仮の設定をauthoritative baseへ使わない |
| 9 | exact base/同version一致を検査 | 欠落historyを推測で補わない |
| 10 | 別fieldを保持し三値で計画 | meaningful editをLWWで消さない |
| 11 | 複雑設定はwhole field | 列/sort順やfilter意味を自動変更しない |
| 12 | object順無視/配列順保持 | portable構造比較の意味を固定 |
| 13 | active候補と現在remoteを確認 | 古い候補や変更済み対象を誤解決しない |
| 14 | fresh現在base/旧観測版を保持 | 別field更新後の新解決と古いintentを区別 |
| 15 | remote no-opとdurable解決を分離 | writerの新operation/receipt記録が必要 |
| 16 | schema8保持/専用11＋help12 | 純粋契約の証拠を実保存/native Gateへ拡大しない |
