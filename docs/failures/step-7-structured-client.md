# Step 7端末同期の修正記録

2026-10-01。最初の失敗を残し、修正後の成功と区別する。[検証証拠](../../tests/evidence/step-7-structured-client-20261001/SUMMARY.md)。

## 拒否された後続の表示が残る

実HTTP＋PostgreSQL＋Rust/SQLiteのcreate ID衝突試験で、元操作と後続をrejectedにしても後続のlocal値が通常のTask表示へ残った。prepared処理で依存先rejectionを判定した際、queue状態だけ変更し、表示用projectionを再生成していなかった。

後続をrejectedにする処理と、最新サーバーentity＋残ったpendingのprojection生成を同じSQLite transactionにした。元payload/baseはqueueに保持し、エラー欄から確認できる。修正後はサーバーと通常表示が一致し、両方の入力も保持することを実結合試験で確認する。[初回結果](../../tests/evidence/step-7-structured-client-20261001/previous-attempt/client-http.json)。

## 同じ値を選んだ直後のpeer比較

新規E2Eのremote選択で、値は両端末とも同じだがpeerが解決operationをまだpullしておらず、versionとupdatedAtの即時比較が失敗した。同期表示は直近の既知headまでの状態であり、peerが未来の更新を受けた証拠にはならない。

任意の固定待ちや値だけの確認に変えず、両端末の全Task・Conflictが一致するまでbounded pollしてから判定する。元の失敗trace/contextを保持する。[初回E2E](../../tests/evidence/step-7-structured-client-20261001/previous-attempt/structured-e2e/playwright.json)。

## 型検証

新しいtest helperの相対importにNodeNextの`.js`拡張子がなく、型推論の後続エラーが発生した。拡張子を修正。またVitestのpoll optionへPlaywrightの`intervals`を指定していたため、インストール済みVitestの`interval`へ修正した。型検証失敗ログを残し、成功した新しい結果と区別する。

## Page同期表示のテスト対象が曖昧

全回帰の初回runは33件Pass・10件Failだった。既存のPage試験が getByLabel('同期状態') の部分一致を使い、新しいTask/Relation同期表示も同時に選んだため、Playwrightのstrict locator違反になった。ログ上、この失敗を同期内容の破損と判断しない。

Page試験の対象を getByLabel('同期状態', { exact: true }) へ限定した。Task側の表示と独立した検証は保持し、既存試験をskipしない。初回のログ・JSON・traceを[全回帰の初回結果](../../tests/evidence/step-7-structured-client-20261001/previous-attempt/full-run/summary.json)に残す。

## 実HTTP試験の終了待ち

Page locator修正後の全runは実PostgreSQL結合17件Pass・1件timeoutだった。単独の繰り返しでも再現した。診断ログでは、競合解決・両端末/サーバー一致・resolvedByの全assertion完了後、engine停止・Rust端末終了までは進んだが、FastifyのAPI終了で待ち続けた。30秒へ一時的に延ばしても同じで、同期完了の遅さとして扱わない。

fixtureが所有するHTTP serverのconnectionをcloseAllConnectionsで閉じてからapp.closeを待つ終了関数を作り、cleanupと明示的なAPI再作成に使用する。production APIの実装と同期完了のassertionは弱めず、試験は元の15秒制限に戻す。修正前の[全run](../../tests/evidence/step-7-structured-client-20261001/previous-attempt/cleanup-timeout-run/summary.json)と[終了段階の診断](../../tests/evidence/step-7-structured-client-20261001/previous-attempt/cleanup-diagnostic.log)を残し、修正後の繰り返しは別記録にする。

## Pageの初期復元待機（原因未確定）

終了処理修正後の全回帰では42件Pass・1件Failとなり、Mention操作前のPage本文表示が5秒の上限へ達した。traceではJS/module読込みが完了し、Rust橋へのlist要求2本が応答待ちのまま。画面はPageを読み込み中で、Mention入力は開始していない。API接続の終了問題とは別件であり、本文やMentionの破損とは断定しない。

[当該runとtrace](../../tests/evidence/step-7-structured-client-20261001/previous-attempt/startup-wait-run/summary.json)を残す。元の5秒条件でMentionを繰り返し、全件も再検証する。再現しなくても初期復元待機の原因が確定したとは扱わず、Step 8の起動/復元性能とnative検証で補強する。assertionをskipしたりretryで失敗を隠したりしない。

## 再接続assertionと収束の時間枠

次の全回帰は42件Pass・1件Fail。Todo同期試験でresume後の表示を既定5秒で待っていたが、接続はconnecting→disconnectedとなり再接続待ちのままだった。[当該run](../../tests/evidence/step-7-structured-client-20261001/previous-attempt/reconnect-wait-run/summary.json)。この5秒assertionはPoC Section 13のreconnect後30秒以内という収束条件より厳しく、後続のvector/全文比較へ到達していなかった。

pair/resumeの接続待ちを最大15秒、続く厳密な収束比較を最大15秒とし、合わせて30秒以内のままにする。固定sleep・test retry・値だけの比較へ変更しない。通常Editorの表示待ちも操作fixtureの準備として最大15秒へ明示し、releaseの初期起動3秒/Page復元2秒の性能目安をこの操作試験から判定しない。Page初期復元の原因未確定という記録は残す。