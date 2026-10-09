# Record更新・競合解決queue checkpoint

2026-10-09 / v0.62.0 / native15 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_RECORD_UPDATE_QUEUE.md)、[判断20件](../../../docs/decisions/private-database-record-update-queue.md)。

## 変更と確認

- confirmed Source/実base history/typed update/元解決候補を捕捉する。同Record未ACK1件、別operationはbusyで無書込み。Page本文取得や架空version、自己ACKを前提とする再baseを要求しない。
- immutable original wire/context/index/capture checksum、UTF8 8MiB、create/update間operation ID衝突を検査する。
- applied/conflict/rejected原ACKとwrite receipt/cache/history/currentを同transactionで保持し、applied解決だけresolvedBy/proofを確定する。no-change remote解決、元三値候補/部分merge、未設定/null/zero/falseを区別する。
- read/delta先行でqueueを消さず、最初のhistory/解決proof/cursorを保持する。late ACKでcurrentを戻さず、exact replayで欠損history/projection/candidateを補修しない。
- max100/検査済みlookahead/正確bigint/pending-only、SQL1行ずつ/32MiB window target/128MiB単一行上限。実際の大きなbase/原ACKを持つ2行でbyte分割・nextAfterを検証する。
- native0/5〜14→15 bound migration、Source/create queues・delta cursor・Page binary/Task pending、foreign/partial DDL rollback、Auth refresh/並行exact書込みを確認する。

## 結果と元失敗

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| 初回重点（新update27＋create23） | 48 Pass / 2 Fail | [原report](initial-record-update-store.json.gz)、[原log](record-update-store-initial.log) |
| fixture修正後＋移行/ID/byte window（新30＋create23） | 53 Pass / 0 Fail | [report](record-update-store.json.gz)、[log](record-update-store.log) |
| 最終通常回帰 | 647 Pass / 199 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全33files | 199 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| ヘルプ画面desktop/mobile-dark-reduced-motion | 12 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| 型/normal・crash native/feature/frontend/Windows | Pass | [型](typecheck-final.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[frontend](frontend-build.log)、[Windows](windows-build.log) |

初回2 Failはhistory/projection欠損の注入自体がfixture接続の外部キー制約で止まったため。意図した破損を作る試験接続だけforeign_keysをOFFにし、製品制約は保持した。元Failを修正後成功と別reportで保存する。重点53成功後、差分先行ordinary/resolutionの2条件と、unchanged local/明示nullの1条件を追加した。最終回帰は新update33をすべて含む（既存614＋33=647）。新SIGKILL試験はenqueue/prepare/ACK各COMMIT前後の6実プロセス死亡を含み、ACK前後のRecordとresolvedBy原子性・同操作再開を確認する。

Docker source344、raw334一致・CRLF/LF text-only10、診断等excluded5を[照合](source-inventory.json)。BOM/binaryをtext normalizeしていない。app-owned版62、外部依存npm315/Cargo501・118保持を[照合](version-audit.json)。Windows PE ProductVersion/FileVersion62とDocker/host SHA256一致：[Docker記録](windows-build.json)、[host inspection](host-exe-inspection.json)。compiler-family/PDB警告は残るがbuild exit0。hostでは起動していない。

## 残る境界と再開

今回のnative queueからRecord実HTTPを送るsession/runtime、View queue、6型Table/List操作画面は未接続。busy後の新draftを保持する画面も後続。serverの既存Record writer検証を今回の端末送信証明へ昇格しない。actual Supabase正常login、Windows actual Tauri invoke/MS IME、Android/native credential・offline grant、production encryption、native Gateは未確認。

次はcaptured Auth/contextと元wireをRecord HTTPへ接続し、HTTP結果不明とlocal ACK結果不明を分けた同operation retryを実signed HTTP→PG→Rust SQLiteで検証する。その後View queueと6型Table/List画面へ進む。
