# ログイン確認画面の全判断

2026-10-05、v0.18.0。手操作を減らし、実Authの確認入口を進める自主判断。

1. 通常PoCを置換せず、独立auth.html entryにする。workspace登録確認を同期済みと表示せず、通常editor/sessionを生成しない。
2. Email/passwordだけを既存adapterへ接続する。signup/OAuth/recovery/CAPTCHAや実ユーザー作成を自動追加しない。
3. trusted配置設定を捕捉し、URLやlogin bodyからAPI/JWKSを選ばない。Viteはroot .env/public prefixを読み、secret形式のキー・credential URLをbundle前に拒否する。
4. memory-only controllerはtokenを公開snapshotへ含めず、SQLite/localStorage/sessionStorageへ保存しない。password欄を送信時に空にする。browser password manager/OS credentialは別の管理である。
5. bootstrapは認証確認後の明示button操作だけ。診断client IDはログインinstance内で固定し、新instanceは新IDにする。durable/native端末IDとして採用しない。
6. login/registration/refresh/logoutを直列化し、閉じたgenerationの遅着応答をUIへ戻さない。closeとdisposeでauth/connection/timerを閉じる。
7. refresh中は旧identity/contextを非公開にし、成功後も再bootstrapが必要。失敗時は再ログインへ戻し、自動rotation/retryをしない。
8. expiry timerで期限切れを表示する。長期限は有限timerへ分割し、server側の要求時/返却時検証を代用しない。期限切れでも明示refreshは可能にする。
9. 503等のregistrationは同じclient IDで明示再試行できる。401/403/binding/closedは画面の接続を閉じ、再ログインへ戻す。
10. logoutはlocal stateを即破棄し、provider側local logoutの確認を分ける。失敗bodyを表示せず、全端末やaccess JWT即時失効を主張しない。
11. pagehideで接続とformを破棄し、BFCache復帰では再読込みする。保存済み個人データの削除/保持期限は推定しない。
12. composition中のsubmitを抑止し、composition自体をcancelしない。通常入力/keyboard/mobile/dark/reduced motionを確認する。合成composition eventは実IME proofと分ける。
13. rounded surfaceと落ち着いた色・有限transitionを使う。認証/登録/待機/期限/失敗を見える状態で示し、tokenや内部例外は表示しない。
14. 同じoriginの固定v1 proxyでlocal browserと保護APIを接続する。別Compose preview profileは新専用DBを再利用し、hostはloopback1421、内側APIはloopback3002。通常PoC volume/旧DBを保持する。
15. 初回browser試験4/8失敗からnative fetchのreceiver不備を発見した。connection fieldをmethodとして呼ぶ方式を関数呼出へ修正し、receiver回帰1＋実browser再検証を追加する。Node doubleだけでbrowser接続成功としない。
16. previewの最初の到達確認はAPI listenより早く502となった。待機後に401を確認した。T3 previewの初回about:blank失敗は実URLで再試行し、PC/モバイルの表示を確認した。global Computer Useへ切替えない。
17. controller7/配置2/fetch receiver1、専用browser8、通常画面/structured回帰、型/Windows buildを確認する。provider/JWT responseはfixtureで、実ユーザー正常系・実MS IME/native Androidの証拠へ転用しない。
18. 両owner lock/manifestを0.18.0へ揃え、外部npm/Cargo不変とbuild sourceを照合する。前のignored helperからのprefix生成誤りは検証前に修正し、既存tracked証拠は保持する。通常Tauri CSP/credential/IPC・new server stream/CRDT・公開運用は別工程へ残す。
19. 通常画面の初回回帰は58/59で、peerのHome位置確認が0ではなく14となった。Home前に本文focusをassertする前提検査を追加し、同じheading-backwardを3回確認する。選択位置をscriptで強制せず、製品の選択処理を変更しない。単発失敗の原因は未確定として記録し、再発時はfocus/key/selectionの層を分けて追う。
20. 配置guard試験の静的importがVite専用の許可された.ts bridge importをNode test compileへ引き込み、TS5097になった。Vite configのruntime loadへ変え、client側のconfig型検査とNode test型検査を維持する。型検査を緩めない。
21. browser reporterのconfig.webServer.envにfixture公開キーを含む環境設定が残ることを検出した。選択証拠ではこのenv fieldだけを除外し、test結果は変更しない。元reportはignored領域へ保持し、token/private key/公開キー混入検査を再実行する。実credentialやPublishable keyを証拠へ保存しない。

[手順](../development/PRIVATE_LOGIN_PREVIEW.md)、[証拠](../../tests/evidence/private-login-20261005/SUMMARY.md)。実ログイン確認がユーザー操作待ちでも、新workspace server stream等の独立作業を先行する。改善送信は未実装/未収集。
