# Record保存の判断

2026-10-08 / v0.44.0。回答済みAと継続開発の委任に沿う実装。[実装](../development/PRIVATE_DATABASE_RECORD.md)、[証拠](../../tests/evidence/private-database-record-20261008/SUMMARY.md)。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | actual Record writerをSourceの次へ | pure planを保存成功へ扱わない |
| 2 | typed/canonical requestを先に捕捉 | async待機後のcaller変更を隔離 |
| 3 | owner/device/Page＋Source照合 | 実在/active bindingをtransactionで検査 |
| 4 | 既存Page参照、Nameを複製しない | title/body正本を一つに保つ |
| 5 | Source内のPage bindingを一意にする | 同Sourceの重複Recordを拒否、別Sourceは別判断 |
| 6 | Source lockで初回/更新/再送を直列化 | 未存在Recordとbindingのraceを保護 |
| 7 | current/history/ledger/candidateを原子保存 | 部分成功を作らない |
| 8 | unknown baseはimmutable rejection | 現在値へのsilentrebaseをしない |
| 9 | 非競合fieldは競合と同時に保存 | 異fieldの意味ある変更を消さない |
| 10 | 候補は三値/presence/版を保持 | 元操作とcandidateを上書きしない |
| 11 | 解決にobserved versionも照合 | 正しいIDだけで改変候補を受けない |
| 12 | remote解決は新操作、値no-op許容 | 候補解決と値変更を区別 |
| 13 | 明示null保存と欠落を区別 | 両snapshotにkeyなしの入力も保存 |
| 14 | replayは歴史/candidateも照合 | 壊れたreceiptを成功へ返さない |
| 15 | 明示6→7/read-only、native8保持 | 既存データ/鍵を自動修復しない |
| 16 | 実PG/署名HTTP/SIGKILL＋元Fail保持 | Dockerと実Auth/native Gateを分離 |
