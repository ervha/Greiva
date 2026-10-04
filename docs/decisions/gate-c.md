# Gate C: Structured sync viability — Pass

2026-10-04、判定checkpoint v0.6.23。**判定はPass。Gate A確定とGate Bの委任によるConditional受入後に確定。** [PoC仕様](../plan/POC_SPEC.md) §7–11／13–15の正確性と時間記録を対象とする。

## 正確性の根拠

- [0.6.11 Docker回帰](../../tests/evidence/step-8-structured-progress-20261003/SUMMARY.md): 通常48 Pass、実PostgreSQL別20 Pass、Conflict UI2、統合crash4、性能4。各ACKのdurable保存が次pushより先、local／peer／server／cursor一致、同期済みの早期表示なし。
- [skip再照合と実DB再実行](../plan/SKIPPED_VALIDATION_REVIEW.md): 通常skip20件を旧・現在のPostgreSQL別run20 Passへ名前で対応付け。通常skipを消していない。
- [Windows ACK境界](../../tests/evidence/windows-native-network-20261003/SUMMARY.md): native pending／prepared wireとoperation ID保持、server commit後ACK前終了、pullによるreceipt／ACK／cursor回復。native duplicate POSTの完全実証ではない。
- [Windows Conflict](../../tests/evidence/windows-native-conflict-20261003/SUMMARY.md): base／local／remote保持、異field merge、draft保持、pointer／keyboardによる明示解決、未解決Conflict再起動。解決は新operation、7 native operationと9 receipt／台帳、独立peer一致。
- [Windows1,000操作](../../tests/evidence/windows-native-release-20261003/SUMMARY.md): 1,000 operation IDを保持し全acknowledged、250 Taskの最終値と台帳／receipt1009、独立Rust peer／cursor一致。クラッシュ・重複・キュー消失なし。

API／protocol／sync／Rust storeのtracked sourceは[0.6.11→0.6.20で同一](../../tests/evidence/windows-ms-ime-20261004/functional-source-audit.json)。native証拠の実行版を最新へ書き換えず、最新の通常回帰と対応付ける。

## 時間と残余リスク

通常Windowsの1,000操作は最初→最後のserver応答間75,973ms。初回request前・最後のnative ACK commitまでの区間は含まず、end-to-end時間やper-operation SLOと呼ばない。仕様は正確性・最終整合と所要時間の記録を要求し、1,000操作に固定秒数の合格閾値は置いていない。

Docker改善比較ではsnapshot回数1,024→300、応答量375MB→110MBを観測。host負荷やpullの長い区間があるため、同期時間差すべてを変更の効果とはしない。本番規模の容量・速度保証は対象外。

## 次の判断

Gate Aの連続入力保存照合とGate Bの委任によるConditional受入を終え、正式判定をPassと確定した。[判断全件](poc-autonomous-review.md)。未確認のnative全transaction境界やAPI duplicate POSTを既存の結果へ混ぜない。
