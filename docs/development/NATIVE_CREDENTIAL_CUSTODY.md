# Native資格情報保管・永続ログアウト

v0.78.0。[採用した方針](../plan/NATIVE_SESSION_POLICY.md)のnative保管基盤を追加した。`CredentialVault` はnative providerのためのportであり、JWT検証、offline grant、UIログイン復元そのものではない。現行previewのmemory-only認証はまだ置き換えない。

## 保管境界

Windowsは `CredReadW` / `CredWriteW` / `CredDeleteW` のgeneric credentialを使用し、同一Windowsユーザー・同一端末へ保持する。app identifier＋issuer＋APIから作る信頼済みdeployment scopeのhashと、SQLite生成のslotでtargetを分離する。provider/user名/email/profileをOS credentialのmetadataへ書かない。2560 byteを超える値は失敗とし、平文やlocalStorageへfallbackしない。

[Microsoft CREDENTIALW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/ns-wincred-credentialw)と[CredWriteW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew)に従う。OSユーザーの保護境界であり、同一OSユーザーで動く他processからの隔離を保証しない。`Secret` はDebug/Serializeを持たず、直接管理するbufferはzeroizeする。native provider/adapter内部以外へbyteを返すIPCを登録しない。

## markerと処理順

別の `session.sqlite` にscope hash・世代・slot・subject hash・active marker・廃棄待ちslotだけを保存する。workspace DB/devices.sqlite/pendingは変更しない。SQLite FULL/WAL、BEGIN IMMEDIATEで別instance/processも直列化する。

1. login/restore開始は世代を進め、markerをlockedにしてcommitする。旧slotと仮の新slotを廃棄待ちとして記録する。
2. restoreは旧slotをOSから読む。未保存/読取失敗/処理中の強制終了ではlockedのまま。回転済みか不明なrefresh tokenを自動再送しない。
3. native providerが署名sessionのissuer/subjectを検証した後に `complete` を呼ぶ。restore時はsubject hashを固定する。ticketのscope/世代/slotが最新であることをSQLite write gate内で検査し、OSへ新credentialを書いてからactive markerをcommitする。
4. logoutは先にmarkerをlockedへcommitし、続いてOS credentialを削除する。削除失敗はcleanup pendingとして保持し、ロックを取り消さない。旧ticketの完了は拒否する。

OS書込み成功後に応答喪失/SQL rollbackがあってもactiveにならない。廃棄待ちの旧slotを100件ずつcleanupする。現在のactive/仮slotはcleanupから除外し、次の世代へ移った後に回収するため、書込みとの競合で追跡を失わない。credentialの削除を確認できない限り削除完了と表示しない。

logoutのSQLite commit前に落ちた場合、永続logoutは未確定で、直前のactive markerが残る。上位native sessionは操作開始時に表示/handleを閉じ、永続lock確定とOS cleanup結果を分けて扱う必要がある。DB破損/別scope/未来schemaは拒否し、新しい認証済み状態へ自動補修しない。

## 検証と接続順

DockerのRust unitは実SQLite＋OS doubleで、再起動・別instance・別DB ticket・旧owner遅着・書込み応答喪失・読取/削除失敗・秘密値のSQLite不在を検証する。`credential-crash-driver` は `crash-test-hooks` 限定で、固定架空値をmemoryで生成するpresence-only OS double。実SIGKILL 7件のbefore/after commitを確認する。

WindowsではDocker cross-buildした `credential-probe.exe` が専用の架空targetだけをwrite/read/replace/deleteし、後片付けまで確認した。既存資格情報を列挙しない。この確認は実Supabaseログイン・UI・IMEとは別の証拠。

次はnative provider transport/署名認証、scope固定offline grant、clock rollback検査とstore/表示のlockを接続する。Android OS adapterは別実装で、未対応OSに平文保管を提供しない。[証拠](../../tests/evidence/native-credential-20261013/SUMMARY.md)。
