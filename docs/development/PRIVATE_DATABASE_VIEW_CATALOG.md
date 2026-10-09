# Viewヘッダーの一覧取得

2026-10-09 / v0.48.0。[View保存](PRIVATE_DATABASE_VIEW.md)に続く小さい認証付きcatalog。[判断16件](../decisions/private-database-view-catalog.md)、[証拠](../../tests/evidence/private-database-view-catalog-20261009/SUMMARY.md)。回答済みTable/Listの選択基盤で、端末同期や画面の完成ではない。

`POST /v1/workspaces/:workspaceId/databases/:sourceId/views/catalog`はprotocol1/clientId、任意cursor、limit default50/max100を受ける。署名session/owner/workspace/active device/Sourceを確認し、Source SHARE lockの下で一覧を観測する。各headerはView ID、workspace/Source、現在version/name/layout、creationOrder。filter/sorts/表示列、Record値、Page title/bodyは含めず、必要なView設定は単一readで取得する。

creationOrderはSource単位のexact decimal bigint。初回に観測したheadをgdv1 HMAC cursorへ固定し、取得中の新規Viewは次の新規一覧へ分ける。workspace/epoch/device/Source/purposeを束縛し、canonical base64/署名/範囲を検査する。gds1/gdr1と混用しない。固定するのは生成メンバー範囲で、version/name/layoutは各pageの現在観測。設定の固定snapshot・変更受信・全同期完了ではない。

raw limit+1をnumeric creation_order順で読み、lookaheadもscope/headerを検査する。deleted Viewを表示しなくてもraw位置を進め、empty filtered windowから続行する。headと最大位置の不一致、欠落head、header破損を空の成功へ変えず、catalog自身はheadを作成・修復しない。一覧結果を削除ACKや端末cache削除の許可へ使わない。filter/sortsをこのqueryで読まないため、header成功だけで全設定の健全性を証明しない。

明示`installPrivateDatabaseViewCatalogSchema`だけがserver9→10へ進める。既存Sourceとcurrent View/historyを検証し、creation_orderとSource別headを原子追加する。旧ViewはSource内stable ID順seedで、過去の作成時刻/commit順を復元した結果ではない。元settings/history/request/result/候補/鍵/本文は変更しない。

新規Viewは既存Source UPDATE lock下でheadを検査・増加し、View/history/ledgerと同transactionに位置を保存する。exact再送は増やさず、ledger失敗/COMMIT前killで一緒にrollback、COMMIT後killは同IDで元receiptを返す。schema10以後に作った空Sourceは初回View保存時だけheadを作成できる。Viewを持つSourceの欠落headをcreate時に自動修復しない。update/解決でcreation位置は変えない。

再install/invalid seed/DDL衝突はrollbackし、readinessはread-only。10でのみcatalogをmountし、旧schema/APIとnative8を保持する。actual PG/fixture署名HTTP/COMMIT前後SIGKILL、全通常/PGと型/build/help12を検証する。UIコードは変更せず、[v0.44.0の全UI](../../tests/evidence/private-database-record-20261008/SUMMARY.md)を今回の結果に置き換えない。次はRecord/View変更受信とnative DB replica/queue/runtime、Table/List画面。実Auth/host invoke/MS IME/Android/native grant、配備DB/backup暗号化と全DB/native Gateは別条件。
