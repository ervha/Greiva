# View設定の変更と競合計画

2026-10-09 / v0.46.0。[Record一覧](PRIVATE_DATABASE_RECORD_CATALOG.md)に続き、回答済みのTable/List用View設定をportable Domainへ追加する。[判断16件](../decisions/basic-database-view-mutation.md)、[証拠](../../tests/evidence/basic-database-view-mutation-20261009/SUMMARY.md)。この区切りは純粋なintent/merge契約で、ViewのDB保存や画面操作は次工程。

## 設定と基底

createはSource/schemaVersion/View IDと全設定、updateは正確なbaseVersionと非empty patchを捕捉する。対象はname/layout/visiblePropertyIds/filter/sortsの5 field。Source定義で参照、型、Name列の表示、重複列、filter/sortを検証する。未知field、explicit undefined、空patch、別Source/schemaは拒否する。IDとSource bindingはpatchで変えられない。

parse結果はclone/deep freezeし、呼出元のarray変更を共有しない。operation IDやserver versionをこの層で採番しない。各fieldの検証用View scaffoldは一時的な型検証だけで、保存するViewや権威ある基底へ使わない。

## 三値merge

writerから渡されるbase/current snapshotとintentのID/Source/版を照合する。同一versionの異なるsnapshotや逆行版は拒否する。別fieldの変更は保持し、localがbaseまたはremoteと一致すればno-op。同fieldを双方が異なる値へ変えた場合はbase/local/remoteをそのまま返し、proposed Viewではremoteを保持する。同じpatchの非競合fieldは反映できる。

filter AST、visiblePropertyIds、sortsはそれぞれwhole fieldとして扱う。配列順には意味があり、列順やsort優先順の競合を要素単位で自動統合しない。object key順は比較結果に影響させず、portableなcodepoint順で構造比較する。端末時刻によるLWWは使わない。

## 解決を新intentへ

候補はworkspace/Source/schema/View/field、baseVersion/remoteVersion、三値、resolvedByを持つ。field型/参照と三値の相違を照合する。prepareは未解決候補と現在fieldが観測remoteに一致することを確認し、localまたはremote選択の新update intentを現在baseで作る。元候補とsnapshotを変更しない。

別fieldの更新後でも対象remoteが同じならfresh intentを作れるが、更新前に準備済みの古いintentは拒否する。writer計画時にも候補ID/field/観測remoteVersion/選択値/single-field patch/current baseを再照合する。remote選択は内容no-opになり得るため、内容mergeと候補のdurable resolved_by記録は別責務。後続writerが新operation/history/receiptを原子保存して初めて解決が確定する。

## 検証境界

Domain専用11条件、通常回帰、実Postgres既存回帰、型/native/frontend/Windows buildとmanifest46のhelp12を確認する。server schema8/native schema8、Auth/API、DB値や本文はこの区切りで変更しない。UIコードも変更せず、[v0.44.0の全画面結果](../../tests/evidence/private-database-record-20261008/SUMMARY.md)は旧版の証拠として保持する。

次はactual View writer/read、authoritative history/immutable receipt/候補、明示schema9へ接続する。Record変更受信、native DB保存/queue/runtime、Table/List画面、実Auth/host invoke/MS IME/Androidと配備暗号化は後続。pure plan成功を保存・同期済みへ扱わない。
