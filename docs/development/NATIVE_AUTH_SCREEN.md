# Native認証の専用接続画面

v0.87.0。[native認証IPC](NATIVE_AUTH_IPC.md)へ`native.html`の専用画面を接続した。既存workspace previewを一括置換せず、新しい候補を別出力へ生成する。

## 復元・開閉・表示

起動時にnative statusを確認し、保管credentialの復元を一度だけ試す。失敗したcredentialをtimer/focus/renderで自動再送しない。手動login/refreshはnative IPCへ渡し、token/identityをWebViewへ返さない。登録だけは既存の直接Supabase signupを使い、responseを認証成功にしない。passwordはsubmit/mode変更/pagehideでフォームからクリアし、composition中はsubmit/mode変更を止める。

verified後の明示openでstable device＋署名server bootstrapを確認し、端末Page一覧を表示する。strict local一覧のcontextがnative handleと一致しない場合は表示せず閉じる。pagination失敗時は表示済み一覧を保持するが、認証が閉じていれば一覧を消す。期限切れでは再認証へ移り、自動refreshしない。

logoutは表示を先に閉じ、永続lock不明とprovider未確認を分けて案内する。永続lockを確認できなければ再確認buttonを出す。workspace閉鎖/pagehideではlocal handleだけを閉じ、OS credentialを勝手に削除しない。保存済み本文/pendingは従来のnative gateが保持する。

現在の画面は接続と端末一覧だけ。本文editor、native remote sync/ACK、offline lease同時lock/7日復元は次工程。一覧の未送信数を表示し、接続/一覧取得だけで「同期済み」と表示しない。保存済み件数0はserver収束の証明ではない。

## buildと受入

`npm run build:native-preview -- <.data内の新しい出力>`をDockerで使う。既存private public設定を検査し、同一project/API/public keyをnative定数とsignup用frontendへ埋め込む。entryはnative.html、同一private app identifierを使うが既存候補を上書きしない。native modeでは旧command/SQL pluginを登録せず、WebViewのCSPはsignup providerだけを許可する。通常buildではnative.htmlを含めるが、browser/default未設定modeでfake nativeログインを提供しない。fixture HTMLとtest hook/SQLite bridgeを候補へ含めない。

[証拠](../../tests/evidence/native-auth-screen-20261013/SUMMARY.md)。controller5/全unit507、Docker画面10・型、native候補build/host inspector/版/SHAを確認。desktop/mobile-darkのfixtureスクリーンショットを視覚確認した。実Tauri invoke、実accountの自動復元/refreshやMicrosoft IME入力は未実施。画面の合格をWindows/Androidの受入へ広げない。
