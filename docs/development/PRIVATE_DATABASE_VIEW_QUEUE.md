# View作成・更新・競合解決の端末queue

2026-10-09 / v0.65.0。[View cache](PRIVATE_DATABASE_VIEW_CACHE.md)へ端末の未送信操作を接続する。native15→16、server11保持。[判断](../decisions/private-database-view-queue.md)、[証拠](../../tests/evidence/private-database-view-queue-20261009/SUMMARY.md)。View実HTTP/session/runtimeと6型Table/List操作画面は後続。

## 捕捉と処理待ち

対象はname/layout/visiblePropertyIds/filter/sortsの5field。配列順・フィルター構造と型を保持する。createはSourceの確認済み定義または独立pending定義を捕捉し、base/candidateはnullとする。架空Viewやversionを作らない。未確認Sourceはprepareでsource blockedとなりwireを固定しない。ViewはPage本文に依存しない。

updateは確認済みSource、実際に観測したbaseVersionのView historyとtyped patchを捕捉する。resolutionは既知で未解決の候補、現在の確認version、元base/local/remoteとfield/remoteVersion/choiceを照合する。remote値が別field更新後も現在fieldと一致する場合は新しい現在versionで明示解決できる。捕捉後の観測は元intentやchoiceを上書きしない。

同Viewの未ACK操作はcreate/update共通で1件。別operationのenqueueは既存operationId付きbusyを無書込みで返す。same operationのexact retryは元Source/intent/captureを検査する。新しい未保存draft、offline successor、自分のACKを前提にしたbaseの自動変更は追加していない。confirmed Viewの再createとoperation ID再利用を拒否する。

## 元wireと原ACK

canonical ID、Source/schema/typed設定・参照・フィルター制限とUTF8 wire 8MiBをenqueue前に検査する。name等の既存Domain/Native上限はUnicode文字数の契約を保持する。context/Source/intent/base/candidate/indexのSHA256と元wire文字列SHA256は局所破損検知でありAuth grantではない。

prepareはworkspace最古の未ACK1件を同transactionで固定する。再prepareはJSONのformat/key順を再生成しない。ACKはscope/operation/Source/schema/View、原intent/実baseline/typed snapshot/result/三値候補を照合する。conflictのremoteは原replyの対象fieldに一致し、base/localは元captureと一致する。whole-field比較は配列順を保持しobject key順を意味としない。

原applied/conflict/rejected envelope、queue response、専用write receipt、history/currentを同SQLite transactionで確定する。applied resolutionだけがresolvedByと解決proofを同transactionで確定する。remote選択で値とversionが変わらない場合も新operationとして解決を記録する。rejectedは確認済みの原結果であり編集の適用成功ではない。候補を消費しない。

write receipt検査は元queueのindex/checksum/wire/ACKを純粋に照合し、history/candidate検査へ再帰しない。cache用にはsnapshot/conflictsを抽出し、架空read receiptを作らない。read/deltaはqueueを消さず、遅着ACKは新しいcurrentを戻さない。deltaによる同解決の先行観測では最初のhistory/解決proofとcursorを保持し、異なる解決operationへ上書きしない。exact replayは欠損history/projection/candidate/receiptを補修しない。

## 一覧・移行・境界

queueは正確なi64文字列sequenceのkeyset、pending-only、max100件、検査済みlookaheadを使う。SQLは1行ずつ読み、32MiBを目安にwindowを分割する。単一行上限256MiBは、大きな観測済みfilter・元三値候補・原ACKを同captureが含むためRecordの128MiBより広い。単一の有効な大きい行を返した場合もnextAfter/global pendingを維持し、byte切れ目の破損lookaheadを拒否する。実際の約26MiBのbase/ACK行2件を試験する。

bound context照合後、native0/5〜15から16へ移行する。Source/Record queue、read replica、delta cursor、Page本文/title/未送信、Task/Relationを保持する。foreign binding/partial DDL/unknown schemaはrollbackする。strict Registryとcaptured NativeWorkspaceStoreはcontext/sequence/typed結果を検査し、Auth refresh/close後の旧accessを拒否する。

Docker実Rust/SQLite、SIGKILL6条件と既存回帰/build/helpで検証する。初回型checkのimport不足、初回集中試験のfixture ACK項目/versionと破損注入時FKを修正し、元Failを別に保存する。View実HTTPと操作画面、actual Supabase正常login、Windows actual invoke/MS IME、Android/native credentials・offline grant、配備暗号化/native Gateは別条件。
