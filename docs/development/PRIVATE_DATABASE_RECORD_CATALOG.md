# Recordヘッダーの一覧取得

2026-10-09 / v0.45.0。[Record writer](PRIVATE_DATABASE_RECORD.md)の次に、認証付きのbounded catalogを追加する。[判断16件](../decisions/private-database-record-catalog.md)、[証拠](../../tests/evidence/private-database-record-catalog-20261009/SUMMARY.md)。利用者回答Aの初期6型/Table/Listを進める基盤で、端末同期やTable/List画面の完成ではない。

## 小さいヘッダーと取得範囲

`POST /v1/workspaces/:workspaceId/databases/:sourceId/records/catalog`はprotocol1/clientId、任意cursor、limit（初期50/最大100）を受ける。署名session/owner/workspace/active device/Sourceを既存transactionで照合する。返す各行はRecord ID、workspace/Source/Page参照、現在観測version、creationOrderだけ。values/title/bodyやproperty設定を一括返却しない。値と候補は既存の単一Record read、Nameと本文は既存Page経路で明示取得する。

creationOrderはexact decimal bigint。開始時headを後続pageでも固定し、取得中に新規作成されたRecordは次の新しい一覧で取得する。一覧のメンバー範囲が固定されるだけで、各ヘッダーのversionは各回に読んだ現在値。snapshot全体、Recordの変更通知、本文ACK、workspace全体の同期完了を保証しない。更新は後続のjournal/受信経路で扱う。

raw limit+1をnumeric column順で読み、lookaheadも検査する。deleted Recordや非active/別scopeのPageは表示しないが、raw位置は進める。filtered empty windowでもhasMore/cursorを保持する。filterを端末キャッシュ削除の許可や削除ACKへ使わない。headと最大位置、snapshotのID/scope/Page/version headerを照合し、破損を空の成功一覧へ変換しない。valuesをこのqueryで読まないため、header取得成功だけでRecord値の健全性を証明しない。

## gdr1 cursor

既存durable secretから目的を分けたHMACを使い、workspace/epoch/client/Source/after/observedHeadへ束縛する。canonical base64url、署名とexact bigint範囲を検査し、Source catalogのgds1と混用しない。鍵やcursorを端末時計/推測順序で代用しない。

## 明示schema8

`installPrivateDatabaseRecordCatalogSchema`だけがserver7→8へ進める。既存Source、current Recordとそのhistoryを検証してから、creation_orderとSource単位headsをtransactionで追加する。既存RecordはSource内でstable ID順にseedする。これは過去の作成時刻/commit順を復元した結果ではない。元snapshot/history/operation receipt/候補/鍵/本文は変更しない。

新規RecordはSource UPDATE lockの下でheadを検査・増加し、current/history/ledgerと同じtransactionに位置を保存する。再送では増やさず、ledger失敗やCOMMIT前killで一緒にrollbackする。COMMIT後killは同IDで元receiptを確認し、位置を二重採番しない。schema8以後に作った空Sourceは初回Record保存時だけheadを作成できる。catalogはheadを作成・修復しない。

再install、別version、壊れたseed、DDL衝突は拒否し、自動repairしない。readinessはread-only。以前のschema1–7とAPIを維持し、8でだけcatalogをmountする。既存Record writer/readも8へ対応する。native schema8は別の番号で、今回変更しない。

## 次工程と検証境界

actual PG、署名fixture HTTP、COMMIT前/後SIGKILL、型/全通常/全PGとbuildを検証する。UIコードの変更はなく、今回のE2Eはmanifest版と同梱helpの12条件に絞る。前checkpointのroot64/Auth12/workspace52はv0.44.0の証拠として保持し、v0.45で再実行したとはしない。

Record変更journal/端末受信、View保存、native replica/queue/runtimeとTable/List操作画面へ続く。実Auth login、host invoke/MS IME、Android、配備DB/backup暗号化、全DB/native Gateは別条件。利用者の2026-10-09の再開指示によりv0.44停止地点から継続する。
