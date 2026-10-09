# View設定の保護保存

2026-10-09 / v0.47.0。[View intent/merge](BASIC_DATABASE_VIEW_MUTATION.md)をactual Postgresへ接続する。[判断16件](../decisions/private-database-view.md)、[証拠](../../tests/evidence/private-database-view-20261009/SUMMARY.md)。回答済みTable/Listの設定保存で、端末DB同期や操作画面の完成ではない。

## APIと正本

`POST /v1/workspaces/:workspaceId/databases/:sourceId/views/write`はprotocol1/clientId/operationId/typed intent、`.../views/:viewId/read`はprotocol1/clientId/afterConflict/limitを受ける。署名session、owner/workspace/active device、Source所属と非deletedを既存transactionで確認する。ViewはSourceを参照し、Record/Page/Name本文をコピーしない。未知schema/field、不正refs/型、Name非表示とID reuseは保存前に拒否する。

Source UPDATE lockの下でcreate/updateとoperation ledgerを直列化し、異Sourceの同operation ID競合はunique insertで再検査して敗者全体をrollbackする。readはSource SHARE lockで同じ境界を観測する。待機後の期限と失効もCOMMIT前に再検査する。

current snapshotとauthoritative version historyを照合する。updateは保存済みの正確なbaseから[portable plan](BASIC_DATABASE_VIEW_MUTATION.md)を使う。未変更/converged fieldはno-op、別fieldはmerge、同fieldはwhole-field三値候補を保存する。同じpatchに非競合fieldがあればそれだけ反映し、候補のremoteVersionは競合時の観測版として保持する。

## 再送と解決

current/history、新候補、resolved_by、immutable request/result ledgerは同transaction。exact同ID再送は元receiptを返し、後の更新・解決で元resultを書き換えない。request/client/Viewの異なるID再利用は409。再送時はreceipt snapshotをその歴史版へ、候補をその元操作へ照合する。rollbackやCOMMIT前killでpartial View/history/候補は残らず、COMMIT後killでは同IDで元resultを確認する。

unknown base、候補ID/選択値/観測版の不一致、stale現在基底/対象remoteは内容を変えずrejected receiptへ記録する。候補を消費しない。fresh解決は現在基底と旧観測remoteVersionを照合した新operationで記録する。remote選択は内容no-opのままresolved_byとreceiptを保存できる。内容のversion増加だけを解決成功条件にしない。

候補読取はdefault/max20、UUID順limit+1でlookaheadも検査する。候補scope/型/三値に加え、元operation request/resultとbase/remoteのhistorical fieldを照合する。activeの対象remoteが後で変わっても候補自体は取得でき、準備/保存時にはstaleとして拒否する。破損を空の成功候補へ変換しない。nextAfterは候補ページの進捗で、View一覧や変更受信cursorではない。

## 明示schema9

`installPrivateDatabaseViewSchema`だけがserver8→9を行う。新しいView current/history/operations/conflictsテーブルを追加し、default Viewを推測して作らない。既存Source/Record/Page/Task、catalog head/鍵/receiptは書き換えない。DDL衝突、再install、前version不一致はrollbackし、startup/readinessはread-onlyで必要columnを確認する。

server1–8の旧runtimeを維持し、9でだけView controllerをmountする。schema9でも旧Source/Record/header/Page/Task APIを利用できる。native schema8は別の番号で未変更。View列挙、Record変更journal、native DB replica/queue/runtime、Table/Listの設定操作画面へ続く。

## 証拠境界

actual PG、fixture JWKS/ES256のprotected HTTP、COMMIT前後の実worker SIGKILL、全通常/PG・型/native/frontend/Windows buildとhelp版表示を検証する。元の型チェック失敗は修正後の結果と分けて保持する。host executableはPE/SHA確認のみで未起動。実Auth/host invoke/MS IME/Android/native grant、配備DB/backup暗号化と全DB/native Gateをこの結果へ昇格しない。ログへView内容/title/body/tokenを出さない。
