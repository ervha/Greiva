# 基本DBの初期基盤判断

2026-10-08 / v0.41.0。初期提供順/継続開発の委任に基づく自主判断。初期型A/B/Cの任意質問は未回答で、Aを暫定基盤範囲とする。新しい利用者回答とは記録しない。[実装](../development/BASIC_DATABASE_FOUNDATION.md)、[証拠](../../tests/evidence/basic-database-foundation-20261008/SUMMARY.md)。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | P3 portable型/ビュー処理から進める | 手操作・配備に依存しない、提供画面完成とはしない |
| 2 | 6型/Table/Listを初期subsetとする | A暫定案、全型/ビュー要求を保持 |
| 3 | Textはplain、Dateはdate-only | rich/date-time/range/timezoneは後続へ明記 |
| 4 | Source/Recordのworkspaceを照合 | 認証自体の代替ではなく型境界 |
| 5 | Nameを一つのPage metadataへbinding | Record.valuesへtitleを複製しない |
| 6 | Select/Propertyは安定ID | renameで値/filterの参照を失わない |
| 7 | null/欠落とblank/0/falseを区別 | 不正なdefault/coercionで消さない |
| 8 | Number有限・実在日付を検証 | string数値、NaN、year0、timezone混入を拒否 |
| 9 | active snapshot契約のみ | tombstone/物理schema/移行/認可bindingは次工程 |
| 10 | Table/List共通query | 同じRecordの参照で複製しない |
| 11 | filterの型・参照を事前検証 | 未知property/optionを空値として無視しない |
| 12 | 3段AND/ORと明示した処理上限 | 無限木/黙ったtruncateを避ける |
| 13 | queryはloaded-windowを返す | 部分一覧を全体/最新と表示しない |
| 14 | null末尾/Select順/Record ID tie | viewを替えてもdeterministicに比較 |
| 15 | clone/deep freezeと重複拒否 | 呼出元編集とqueryを隔離する |
| 16 | 既存Task/本文と全Gateを維持 | 新DB保存・同期・UI/IMEの成功は別工程 |
