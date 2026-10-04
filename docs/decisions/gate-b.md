# Gate B: Offline and convergence viability — Conditional

2026-10-04、判定checkpoint v0.6.23。製品0.6.20。**判定はConditional。2026-10-04の判断委任に基づきCodexが残条件を受け入れ、Gate Cと条件付き技術採用の確定へ進む。無条件Passではない。** [PoC仕様](../plan/POC_SPEC.md) §10–15に従う。

## 正確性の根拠

- [Docker回帰](../../tests/evidence/step-8-structured-progress-20261003/SUMMARY.md): 実Rust SQLite＋Chromiumの統合crash4境界、Yjs全文／構造／state vector収束、再接続とnetwork chaos。原full runの型検査Failと修正後Passは区別して保持。
- [通常Windows保存済み復旧](../../tests/evidence/windows-native-ops-20261003/SUMMARY.md): 本文・Task／Relation pendingの端末保存後強制終了、offline再起動・native復元と実Rust監査。
- [通常Windows ACK前終了・pull復旧](../../tests/evidence/windows-native-network-20261003/SUMMARY.md): server commit後ACK保留中のRelation pending／prepared wire保持、offline復元、pullによるACK／receipt／cursor回復、独立RustとY.Doc peer・server台帳一致。
- [通常Windows大量データ](../../tests/evidence/windows-native-release-20261003/SUMMARY.md): 1,000 blockの入力保存と再起動復元、native ACK1,000、250 Task、台帳／receipt1009と独立peer一致。
- [Android P2 browser](../../tests/evidence/android-pixel7-20261003/SUMMARY.md): Pixel 7／Android17／Chrome154、26＋4操作と実Gboard遠隔composition。SQLite／native offline終了復旧は対象外。

[source照合](../../tests/evidence/windows-ms-ime-20261004/functional-source-audit.json)でAPI／collaboration／protocol／sync／native command／Rust storeのtracked sourceはv0.6.11とv0.6.20で同一。旧native証拠は実行版0.6.11のまま示し、0.6.20で実行したことにはしない。

## Conditionalとする条件

1. macOS P1とiOS WebKit P2は利用できる実環境がなく未実施。Android browser成功を両OSへ換算しない。
2. Windows1,000 block復元はmain UI観測上限3,567.4msで、2秒目安の達成を確認できていない。起動／helper／UIAを含む上限で、Page restore単独の所要時間ではない。[層別診断](../../tests/evidence/windows-native-profile-20261004/SUMMARY.md)は4起動のYjs22.8–24.5ms等を補完したが、通常cold paint／連続入力SLOではない。
3. 通常WindowsでSQLite transaction内部全4中間点への停止注入は未実施。Docker実Rust境界検査と通常Windows保存済み／ACK境界の証拠を組み合わせ、同一試験とは呼ばない。

## 委任に基づく確定判断

P0の収集済み保存／収束の正確性を維持し、未検証OSと性能の改善・再測定を残余リスクとして条件付き採用へ進める。対象OSを提供する前にその実OSで起動・編集・IME・再接続を確認する。Windows性能は通常releaseで編集可能時刻と連続入力を再測定し、結果を記録する。本番の保存保証／対応OS／SLOをこのPoCから無条件に宣言しない。

利用者の「これまでの判断や資料をもとにそちらで判断できることであれば自律的に判断してもよい」という明示委任を、今回のPoC残条件を評価する権限として適用した。これは利用者自身が各リスクを個別承認したという記録ではない。P0正確性はDocker実Rust境界検査とWindows実保存・通信境界検査で確認し、hostで内部4点を重複実行していないことを証拠の限界として残す。新しい正確性Failが確認された場合は再判定する。[全判断と後続検証](poc-autonomous-review.md)。
