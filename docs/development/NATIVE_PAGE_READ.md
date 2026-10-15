# Native Page取得・端末保存基盤

後続v0.93.0で[選択Pageの取得画面とeditor merge](NATIVE_PAGE_READ_SCREEN.md)へ接続した。以下はv0.92.0の基盤記録。

v0.92.0。[native送信](NATIVE_PAGE_SEND_SCREEN.md)と同じverified admissionを使うHTTP read、SQLite receive、専用IPC/client portを追加した。画面の取得ボタン・表示中editorへのmerge・remote一覧/catalogは次工程。

## 信頼境界

`native_page_read(handle,pageId)`はcallerからtoken、context、state vector、受信responseを受け取らない。固定APIのPage readへnativeのclientId/schemaと空vector `AA` を送る。今回はRustでjournalのYjs vectorを生成せず、full stateを取得する。差分効率・大文書は後続の性能対象。

開始前と完了後に元session instance/generation/issuer/owner・期限・永続世代を照合し、保存直前も元handle/generationを確認する。close/logout/再認証/別account/期限切れの旧responseを新しい保存先へ取り込まない。read待機中にlocal保存を禁止しない。

HTTPは既存のTLS検証・redirect/retry/proxy拒否・15秒/接続5秒を共有し、responseは診断上限8MiB。scope、Page/document名、schema、metadata、head order、canonical binary/vector、digestを保存前に確認する。SQLite receiveも同じvalidatorを使用する。RustはYjsの意味・vectorとupdateの一致を解析しない。実API側のYjs検証と、取得後にeditorを開く際のclient検査を分ける。

## 保存確認と復旧

返却はstrictな`{status}`だけ。receivedはSQLite commit確認済み、read_unknownは通信/response未確認、store_pendingは検証済みresponseの保存確認待ち。raw本文やAuth情報をこのIPCの戻り値へ混ぜない。保存済み本文は既存のgated local loadから読む。

検証済みresponseは元handle内のmemoryへ最大8Page分保持し、次の明示readでは同じresponseの保存だけを再確認する。commit済みか不明な場合もidempotent receiveを再適用し、その確認中のHTTPは0回。確認後またはhandle閉鎖/認証変更時に破棄する。app kill後の耐久cacheではなく、終了後は改めて認可付きreadを行う。

既存SQLiteの受入契約を保持する。新Pageは原子的に採用し、既存Pageのlocal pending/wireを消さない。反復取得で同じbinaryを二重保存せず、遅いheadでmetadataを戻さない。未送信/managed titleをremote metadataで無言に上書きしない。取得は送信やACKの代わりにならない。

[証拠](../../tests/evidence/native-page-read-20261015/SUMMARY.md)。実SQLite・合成providerと、実TLS/署名API/PGの別native session相互運用を検証した。実Windows WebViewのread invoke、実IME/remote composition、offline lease・一覧・再接続画面の受入は未完了。
