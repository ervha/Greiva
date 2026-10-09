# 読み込み済みDB query checkpoint

2026-10-09 / v0.67.0 / native16 / server11。[契約](../../../docs/development/BASIC_DATABASE_LOADED_QUERY.md)、[進捗と停止・再開計画](../../../docs/plan/CHECKPOINT_20261009.md)。

## 実装

`queryLoadedDatabaseView`は、認可済みの読み込み済み行だけを評価する。未取得Nameはnull、取得済み空タイトルは空文字として区別する。AND/ORで他の条件から結果を確定できる場合は評価し、それ以外のfilterとName sortの未確定行は理由付きunresolvedへ返す。条件で除外が確定した行はunresolvedへ混ぜない。最大1000件、Source/Record/View所属・6型・重複Record/Page bindingを検査し、結果をclone/deep freezeする。既存queryの既知タイトル必須契約とnull末尾/option順/同順位規則を保持する。

## 今回の検証

| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| DB domain query（新7条件を含む） | 22 Pass / 0 Fail | [report](focused.json.gz)、[log](focused.log) |
| 全通常回帰 | 750 Pass / 0 Fail / 217 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 型 | Pass | [log](typecheck-final.log) |
| Docker native / crash examples | Pass | [native](native-build.log)、[crash](crash-build.log) |
| production native features | Pass | [log](native-features.log) |
| test hooksなしfrontend | Pass | [log](frontend-build.log) |
| Windows debug custom-protocol cross-build | Pass | [build](windows-build.log)、[記録](windows-build.json)、[host PE照合](host-exe-inspection.json) |

新7条件は、未取得/空タイトル、全Name operatorの未知、nested AND/ORの確定/未判定、複数列Name sortとfilter除外、typed値・option順・null末尾、scope/重複/1000件/タイトル型、既存query一致・clone/freezeを検証する。最終通常750は以前743＋新7。今回の試験にFailはない。単独22条件は新しいquery/testをDockerへコピーした初回の検証で、package manifestは旧0.66.0のまま。アプリ所有の版を0.67.0へ揃えた後、同22条件を最終通常750に含めて再確認した。初回packages logの旧番号を新しい実行物の版へ読み替えない。

アプリ所有のversionだけを67へ揃え、外部npm315/Cargo501・118を変更していない：[版監査](version-audit.json)。実際のDocker/host source355件を[source inventory](source-inventory.json)で比較し、raw345一致・CRLF/LFのみ10・診断等の除外5件を確認した。CRLF/LFのみの差と診断等の除外を記録し、BOM/binaryをtext normalizeしない。[機械可読結果](verification.json)。

## 実施していない確認・停止

純粋なDomain queryの追加でserver/native schema・HTTP・UI操作を変えていないため、今回は専用実PG・画面E2Eを再実施していない。前回v0.66.0の実PG217/help12の証拠は[当時の結果](../private-database-view-write-20261009/SUMMARY.md)として保持し、今回の新試験結果と合算しない。Windows executableはDockerで作成し、hostで版/hashを照合しただけで起動していない。compiler-family/PDB警告はbuild logへ残るがexit0。

Table/List操作画面、実Supabase正常login/refresh、最新private経路のWindows invoke/MS IME・Android native、native credential/offline認可、配備暗号化・復旧・配布と最終Gateは未完了。利用者の停止指示に従い、この検証済みcheckpointでコミット・annotated tag・pushを済ませて一旦停止する。次の画面実装・新しい試験cycleは始めない。
