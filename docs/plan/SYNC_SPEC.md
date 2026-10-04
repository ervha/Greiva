# Structured sync本番契約候補

2026-10-05、設計案。[architecture](ARCHITECTURE.md)、[データ](DATA_MODEL.md)、[PoC検証](../decisions/gate-c.md)を基準にする。初期版は個人workspace/自分の端末間。wire変更は未実装で、現protocolのTask/Relationと本番案を分ける。

## 入出力と不変条件

commandはworkspace/対象/intentを受け、認可・domain validation後にentityとoperationを同一local transactionで保存する。IDはofflineで安定生成し、時刻を順序へ使わない。commit後のoperationを受信しただけで外部actionを再実行しない。

push envelopeにはprotocol version、workspace、client/device、operationId、entity type/ID、kind、payload、baseVersion/causal predecessorを持たせる案。serverはtoken主体とworkspace所属を検査し、client申告actorを信用しない。operation/resultはimmutable、同じIDで違う内容の再送を成功としない。

| 状態 | 保存/復旧の契約 |
| --- | --- |
| optimistic / saving | 画面は変更可、まだ保存保証なし。失敗を明示 |
| durable pending | entity/intentが端末commit済み。offline終了で保持 |
| prepared | 送信wireを耐久化。ACK喪失後も同じID/内容を再送 |
| acknowledged | result/receiptを耐久化し、pending解消を同じtransactionで確定 |
| rejected | 永続的拒否と元intentを保持。勝手に破棄・無限再送しない |
| conflict | base/local/remoteを保持。端末保存と解決済みは別 |

serverはaccepted/rejected/conflict結果をoperationの冪等キーで再取得可能にする。transport timeoutはcommit有無が不明なので新しいoperationIdで作り直さない。HTTP成功だけを端末ACK保存成功としない。

## pullとpending投影

cursorはworkspace/stream/epochに所属するopaque token。適用するentity/history/receipt/Conflictとcursorを同一transactionへ入れ、commit後にのみ進める。clientがheadCursorへ飛ばして未読operationを省略しない。

受信したserver基底へ未送信intentを投影し、同field競合は3値で保持、異fieldはmerge、削除はtombstone優先。Conflict解決は新operation。account/workspace切替や過去responseの遅着で他storeのcursorを更新しない。

起動/reconnectはrestore→session/認可→pull（全page）→pending push→再pull。WebSocketは再pullの契機で、通知欠落しても正確性を保つ。session失効・権限拒否は通信失敗と分け、認証の再確認まで送信を止める。offline読取の失効扱いは認可仕様へ残す。

## wire変更・migration

現PoCにはworkspace/protocol version/authがなく単一structured cursorを使う。本番案を現schemaへ足すだけでは旧operation/旧server resultの所属が確定しない。取り込みは明示的なmigration/import契約で行い、旧cursorを流用しない。unknown version/epoch、期限切れcursor、履歴compaction後のbootstrapはserver snapshotとpending再投影を含む別契約として確定する。

retry backoff/同時送信数/batch上限、cursor保持期間、offline端末の再bootstrap期限は運用契約で決める。PoC timeoutをそのまま製品SLOにしない。

## 受入

同ID/同wire duplicate、同ID/違うwire拒否、server commit後ACK loss、local ACK保存中kill、pull適用/cursor間kill、複数page、pending上へのremote、same-field Conflict解決、account切替中response、他workspace read/write/CRDT拒否を検査する。実DB transactionと実OS保存復旧の証拠を分ける。外部action成功の保証はこのsync ACKに含めない。
