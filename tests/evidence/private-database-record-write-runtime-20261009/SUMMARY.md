# Record画面用runtime checkpoint

2026-10-09 / v0.64.0 / native15 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_RECORD_WRITE_RUNTIME.md)、[判断18件](../../../docs/decisions/private-database-record-write-runtime.md)。

## 変更と確認

- local opening/enqueue/reloadはnetworkなし。create/update別pending-only max100 windowとglobal count/keyset、種類別queueFreshを使い、両読込みsettle後に一括採用する。失敗時は元dataをstaleとして保持しfake empty/half updateを作らない。
- unknown enqueueとqueued後read failureは元kind/intentのexact retryを保持し、reloadだけで消さない。known busyは既存updateと未保存のattemptを区別し、後続read failureでも新draftを勝手にretry保存しない。
- empty/Source・Page blocked/原ACKを分離する。unknown ACKのkind/pairはpending0観測でも保持してnetworkなしでretryする。known ACK後のread failureは原lastSendを保持し、retryAckを捏造しない。rejectedを適用成功へ変換しない。
- busy/observer/close/lease/遅着を検査し、閉鎖でprivate intent/list/result/pairを消す。自身のsessionを閉じ、共有workspace storeを保持する。
- 作成queueもSQL1行ずつ、32MiB window目安/128MiB単一行上限にする。大きい原intent/wire/ACKを持つ2行、exact nextAfter/global count/pending-only、byte切れ目の破損lookahead拒否を確認する。native schemaは15のまま。

## 結果と元失敗

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| 初回型チェック | Fail（private port/public method名衝突） | [原log](typecheck-initial.log) |
| 修正後型チェック | Pass | [修正直後](typecheck-after-method-names.log)、[最終](typecheck-final.log) |
| 初回portable（新runtime18＋既存送信17） | 35 Pass / 0 Fail | [report](initial-focused.json.gz)、[log](focused-initial.log) |
| 作成native（新byte1＋既存23） | 24 Pass / 0 Fail | [report](record-create-store.json.gz)、[log](record-create-store.log) |
| 初回actual signed HTTP-native Record（新runtime3＋既存6） | 9 Pass / 0 Fail | [report](initial-record-write-pg.json.gz)、[log](record-write-pg-initial.log) |
| 最終通常回帰 | 683 Pass / 208 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全34files | 208 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| ヘルプ画面desktop/mobile-dark-reduced-motion | 12 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| native/crash/features/frontend/Windows | Pass | [native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[frontend](frontend-build.log)、[Windows](windows-build.log) |

型checkの同名衝突はbound portをenqueueCreateStore/UpdateStoreへ改名して修正した。元Fail logを成功と別に保存する。actual test Failはなかった。最終通常683=既存664＋runtime18＋create byte1。既存native SIGKILL契約も通常suite内で再確認する。

実HTTP新3条件は同じ署名JWT/JWKS→PG schema11→Rust Registry/SQLite native15を使う。commit後enqueue return loss・local reload後のunknown保持・同操作retry、元ACK return lossとnetworkless retry、known busy/no overwrite、update HTTP loss/restartと元wire再送、known ACK後pending-only read return lossと原結果保持、Auth refresh中のcommit済み遅着HTTPと新runtime再開を検証する。署名fixtureでありactual Supabase正常loginではない。

Docker source349、raw339一致・CRLF/LF text-only10、診断等excluded5を[照合](source-inventory.json)。BOM/binaryをtext normalizeしない。app-owned版64、外部npm315/Cargo501・118保持を[照合](version-audit.json)。PE ProductVersion/FileVersion64、Docker/host SHA256一致：[Docker記録](windows-build.json)、[host inspection](host-exe-inspection.json)。compiler-family警告は残るがbuild exit0。hostでは起動していない。

## 残る境界と再開

View queueと6型Table/List操作画面、同Record offline successor/durable新draftは未実装。queueFreshは端末の最終読込みに関する状態でありserver同期完了ではない。actual Supabase正常login、Windows actual invoke/MS IME、Android/native credentials・offline grant、配備暗号化とnative Gateは別条件。

次はTable/Listのname/layout/visiblePropertyIds/filter/sortsを保持するView native queueへ進む。元base/候補と新operationによる解決、原wire/ACK proof、Source依存、read/delta/late ACK、移行・強制終了を分けて検証し、続いて実HTTP/runtimeと操作画面を接続する。
