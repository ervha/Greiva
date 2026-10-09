# View実HTTP・runtime checkpoint

2026-10-09 / v0.66.0 / native16 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_VIEW_WRITE.md)、[判断21件](../../../docs/decisions/private-database-view-write.md)。

## 実装

- 元queueのSource/base/候補/intent/sequence/wireを捕捉し、captured Authの固定View write HTTPへ元bytesを送る。empty/Source blockedはHTTPなし。HTTP unknownは同操作再送、native ACK unknownは元pairをnetworkなしで再保存する。原replyの全field/三値/選択/version/resultと世代閉鎖を検査する。
- 画面用runtimeへlocal opening、pending-only max100/byte keyset/global count/queueFresh、unknown enqueueの同操作retry、known busyのattempt分離、empty/blocked/原ACKを追加する。known ACK後read failureとACK unknownを分離し、closeで私有状態を消して共有storeを保持する。
- View/Recordのremote no-change解決でもapplied原ACKの対象値を選択値へ必ず照合する。Record conflict remoteも原replyのpresent/valueへ照合する。正常なabsent/null/no-change契約とschema16/server11を保持する。

## 元失敗と修正証拠

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| 初回View送信/runtime | 26 Pass | [report](initial-focused.json.gz)、[log](focused-initial.log) |
| 追加filter試験の中間 | 27 Pass / 1 Fail（fixture） | [report](focused.json.gz)、[log](focused.log) |
| fixture修正後・選択値guard前 | 28 Pass | [report](focused-final.json.gz)、[log](focused-final.log) |
| 初回actual signed HTTP-native View | 8 Pass / 1 Fail（fixture table参照） | [report](initial-view-write-pg.json.gz)、[log](view-write-pg-initial.log) |
| fixture修正後actual View | 9 Pass | [report](view-write-pg.json.gz)、[log](view-write-pg.log) |
| 選択値guard前の否定再現 | 3 Fail / 1 Pass / 88対象外skip | [原report](choice-guards-before.json.gz)、[原log](choice-guards-before.log) |
| 選択値guard修正後の否定 | 5 Pass / 105対象外skip | [report](choice-guards-after.json.gz)、[log](choice-guards-after.log) |
| 修正後View28＋Record sender18 | 46 Pass / 0 Fail | [report](after-choice-guards-focused.json.gz)、[log](after-choice-guards-focused.log) |
| 最終通常回帰 | 743 Pass / 217 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全35files | 217 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| ヘルプdesktop/mobile-dark-reduced-motion | 12 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| 型/native/crash/features/frontend/Windows | Pass | [型](typecheck-final.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[frontend](frontend-build.log)、[Windows](windows-build.log) |

初回actualPG Failは最後のPage不要確認でprivate_pagesという存在しない試験テーブルを参照したため。正しいprivate_page_documentsへ修正した。中間filter Failはremote選択の否定試験で未選択localだけを変更していたためで、選択側の不整合へ修正した。これらのfixture Failと、後述する実装不具合の再現Failを分けて保持する。

remote選択でlocalがbaseと同値の場合、従来の「意味のある値変更」条件だけでは、異なる原reply値をapplied resolutionとして受け入れた。否定試験でView sender・View native ACK・Record native ACKの3 Failを再現した。ViewとRecordのnative/protocol/senderに、applied resolutionの選択値を常に照合する検査を追加した。Record conflict remoteと原replyの不整合も拒否する。修正後5 Passを確認し、正しいremote no-change解決は維持する。

修正前に終えた通常740/PG217も[通常](before-choice-guards-normal.json.gz)、[PG](before-choice-guards-postgres.json.gz)とbefore-choice-guardsの各logに保存する。これらは新しい否定条件を含まない旧検証であり、修正後の最終結果を代用しない。最終通常743=以前712＋新View portable28＋native View/Record guard2＋Record sender guard1。native View30/Record update34、既存SIGKILL・移行を全suiteで再確認する。

actualHTTP9条件は署名JWT/JWKS→PG schema11→Rust Registry/SQLite schema16を通す。Source待ち/Page本文不要、HTTP/ACK loss/restart、5設定とordered配列/filter/null、partial merge/三値/local・remote選択/stale原rejected、replacement/Auth refresh/native close/device403、runtime unknown enqueue/reload/同操作retry、busy/no overwrite、known ACK/list failureと世代閉鎖を確認する。actual Supabase正常loginではない。

Docker source355、raw345一致・CRLF/LF text-only10、診断等excluded5の[source inventory](source-inventory.json)とapp-owned版66・外部npm315/Cargo501・118の[照合](version-audit.json)を保存する。BOM/binaryはtext normalizeしない。PE ProductVersion/FileVersion66とDocker/host SHA256：[Docker記録](windows-build.json)、[host inspection](host-exe-inspection.json)。compiler-family/PDB警告は残るがbuild exit0。hostでは起動していない。

## 続行と境界

次はSource/Record/Viewの基盤を6型Table/Listの操作画面へ接続する。同entity offline successor/durable新draft、actual Supabase正常login、Windows actual invoke/MS IME、Android/native credentials・offline grant、配備暗号化/native Gateは別条件。queueFreshや一覧の取得完了をserver全体の同期完了へ変換しない。追加の利用者手操作待ちはない。
