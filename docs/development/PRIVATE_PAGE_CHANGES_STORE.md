# Pageタイトル増分の端末保存

2026-10-08 / v0.37.0。[増分server](PRIVATE_PAGE_CHANGES_SERVER.md)のreplyをcaptured native storeへ原子的に保存する。network/session/runtime/画面への接続は次工程。[全16判断](../decisions/private-page-changes-store.md)、[証拠](../../tests/evidence/private-page-changes-store-20261008/SUMMARY.md)。server5、本文/structured wire、通常root入口を維持し、private native schema7→8をbound transactionで移行する。

## 原子受信と再開

strict commandは `changes_receive {request,response}` と `changes_load {afterPage,limit}`。registryの世代handle/固定保存先とimmutable issuer/subject/workspace/device/epoch bindingを使う。NativeWorkspaceStoreが入力/schema/context/件数と世代を確認し、返信をfreezeする。unknown command/extra field/foreign scopeや既存handleの失効を拒否する。任意path、別画面のcurrent store、token/メール保存を追加しない。

replyのworkspace/epoch/client、request cursor/afterOrder、response read/head/続頁、event順序/Page/metadata/版/候補を検査する。cursorは専用namespace・canonical base64url・32byte署名envelope・scope/orderをnativeでも検査する。nativeにはserver鍵を渡さず、HMAC検証やnative Auth grantを実装したとはしない。信頼する認証付きAPI transportの接続は次工程で検証する。

受信event、metadata catalog、候補/解決、既存title投影、cursor/read/head/hasMoreとcanonical request/replyのSHA256 receiptを同じSQLite transactionへ保存する。readOrderは現在のsaved order/cursorに一致する基底からのみ進める。filtered空頁はpayloadなしで進め、localデータを削除しない。同じsaved receiptの正確な再適用はidempotentで、古い位置へ巻き戻さない。別内容の古い基底は拒否する。保存が失敗すれば全windowをrollbackし、新cursorを返さない。COMMIT結果不明は同じrequest/replyで再確認できる。

orderはPostgreSQL/SQLite bigintの非負十進文字列。native内部ではi64を使い、JS safe integerへ丸めない。local snapshotはorder/cursor/headOrder/received/hasMoreを返す。receivedはcommitしたquery replyがあることだけで、synced/全端末の最新状態を表さない。loadはqueueを消費せず、catalogをUUID keysetで最大100件＋lookahead一件に制限する。lookaheadまでmetadata・版・lastOrderとimmutable source eventを照合し、破損した部分結果を返さない。

## Metadataと本文・入力の分離

本文未取得Pageは独立metadata catalogと候補へ保存し、pages/本文Docを暗黙作成しない。hasPage/listPagesの「本文を保存済み」へ混ぜない。後で既存本文経路がそのPageを取得したtransaction内でcacheを採用し、版付きtitle基底/候補を接続する。local作成のbootstrap ACKが未確定ならcacheだけ保存し、title基底はunknownのままにする。ACKの確定とcache採用を同じtransactionに含め、作成確認前に編集可能と見せない。採用は候補100件のkeyset batchで行い、壊れたcacheでは本文受信/ACKもrollbackする。

本文取得済みPageは既存title helperで新基底と候補を反映する。新基底が古い場合は現在の基底を退行させず、未送信intentのlocal投影と既に保存したwireを保つ。metadataのcreatedAt/title版の意味を照合し、同版でtitleが変わる場合は拒否する。versionless本文metadataや古いbinary readでtitleを戻さない。

別端末のresolvedByはlocal operationに存在しないことがあるため、schema8でtitle_conflictsのresolved_byだけのlocal-operation FKを外す。canonical UUIDとimmutable record/既知解決の一致を確認する。受信nullで既知解決を消さず、異なる解決IDへの変更を拒否する。未送信のlocal解決intentは残す。既存の「解決をenqueueする前にtitle queueを確定する」制約は保持する。外部解決が先行してserverが拒否した後も元intent/rejectionを履歴へ残す。

## Migration・証拠境界

bound contextを検査してからprivate schema0/5/6/7→8を同transactionで移行する。既存本文/structured/title基底・queue/receipt/候補を保持し、進捗は未受信order0/cursor nullから始める。異主体の同じDB、partial DDL、missing tableは拒否し、DDLごとrollbackする。通常PoC schema4へ混ぜず、通常storeはbound8を開けない。旧schema試験では追加tableも除いて当時のlayoutを再現する。

Dockerのactual Rust registry/SQLiteでmetadata-only/再開/filtered空頁/正確replay、本文後のcache採用、未送信title/wireとremote解決、pending resolution後のrejection、semantic errorのwindow全rollback、101 catalog/破損lookahead、migration、COMMIT前後SIGKILLを検証する。typed IPCはcaptured Auth世代を使うが、Tauri host invoke/実Auth/native credential/offline grant/実IME/Android/配備暗号化は未検証。次はcaptured transport/portable session/runtimeを接続し、受信後の観測状態とworkspace表示を検証する。
