# Windows 0.6.11のACK途中終了・再接続・独立peer照合

2026-10-03、記録checkpoint v0.6.13。製品コード・manifest・実行物は0.6.11のまま。[起動記録](launch.json)。通常embedded exeのSHA-256は `cc806e646f8093fe3ee387d0524c68dd4ec3c6808fa794be33e84d0fd74ecf36`。診断logger・crash-test-hooksを含まない既存候補を使用した。

## 条件と観測

前回の停止済み[Windows操作DB](../windows-native-ops-20261003/SUMMARY.md)を別のSQLite／WebView保存先へコピーし、Page2件・Task1件・Relation1件・pending2件を引き継いだ。元DB／WAL／SHMは今回の終了後も[初期hashと一致](original-and-crash-copy-hashes.json)。IME69-A/BのDBも対象外。

Dockerの独立schema `greiva_native_20261003_0611` で通常API／collaborationを起動。試験用[HTTP proxy](services.mjs)が上流APIの実commit後のACK応答を保留する。製品やSQLite transactionへ停止hookは追加していない。API／collaborationを含む135入力ファイルの[host／container byte一致](source-verification.json)を確認。Node 24.19.0、既存開発image `sha256:50277a5f84065501795f4106631bb39cda9df4c87ec7a5969b0f99c2518c2b3b`、2 CPU／4 GiB、host公開は127.0.0.1の3000／1234のみ。独立peer／DB監査もDocker内で実行した。

最初のproxyはCORS preflight headerの転送不足により400／Failed to fetchになった。header転送を修正してサービスを再起動し、通常nativeのretryで回復した。[初期UI原記録](native-ui-observations.json)の12:14:45のlabel「during held upstream ACK」は予定条件を記したもので、実際はCORS失敗時の送信待ち2件。ACK保留の証明には用いない。container build時のroot所有ファイル、監査scriptの未導入ws importとUUIDv4指定も試験環境の不備として修正。製品障害として扱わない。

| UTC | 実際の境界 |
| --- | --- |
| 12:17:00.813 | Task createをserver order 1でcommit、proxyがACKを保留 |
| 12:17:15.878 | native HTTPの15秒timeoutで接続が切れる |
| 12:17:25.841 | native pullがTask order 1を取得し、ローカルreceipt／ACK・cursor 1へ復旧 |
| 12:17:25.892 | Relation createをserver order 2でcommit、proxyがACKを保留 |
| 12:17:32.176–32.185 | 通常Windows TauriをStop-Process -Forceで終了。Relationはpending・prepared wire保持、local resultなし、receipt1件・cursor 1 |
| 12:20:04.425以降 | サービス停止状態で同じDBを[再起動](offline-restart.json)。native本文・Relation・送信待ち1件・offlineを確認 |
| 再接続後 | native pullでRelation order 2を保存し、送信待ち0件・cursor=head 2・同期済みへ復旧 |

[実ACK応答](held-ack.json)・[選別したproxy原event](selected-proxy-events.json)・[終了時刻](ack-crash.json)・[offline復元画面](offline-restored.jpg)・[復元UI](offline-ui-observation.json)・[再接続UI](reconnected-ui-observation.json)・[最終画面](final-native.jpg)・[最終UI記録](final-native-ui.json)。最初はTask ACK境界での終了を予定したが、実際にはtimeout後のpull復旧が先に進み、Relation ACK境界で終了した。予定を成功した実験へ読み替えず、実際の境界を記録する。

Page選択のUI AutomationクリックはWebViewの一時popup上として拒否された。再観測後、Enterで選択を確定し、AUTO611-BLOCKSの保存・同期済みを確認した。本文は編集していない。Alt+F4後のプロセス不在と[SQLiteコピーhash一致](final-copy-hashes.json)を確認し、Computer Useを解除した。

## 独立照合の結果

[監査script](verify-network.mjs)をDocker内で実行し、[最終結果](verification.json)を保存した。

- crash／最終SQLiteのread-only integrity_check=ok、全Yjs update digest一致。別の書込み可能コピーで実Rust repositoryのload／snapshotとも一致。
- WIN611-OPSは108更新、AUTO611-BLOCKSは22更新。本文・構造・clock・既存全update hashを維持。
- crash時はTask acknowledged／Relation pending、receipt1件・cursor 1。最終は両方acknowledged、receipt2件・cursor=head 2。operation IDとprepared wireは不変。
- PostgreSQL台帳は同じoperation IDの2件のみで、requestとresultがnativeの保存データに一致。
- 空の独立Rust SQLite＋通常structured engine／HTTPで取得したTask・Relation・conflict/error・cursorがnativeと一致。
- 空の独立Y.Doc＋Hocuspocus peerをPageごとに接続し、全文XMLと全clockがnative保存データと一致。

このrunのnative回復は**pullによるACK補完**。同じPOSTをnativeが再送した証拠ではない。API／collaborationの再起動を含むが、native SQLite transaction途中／cursor commit直前の停止、API SIGKILLの全境界、Conflict UI、全block操作、release性能、Android実OSは今回の対象外。既存[Docker回帰](../step-8-structured-progress-20261003/SUMMARY.md)は別証拠。Microsoft再変換の受入例外を維持し、最終Gateは未判定。

再実行には明示した停止DBコピー・baseline JSON・実Rust driver・同じisolated schemaとPage journalが必要。通常APIに接続したまま元fixtureを変更しない。[proxy制御script](control.mjs)は検証container用。

[選別証拠の整合・文書リンク検査](evidence-check.json)はDockerでPass。[検査script](check-evidence.mjs)。製品suiteの再実行やGate合格ではない。
