# Workspace wire/cursor検証境界 — 0.9.0

2026-10-05、Docker内。新protocol/workspace subpathにversion付きenvelope、scope/epoch/ACK identity検査を追加。server専用gw1 cursorはworkspace/structured stream/epoch/orderをHMACへ束縛。[全12判断](../../../docs/decisions/workspace-sync-boundary.md)。

| 確認 | 結果 |
| --- | --- |
| 型/通常frontend/Windows release cross-build | Pass |
| 通常unit/integration | 90 Pass、実DB専用21 skip。新wire8/cursor8含む |
| 新wire8 | 旧intent/causality保持、不正scope/version/client/重複拒否、invalid intentのpermanent rejection、別workspace/epoch拒否、欠落/二重/別対象ACK拒否、順序によらないID照合、bigint range |
| 新cursor8 | 0/Number精度超/PG最大exact、別workspace/epoch/key、署名改変、future、形式/長さ/canonical、署名済み不正content、明示設定要求 |
| 版/依存/source | 所有0.9.0、外部npm314/Cargo不変、normal build source80ファイルhost一致 |

[集約](verification.json)、Vitest原report gzip、実build/hashを保持。実DB21は[0.8.0](../private-access-20261005/SUMMARY.md)、画面59/実同期2は[0.7.0](../production-foundation-20261005/SUMMARY.md)の歴史的結果として区別。今回のコードは旧SQL/router/UIへ未接続で、これらを再実行したとしない。

JWT/Auth/production view/migration/全HTTP/CRDT、prepared/ACK/cursorの実transactionへの配線は未完了。cursor署名はuser認証ではない。epoch変更後bootstrap/保持期間を仮定せず、旧pendingを保持する。実provider/Native IME/Android製品のPassへ換算しない。
