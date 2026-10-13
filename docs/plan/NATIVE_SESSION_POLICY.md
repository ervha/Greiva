# Nativeログイン復元・オフライン利用・ログアウトの方針

2026-10-13。利用者は3項目ともAを選択した。本書は採用した製品契約であり、資格情報保管/offline grantが実装済みという記録ではない。

v0.78.0：[native資格情報保管・永続ログアウト基盤](../development/NATIVE_CREDENTIAL_CUSTODY.md)を実装。Windows OS adapterを架空値で実機確認し、実SQLite/強制終了の失敗境界を検証した。native provider/ログイン復元UI/offline grantは未接続。

v0.79.0：[server発行とnative署名検証](../development/NATIVE_OFFLINE_GRANT.md)を実装。署名/全scope/nonce・固定7日・時計逆行の検査をDocker実PG/HTTP/Rustで確認。OS保管・永続clock/store/UIとの接続は残る。

## 採用した動作

| 項目 | 採用内容 |
| --- | --- |
| 起動時のログイン復元 | OSの安全な資格情報保管を使って自動復元する。保存できない場合、平文ファイル/localStorageへfallbackしない |
| オフライン利用 | 最後のオンライン認証から7日間、保存済みデータを閲覧・編集できる。期限後は再認証までロックする |
| ログアウト | 表示をロックし、端末データと未送信操作を保持する。同じissuer＋subjectの再ログインで同じ端末/workspaceへ復帰する |

password/メール/profileをGreiva DB/ログへ保存しない。再認証用credentialはnative側のOS保管を使い、UIへ保管内容を公開するIPCを作らない。通信に必要なaccess tokenも本文/operation/SQLite/証拠へ混ぜない。資格情報の復元だけで認証成功とせず、serverの署名sessionとworkspace/device認可を確認してからオンライン操作を許可する。

## 7日間の境界

7日間は604800秒とする。オンラインで本人と対象workspace/deviceの認可を確認した時点に基づき、nativeで検証できるgrantへ対象と期限を束縛する。UIの自己申告時刻、単なるネット接続復帰、古いJWTの読取りでは期間を延長しない。期限到達時に新しい閲覧/編集を閉じる。既に確定した端末commitやpendingを削除せず、入力中データの保全と閉鎖順序を受入で確認する。

offline grantはlocal閲覧/編集だけを認め、APIへ送る認証情報の代用にはしない。再接続後は有効なsessionと現時点のdevice認可を確認してから送信する。失効を知った時点では期限内でもロックする。完全offline中はremote失効を即時検知できないため、最長7日の猶予が残る。clock rollback/破損/別owner・device・epochのgrantで期限を延ばさず、再認証へ誘導する。署名・時刻保護・OS別adapterの具体実装は別checkpointで検証する。

## ログアウトと復帰

local logoutを先に反映し、認証済み表示・進行中session・native handleを閉じる。OSの自動復元credentialとoffline許可を無効化し、再起動で勝手にログイン復元しない。削除/失効結果が不明でもlocal lockを維持するため、永続logout状態とcredential更新の順序・kill/restartを設計する。provider logoutの確認に失敗してもlocal logoutを取り消さない。

workspace/device metadata、本文、queue、Conflict、元wire/receiptは保持する。別アカウントへ再送せず、同じメールだけで復帰を許可しない。データ消去は別の明示操作として今後扱い、ログアウトへ自動削除を追加しない。

## 実装順と受入

1. native credential/署名grantのportと状態遷移を定義し、raw credentialをUIへ返さない構成にする。
2. Windows OS保管adapter、起動復元、refresh時の置換、logout永続lockを実装。保管失敗/応答喪失/kill前後/旧account遅着を検査する。
3. server認可に基づくscope固定grantとnative検証・期限/clock rollbackを実装し、保存storeのopen/execute/表示を接続する。
4. 7日直前/ちょうど期限、offline編集→再接続、失効、同account復帰、異account拒否、pending保全をDockerとWindows実機で別々に検証する。
5. Android OS保管とlifecycleを同契約で受入し、本番入口の昇格を判断する。

実ログインは利用者が現在操作できないため保留する。認証以外の独立開発を続ける。[個人情報/暗号化方針](ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md) と [Native IPCの現状](../development/NATIVE_WORKSPACE_IPC.md) を併せて参照。
