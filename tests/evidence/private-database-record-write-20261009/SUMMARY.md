# Record実HTTP送信 checkpoint

2026-10-09 / v0.63.0 / native15 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_RECORD_WRITE.md)、[判断16件](../../../docs/decisions/private-database-record-write.md)。

## 変更と確認

- 種類明示create/updateの最古1件をprepareし、元sequence/context/wire/operation/Source・typed intent・実base/候補をlimit1 keysetで確認する。empty/Source・Page blockedはHTTPを呼ばない。
- 開設時のAuth lease/context/portsと固定Record write経路へ元bytesを送る。JSONの空白やvalue key順を再生成せず、意味だけを照合する。typed原reply/三値/meaningful field/未設定・null・zero・falseを検査する。
- HTTP unknownは同operationのdurable wireを再送し、native ACK unknownはimmutable元kind/prepared/replyをnetwork/prepare/captureなしでretryする。invalid replyでACK retryを捏造しない。rejectedは原known ACKであり値の適用とは区別する。
- replacement/refresh/native close/device403で旧sessionを閉じ、遅着結果を採用せず、元queueを新bootstrap/sessionから復旧する。

## 結果と元失敗

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| 初回portable送信境界 | 15 Pass / 2 Fail | [report](initial-focused.json.gz)、[log](focused-initial.log) |
| fixture修正後portable | 17 Pass / 0 Fail | [report](focused.json.gz)、[log](focused.log) |
| 初回actual signed HTTP→PG→native | 6 Pass / 0 Fail | [report](initial-record-write-pg.json.gz)、[log](record-write-pg-initial.log) |
| 最終通常回帰 | 664 Pass / 205 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全34files | 205 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| ヘルプ画面desktop/mobile-dark-reduced-motion | 12 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| 型/normal・crash native/feature/frontend/Windows | Pass | [型](typecheck-final.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[frontend](frontend-build.log)、[Windows](windows-build.log) |

初回2 Failはcontext/ports固定試験でfixtureのqueue contextと呼出元contextが同objectを参照し、caller変更が保存済みcontextまで変えたため。実装は異なるcontextを拒否していた。fixture queue contextだけをcloneし、context照合を弱めず再検証した。元Failと修正後成功を別reportで保持する。

実HTTP6条件ではSource/Pageを既存の正規sessionで確認し、peer editは同じ実PG Record writerを使う。作成の依存待ち→HTTP loss→restart→native ACK return loss→networkless retry、更新の明示null/zero/falseと同operation replay、部分merge/三値/local・remote no-change解決、stale解決の原rejectedと未解決候補保持、replacement/refresh/native close中のcommit済みHTTP、device403と再bootstrapを含む。元wire再送でserver operationsが二重増加しないこと、保存済みrequest/resultにAuth email/JWTを入れないことを確認する。署名fixtureでありactual Supabase正常loginの証明ではない。

重点成功後、portableのnull比較をnativeと同じ欠損field stateのnull値へ揃えた。最終通常664/全PG205はこの最終sourceを含む。既存native queue/SIGKILL回帰も通常suite内で再確認したが、新native schemaや新SIGKILL契約を追加したcheckpointではない。

Docker source347、raw337一致・CRLF/LF text-only10、診断等excluded5を[照合](source-inventory.json)。BOM/binaryはtext normalizeしない。app-owned版63、外部npm315/Cargo501・118保持を[照合](version-audit.json)。PE ProductVersion/FileVersion63、Docker/host SHA256一致：[Docker記録](windows-build.json)、[host inspection](host-exe-inspection.json)。compiler-family警告は残るがbuild exit0。hostでは起動していない。

## 残る境界と再開

画面用runtime/未送信一覧・busy/draft/error/retry状態、View queue、6型Table/List、同Record offline successor/durable新draftは未実装。actual Supabase正常login、Windows actual invoke/MS IME、Android/native credentials・offline grant、配備暗号化とnative Gateは別条件。

次はRecord送信を画面用runtimeへ接続し、local opening/未送信一覧、保存・ACK結果不明retry、known busy、blocked、原結果とqueue freshnessを区別する。その後View queueと6型Table/List画面へ進む。
