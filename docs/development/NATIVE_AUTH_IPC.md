# Native認証IPCとclient port

v0.87.0で[専用接続画面](NATIVE_AUTH_SCREEN.md)へmountした。復元/ログイン/開閉/端末一覧を確認し、本文editor/remote sync/offline lease結合は引き続き次工程。

v0.86.0。[verified workspace admission](NATIVE_WORKSPACE_ADMISSION.md)をWindows Tauri commandへ接続し、`NativeSessionPort`を追加した。既存previewへはまだmountせず、専用native画面の次工程で使用する。

## deployment mode

build時の`GREIVA_NATIVE_PROJECT_URL` / `GREIVA_NATIVE_API_ORIGIN` / `GREIVA_NATIVE_PUBLISHABLE_KEY`をnative定数へ埋め込む。3つとも未設定なら従来PoC modeを保つ。一部だけの設定はbuildを拒否する。完全設定のURL/keyはnative provider初期化で検査し、invalidの場合は資格情報/DBを開く前に拒否する。WebViewや実行時token claimから設定を選ばない。

native modeでは新しい認証/保存commandだけを登録し、旧page/structured/workspace commandとSQL pluginを登録しない。native app identifier＋固定issuer/APIでOS保管scopeを作り、app-owned `native-session.sqlite` / `private-workspaces`を使う。未設定modeにログイン/復元/新workspace commandを提供しない。未対応OSは平文保管へfallbackしない。

## IPC契約

| Command | 入力 | 返却 |
| --- | --- | --- |
| native_auth_status | なし | available、phase、expiresAtだけ |
| native_auth_login | email/password（呼出し中だけ） | 同snapshot |
| native_auth_restore | なし | 同snapshot。refreshも同経路 |
| native_auth_logout | なし | localLocked/persistentLocked/cleanupPending/providerConfirmed |
| native_workspace_open | UUID candidateだけ | native admissionから作ったhandle/context |
| native_workspace_execute | handle、local request | 保存gateを通したlocal結果 |
| native_workspace_close | handle | 閉鎖結果 |
| native_workspace_cancel | なし | pending open/handleの閉鎖結果 |

raw token、passwordの返却、email/profile/session identityのsnapshot、origin設定、任意SQL/pathのcommandは作らない。Tauri受領後のpassword byteはzeroizeし、native sessionへ所有権を移す。WebView/IPC/HTTP内部の複製まで全消去を保証しない。UIのpassword即時クリアは次の画面接続で確認する。

client portはunknown応答をstrict検査し、余計なcredential/profile field、不正phase/期限/contextを拒否する。requestはawait前に分離し、handle/contextはimmutableにする。login/restore/open/logout/cancelでclient revisionを更新し、古いresponseを公開しない。logoutは即座に表示状態/handleを閉じ、永続lock不明とprovider確認を分ける。disposeはworkspaceをcancelし、起動復元用OS credentialを勝手にlogoutしない。

[証拠](../../tests/evidence/native-auth-ipc-20261013/SUMMARY.md)。8追加async/不正IPC条件、全unit502、型/build、Rust29、通常/設定ありWindows buildと非GUI inspectorを確認。inspectorはcompiled modeのflagと版を読むだけで、実WebView invokeやログインの受入ではない。署名HTTP/PG・pending保全の通し証拠はv0.85.0。

次は新しい専用画面にportをmountし、登録/復元/ログアウト・端末Page操作の表示とIME保全を確認する。既存候補を実機確認なしで置換しない。native remote sync/ACK・offline lease同時lock・7日復元・鍵pin/Androidは引き続き残る。
