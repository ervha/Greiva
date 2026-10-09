# View端末queue checkpoint

2026-10-09 / v0.65.0 / native16 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_VIEW_QUEUE.md)、[判断24件](../../../docs/decisions/private-database-view-queue.md)。

## 変更と確認

- create/update/新operation解決を単一の端末queueへ保存する。作成のbase/candidateはnull、pending Sourceはsource blocked、Page本文は不要。updateは観測済みhistory、解決は現在baseと元既知三値を捕捉する。同View未ACK1件とbusy/noWriteで元intentを守る。
- 元capture/index/SHA、8MiB UTF8 wire、format/key順保持を検査する。原ACK/cache/history/解決proofを同transactionで確定し、applied/conflict/rejectedとremote no-change choiceを区別する。conflict remoteを原reply fieldへ照合する。
- read/delta先行でqueueを消費しない。late ACK/current・first history/proof・cursorを保持する。欠損replayは補修せず失敗する。max100/正確i64/keyset/pending-only/SQL1行/32MiB windowと256MiB単一行上限を使う。大きいfilter base/ACKの2行でbyte分割と破損lookahead拒否を確認する。
- native15→16と旧schemaからのbound移行、foreign/partial DDL rollback、Source/Record/Page/Task/delta保持、Auth世代閉鎖を検査する。

## 結果と元失敗

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| 初回型チェック | Fail（View write import不足） | [原log](typecheck-initial.log) |
| 修正後型チェック | Pass | [修正直後](typecheck-corrected.log)、[最終](typecheck-final.log) |
| 初回新native | 14 Pass / 8 Fail（fixture） | [原report](initial-focused.json.gz)、[原log](focused-initial.log) |
| 修正・追加後新native | 29 Pass / 0 Fail | [report](focused.json.gz)、[log](focused.log) |
| 最終通常回帰 | 712 Pass / 208 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全34files | 208 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| ヘルプdesktop/mobile-dark-reduced-motion | 12 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| native/crash/features/frontend/Windows | Pass | [native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[frontend](frontend-build.log)、[Windows](windows-build.log) |

初回22条件の8 Failは試験fixtureの問題。Source ACKにcreated結果がなく、解決後の値変更ACKにbaseと同じversionを使っていた。また欠損注入用SQLite接続の外部キーがDELETEを先に拒否した。必要なresult/新versionと試験注入接続だけを修正した。正しいlocal/remote解決ケースは初回からPass。元Failを後の成功と別に残す。

新native29にはCOMMIT前後の実SIGKILL6 trials（enqueue/prepare/ACKの3cases内で各before/after）を含む。原ACK・resolvedBy・履歴/receipt/queueを再起動で照合しsame operation retryを確認する。最終通常712=既存683＋新29。既存SIGKILL/旧schema移行も全suiteで再確認する。

Docker source351、raw341一致・CRLF/LF text-only10、診断等excluded5を[source inventory](source-inventory.json)へ記録する。BOM/binaryはtext normalizeしない。app-owned版65、外部npm315/Cargo501・118保持を[照合](version-audit.json)。PE ProductVersion/FileVersion65、Docker/host SHA256一致：[Docker記録](windows-build.json)、[host inspection](host-exe-inspection.json)。compiler-family警告は残るがbuild exit0。hostでは起動していない。

## 残る境界と続行

View実HTTP/session/runtimeと6型Table/List操作画面、同entity offline successor/durable新draftは後続。端末queueのconfirmed ACKと一覧読込みをserver全体の同期完了に変換しない。actual Supabase正常login、Windows actual invoke/MS IME、Android/native credentials・offline grant、配備暗号化/native Gateは別条件。

次は元View capture/wireをcaptured Authの固定View write HTTPへ接続し、HTTP unknownの同operation再送とnative ACK unknownの元pair/networkless retryを区別する。その後に画面用runtimeと操作画面を接続する。追加の利用者手操作待ちはない。
