# View保存の判断

2026-10-09 / v0.47.0。[契約](../development/PRIVATE_DATABASE_VIEW.md)、[証拠](../../tests/evidence/private-database-view-20261009/SUMMARY.md)。回答済みAと継続開発指示に沿う保存基盤。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | View create/update/readを独立APIへ | 型だけからactual保存へ進める |
| 2 | Source参照だけを保存 | Record/Name/本文を複製しない |
| 3 | 既存署名/owner/device transaction | Viewにも同じ認証境界を適用 |
| 4 | canonical nested ID/strict wire | filter/列参照まで契約を固定 |
| 5 | Source UPDATE/SHARE lock | writerとreadを同じ保存境界で観測 |
| 6 | cross-Source ledger unique再検査 | 同IDの敗者をpartial保存しない |
| 7 | authoritative version history | 客先の推測baseを正本へ使わない |
| 8 | whole-field三値と非競合merge | 設定の意味をLWWで消さない |
| 9 | current/history/候補/ledger原子保存 | 失敗でpartial結果を残さない |
| 10 | exact再送は元receipt | 後の更新や解決で過去結果を変えない |
| 11 | unknown/stale/invalidを拒否履歴へ | 内容変更と拒否確認を分離 |
| 12 | fresh解決を別operationへ | 元三値候補と選択の監査を保持 |
| 13 | remote no-opでもresolved_by保存 | content versionだけで解決を判定しない |
| 14 | 候補を元ledger/historyと照合 | valid shapeだけの改変も拒否 |
| 15 | 明示8→9/default生成なし | 既存正本/鍵とnative8を保持 |
| 16 | actual PG/HTTP/kill＋help12 | host IME等へ検証範囲を拡大しない |
