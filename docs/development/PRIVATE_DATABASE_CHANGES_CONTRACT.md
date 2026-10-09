# DB変更パケットとcursor契約

2026-10-09 / v0.49.0。[View一覧](PRIVATE_DATABASE_VIEW_CATALOG.md)の次に、Record/Viewの増分受信に使うportable契約とserver側cursor codecを実装する。[判断16件](../decisions/private-database-changes-contract.md)、[証拠](../../tests/evidence/private-database-changes-contract-20261009/SUMMARY.md)。実journal保存/HTTP取得・端末適用は次工程。server10/native8を変更しない。

## パケットと型検証

protocol1のrequestはclientId、任意cursor、limit default50/max100。responseはworkspace/epoch/device/Source/schemaVersion/journalEpoch、after/read/headのexact decimal位置、最大100events、hasMore、必須の次cursorを持つ。eventはrecordまたはviewのdiscriminated unionで、positive order、版付きsnapshot、任意のtyped三値候補を含む。候補のresolvedByに新operation IDを載せて、内容no-opの解決も表現できる。

wireでcanonical nested ID、scope/ID/Page binding、観測版、三値、位置の昇順/範囲と応答上限を検査する。Source-bound parserは6型の値/refs、NameのPage参照、Viewのfilter/sorts/列を追加照合する。Recordに二つ目のName/title/bodyを保存しない。objectをclone/deep freezeし、呼出元変更と共有しない。parse成功はAuth確認、authoritative history検査、server/端末保存の証拠ではない。

filtered raw進捗ではeventの位置にgapがあり得るが、responseのreadOrderは単調に進み、hasMoreのままafterと同じ位置には戻れない。全件取得時はread=head。空のfiltered応答でもcursorを保持できる。削除ACKやcache purge、Record/View/Page全体の同期済み表示へ扱わない。writerが生成するraw journalの連続性は後続server実装の検査責務。

## gdb1 codec

HMACをworkspace/workspaceEpoch/client/Source/journalEpoch/afterOrderへ束縛する。永続secretのcopyを使い、canonical base64url、固定長signature、exact BigInt、未来位置を検査する。gds1/gdr1/gdv1との混用を拒否する。journalEpochは将来のdurable stream世代で、この層が時刻やUUIDを仮生成して保存したとはしない。cursor:nullは初回0。codecは完了時にも0を含むcursorを表現でき、codec生成を端末へのcommitと区別する。

## 後続保存と取得

次は明示server schema11のSource別journal/head/永続世代、旧current/候補のseed、writer/候補解決/ledgerと同transactionのevent追記を接続する。取得はowner/device/Sourceを照合し、raw連続性/lookaheadとResource状態を検査してbounded windowを返す。Source、Page Resource、journal headのlock順は既存Record writerと整合させ、期限/失効をCOMMIT前に再確認する。

その後のnative replica/queue/cursor原子保存、captured Auth/runtime、Table/List画面は別の実装checkpoint。今回の8条件と通常/既存PG/型/build/help12は契約と回帰の証拠で、実Auth/host invoke/MS IME/Android、配備暗号化と全DB/native Gateを満たしたとはしない。
