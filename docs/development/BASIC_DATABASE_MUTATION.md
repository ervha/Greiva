# 基本DBの変更と三値比較

2026-10-08 / v0.42.0。[型/ビュー基盤](BASIC_DATABASE_FOUNDATION.md)へportable Record create/update intentとfield merge/解決案を追加する。[判断16件](../decisions/basic-database-mutation.md)、[証拠](../../tests/evidence/basic-database-mutation-20261008/SUMMARY.md)。wire、server/native adapter、操作画面や保存成功の追加ではない。

## 捕捉する変更

intentはSource ID/schemaVersion、Record/Page ID、kind、基底version、型付きvaluesを持つ。createはbaseVersion null、updateは正の既知versionと少なくとも一つの変更を要求する。Source/schema/property/値を事前検証し、入力をclone/deep freezeする。Nameは既存Page title経路を使うためRecord valuesには入れない。採番、clock、operation ID、通信、canonical Record versionをこの処理で生成しない。

schemaVersionの不一致、Name複製、空update、未知property、coerce値を拒否する。Pageの実在/権限、Source/Recordのauthoritativeな履歴、原子的なbinding、時点一致の検査は次のadapterが責任を持つ。Domain型/scopeチェックを認可やdurable commitの証明と扱わない。

## field mergeと候補

`planDatabaseRecordUpdate`はSource、編集基底、現在Record、intentを照合する。ID/workspace/Source/Page、baseVersion、基底≤現在versionを検査し、同versionで内容が異なるsnapshotも拒否する。入力を変えず、現在version、proposed values、変更property ID、三値候補をdeep freezeして返す。

別fieldのremote変更を保持する。localがbaseと同じならremoteを残し、localとremoteが同じなら新しい変更を提案しない。remoteがbaseと同じならlocalを提案する。三値が全て違うfieldはbase/local/remoteを残す。候補の各値は`present`と型付きvalueを持ち、未設定keyを保存済みnullとして創作しない。query上はnull/欠落を未設定として比較し、false/0/blankをcoerceしない。

競合fieldのproposed valueはremoteを保持し、非競合fieldの変更も別に提示する。返る`unchanged/merged/conflict`は保存・送信結果ではない。actual adapterがtransaction内で履歴・候補・operation・投影の適用方針を確定して記録するまで、計画を保存成功へ昇格しない。pending local intentをcandidateとともに保つ必要がある。

## 解決は新しい変更として準備する

候補snapshotはstable conflict ID、workspace/Source/schema/Record/Page/property、base/remote versions、三値、resolvedByを検証する。Name、型違い、三値になっていない候補、不正なpresenceを拒否する。

`prepareDatabaseResolution`は未解決・同対象・remote cellが一致する候補からlocal/remoteを選び、新しいupdate intentを返す。候補や元入力を消さず、resolvedByを更新しない。候補fieldの値/対象/schemaが変わった場合や解決済みは拒否する。無関係なfieldの更新でRecord版が進んでも、候補fieldが同じなら現在snapshotから選び直せる。解決は一つのpropertyだけを現在基底で変更し、conflict ID/choice/候補のobserved remoteVersionを添える。

merge側でもactive candidate snapshotとID/property/choice値を照合し、解決intentのbaseVersionが現在Record版であることを要求する。準備後の追越し、snapshotなしや改変値を受けない。古いprepared intentを黙って新基底へ書き換えない。remoteを選ぶ場合は値が変わらなくても解決intentを残す。新operation IDの発行・immutable保存/再送、active候補のauthoritative照合、競合解決記録は後続のwriterで行う。

## 継続する境界

新17条件と既存DB15条件で計画を検証する。旧Task/Page/metadata同期とhelp/rootを回帰するが、DB保存・同期・Conflict UIの成功とはしない。Source CRUD/View保存、新wire/ledger、認可/履歴transaction、native保存と同ID再確認、Table/List画面、全DB/HELP/native Gateは次工程。server5/native8と既存wireを保持する。
