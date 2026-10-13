# Native Page送信基盤

v0.90.0。native認証を使うPage bootstrap/append transportと、実SQLiteの元queueへACKを保存するgateを追加した。画面/IPCの同期ボタンへの接続とremote読取は次工程。

## 契約

`NativeWorkspaceGate::send_page(handle,page)`は1回の明示呼出しで最古の未送信frameだけを処理する。callerからwire、receipt、token、contextを受け取らない。native SQLiteが元wire/sequenceをprepareし、元admissionのinstance・generation・ownerを確認して固定APIへ送る。HTTP中はlocal入力を妨げず、並行sendは直列化する。

response到着後もhandle/generationと認証期限・永続世代を確認し、元sequence/wireとreceiptをSQLiteのACK transactionへ渡す。既存検査でworkspace/Page/document名、schema、digest、order、metadata、FIFOを検証する。remote待機中のclose/別handle/認証変更/失効では旧responseをACKにしない。既に送ったHTTPのserver側副作用を取消できるとは主張しない。

`true`はACK保存確認、`false`はpendingなし。errorは送信/ACK結果未確認で、server拒否の証明ではない。元pending/wireを残し、自動再送しない。明示再送は同wireを送り、serverの既存digest/creation-request冪等性を使う。既知remote receiptのmemory保持によるnetworkなしACK再試行は未接続。

固定native providerは15秒/接続5秒、redirect/retry/proxy/cookieなしの設定を共有する。Page wireは最大2MiB（512KiB frameとJSON escapeされたtitleを含む）、receiptは最大8MiBの診断上限。auth応答の64KiB上限は保持。超過/不正/transport failureでpendingを削除しない。

## 検証

[証拠](../../tests/evidence/native-page-send-20261013/SUMMARY.md)。通常Rust34件、専用TLS/API/PG3件を実行した。合成の実Yjs frameを送信し、別scope receiptと応答喪失で元wireを保持、4 request/2 server frame、独立Y.Docで本文/vector一致、SQLite再openでpendingなしを確認した。fixtureはPage schema3まで正式migrationを実施する。

Windows候補buildは実機の同期/IME受入ではない。既存v0.82.0の実登録・本文保存/短いIME証拠と、新native経路の検証を分ける。
