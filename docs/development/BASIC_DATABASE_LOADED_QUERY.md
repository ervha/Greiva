# 読み込み済みDB行と未取得Nameの検索

2026-10-09 / v0.67.0。基本DBのTable/List画面へ接続する前のDomain処理。[初期範囲](../plan/DATABASE_SPEC.md)、[証拠](../../tests/evidence/basic-database-loaded-query-20261009/SUMMARY.md)。

`queryLoadedDatabaseView`は、呼出側が認可済みとして渡した最大1000行だけを検索・整列する。通信・保存・認可・全件取得を行わず、結果のscopeは常に`loaded-window`。従来の`queryDatabaseView`は既知のPageタイトルを必須とする契約を保持する。

- NameはPageタイトルから参照する。`pageTitle: null`はタイトル未取得、`''`は取得済みの空タイトル。RecordのvaluesへNameを複製しない。
- Nameを必要としない条件・並び順では、タイトル未取得の行も通常の結果へ含める。画面では取得済みの空タイトルと区別して表示する必要がある。
- 未取得Nameのpredicateは判定不能。AND内にfalse、OR内にtrueがあれば、その枝によって結果を確定できる。それ以外の不明な判定は推測しない。
- filterを確定できない行は`unresolved`の`reason: filter`へ返す。filterで除外が確定した行は、Nameの並び順が未取得でも未判定一覧へ含めない。
- filterを満たしても、Nameを含むsortのタイトルが未取得なら`reason: sort`へ返す。複数列sortでも同じ扱いとし、全行の正しい位置を仮定しない。
- 確定行の値・option順・null末尾・record ID同順位規則は既存queryと同じ。未判定一覧もrecord ID順とする。結果は入力からcloneしてdeep freezeする。
- Source/Record/Viewの所属、型、property参照、重複Record/Page binding、件数上限を評価前に検査する。未知のタイトルを空文字にするfallbackは設けない。

今回の追加はquery処理であり、Table/List操作画面、未判定行の表示、Name取得や再評価の接続は次の工程。native schema16/server schema11は変更しない。
