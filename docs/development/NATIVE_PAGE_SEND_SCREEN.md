# Native Pageの明示送信と受領記録の再確認

v0.91.0。[native送信基盤](NATIVE_PAGE_SEND.md)を専用Tauri IPC、client port、選択したPageの送信操作へ接続した。

## Native境界

設定ありmodeだけに`native_page_send(handle,pageId)`を登録し、返却はstrictな`{status}`だけとする。statusはidle/acked/send_unknown/ack_pending。WebViewからtoken/context/wire/receiptは受け取らず、返却もしない。旧汎用ACK/SQL pluginを開かない。

native SQLiteから元frameをprepareし、固定HTTPで取得したreceiptのscope/digest/order/metadata/形式を検証する。検証済みreceiptは元handle/generation内のmemoryに最大8Page分保持する。ACK transactionの確認に失敗した場合はack_pendingとし、次の明示操作で元sequence/wire/receiptを先に再適用する。既にACKがcommit済みでも、新frameへreceiptを付け替えない。この再確認中のHTTPは0回。ACK確認後に保持を解き、close/logout/認証変更でmemoryを破棄する。

HTTP結果未確認・不正receiptはsend_unknownで、自動再送しない。memory保持はapp kill後の耐久receiptではない。終了後やhandle再開後は、元pendingの同wire再送とserver冪等性で復帰する。receipt保持上限に達した場合は追加送信を拒否し、元Pageの確認または再接続を必要とする。

## 画面と本文保存

1回の明示操作は開始時のpending数に基づき最大32frameを順に送る。unknown/ack_pendingでbatchを止める。pending0でも1回はnative側の保持receipt/queueを確認できる。保持receiptの再確認後、同じ操作で後続の別frameを送る場合がある。

本文の端末保存、送信結果、端末の受領記録を別々に表示する。remote変更の取得は未接続なので「全端末で同期済み」と表示しない。HTTP中も同じY.Docで入力・直列local保存を継続する。composition中は送信開始を拒否する。送信中のlogoutは許可し、旧結果はport/controllerの世代で破棄する。

送信後はlocal保存queueを待ち、端末のpendingを読み直す。その読み直し中に編集が入った場合や取得に失敗した場合は、件数を確定せず「未送信数は再確認が必要」と表示する。loadした本文を表示中のY.Docへ再適用しない。明示送信以外の自動HTTP retry/refreshは追加しない。

[証拠](../../tests/evidence/native-page-send-screen-20261015/SUMMARY.md)。Dockerのnative/SQLite・署名API試験と、IPC doubleの画面/合成composition試験を分ける。最新候補の実Windows本文invoke/実provider/実IME、remote読取とoffline leaseの受入は残る。
