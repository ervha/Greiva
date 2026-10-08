# 基本DB変更・競合の判断

2026-10-08 / v0.42.0。初期順/継続開発の委任に基づく自主判断。[実装](../development/BASIC_DATABASE_MUTATION.md)、[証拠](../../tests/evidence/basic-database-mutation-20261008/SUMMARY.md)。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | create/updateのtyped intentを追加 | writerより先に失敗/比較契約を検証 |
| 2 | Source/schemaを捕捉 | definition変更で古い入力を黙って変換しない |
| 3 | create基底null/update既知version | 作成と既知基底の変更を区別 |
| 4 | update空/Name複製を拒否 | title正本を別に作らない |
| 5 | clone/deep freeze | async writer導入前にcaller変更を隔離 |
| 6 | 同versionの異内容を拒否 | 一つの基底を別内容へ書換えない |
| 7 | mergeは比較planだけ | durable/ACK/最新状態の成功と混同しない |
| 8 | 別fieldのremote変更を保持 | Record全体のLWWで消さない |
| 9 | local無変更/remote一致はno-op | 古い値の上書き/不要なConflictを避ける |
| 10 | 同field三値は候補へ | base/local/remoteを失わない |
| 11 | presenceとtyped valueを保持 | missingをsaved nullとして創作しない |
| 12 | conflict fieldはremoteをproposalへ | pending localはintent/candidateで別保持 |
| 13 | 解決は新intentを返す | 候補や元履歴をその場で削除しない |
| 14 | 現在版/remote/active/choiceを照合 | 別端末解決や改変候補を受けない |
| 15 | remote選択でも解決intentを残す | 値no-opと候補解決の記録を分ける |
| 16 | operation/atomic writerは後続 | Auth/履歴の入力doubleを実adapter proofにしない |
