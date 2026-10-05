# 認証済workspace接続の全判断

2026-10-05、v0.16.0。P1の認証→bootstrap→固定した保存先への接続を進める自主判断。

1. bootstrapのrequest/responseを共通strict DTOにする。要求は固定client IDだけで、owner/workspace/epochを要求bodyから採用しない。
2. API originの検査をsharedへ集約し、HTTPSか開発用loopback HTTPだけ許可する。設定・client ID・fetch関数を生成時に捕捉する。
3. ownerはAuthSessionが保護APIで検証したissuer/subjectだけを使う。bootstrap responseからownerや権限を推定しない。
4. exact auth generationのAbortSignalをleaseとして捕捉する。refresh/close/期限切れでは旧contextを現在の接続として返さない。
5. refresh時は旧同期sessionを永久に閉じる。同じ保存先でも新generationでbootstrapをやり直してから再接続する。
6. 過去bindingとworkspace/client/epoch/ownerのどれかが変わったら接続を閉じる。DBの付替え・消去・再登録を自動で行わない。
7. connectionごとにactive同期sessionは1つとし、置換時には旧sessionとabort listenerを解除する。
8. prepared wire文字列をそのまま送る。cookies omit、redirect error、cache no-store、15秒timeout、auth/connection/sessionのabortを合成する。
9. store関数を生成時に捕捉し、durable処理の前後でleaseを確認する。開始済みcommitが旧storeで完了する可能性は残るが、新sessionの成功として返さない。
10. store処理中のcloseをstorage失敗より優先するよう既存WorkspaceSyncSessionを修正する。close前の実storage失敗は引き続きstorageとして扱う。
11. 401/403ではconnectionを閉じる。503/transportや不正responseは固定errorにしてpendingを保持し、自動再送・旧PoC fallbackをしない。
12. connection closeとAuthSession logoutを分ける。接続を閉じてもshared認証sessionや端末データを消去しない。
13. 新同期HTTP pathをclientへ実装するが、server streamはまだない。実HTTPの404でもprepared pendingが残ることを実PG/native SQLiteで確認し、同期完了とはしない。
14. 新10条件、既存非同期9、更新した実PG1を全回帰で確認する。通常UI/native操作/実ユーザーのprovider正常系の証拠には転用しない。
15. 全回帰で既存移行試験のrollback後読取りがSQLite lockに競合した。試験用読取接続へrepositoryと同じ5秒上限を設定し、version/column/Page/pendingのrollback検査を保持する。製品の移行処理は変更しない。
16. 両Cargo.lockのownerだけを更新し、driver外部依存・parent外部Cargo/npmの不変と版整合を監査する。通常Windows buildのsource一致を前後で確認する。

[証拠](../../tests/evidence/private-connection-20261005/SUMMARY.md)。旧Page/DBを保持し、改善データの収集は始めていない。次は明示的な保護API起動/configと実ログイン検証の入口へ進む。
