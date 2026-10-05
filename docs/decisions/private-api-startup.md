# 保護API起動の全判断

2026-10-05、v0.17.0。P1の起動/configを進める自主判断。

1. 通常PoCのmainを置換せず、private-mainと専用npmコマンドを追加する。旧未認可routesを公開しない。
2. project URL/algorithm/DB/schemaを必須にし、token claimsや既定projectから推定しない。hostはloopback、portは3001を既定にし、明示値を検査する。
3. private APIにはPublishable key、user password、access/refresh tokenやservice_roleを渡さない。署名検証用のproject origin/algorithmだけを使う。
4. 既存schemaをread-onlyのrepeatable-read transactionで検査する。versionと必要なtable/view columnsを確認し、未初期化/未知版/不通ならlisten前に拒否する。全制約や運用権限の監査を代用したとはしない。
5. 初期化は専用init-privateコマンドだけ。fresh schemaを作り、既存namespaceへIF NOT EXISTS/自動repair/取り込みを行わない。
6. runtimeはpoolとappを所有し、readiness/listen失敗時に両者を片付ける。closeは同じPromiseへまとめ、shutdownも固定errorにする。
7. 接続/SQL待機を有限にする。idle pool errorは秘密を出さないhandlerで受け、requestの検証不通はfail closedを保持する。
8. 生成時に配置設定とtrusted pool/JWKS portを捕捉する。await中の呼出側変更で接続先/公開鍵取得先を差替えない。
9. CLIはconfiguration/schema/listen/shutdownの固定stageとservice/eventだけをログへ出す。DSN、SQL、token、request bodyやerror causeは出さない。
10. SIGINT/SIGTERMでlistener/poolを閉じる。実プロセスの起動とSIGTERM正常終了を検証し、試験で残るfixtureだけを後片付けする。
11. 新DockerfileはNode/npmを固定し、全workspace manifestを先にコピーしてnpm ciする。server buildだけを実行し、Windows hostへtoolchainを追加しない。
12. 独立Compose構成は新専用PG volumeを持ち、API host portを127.0.0.1へ制限する。local専用DB passwordを本番へ使わない。既存PoC/失敗DBやvolumeは変更しない。
13. configuration/失敗cleanupの通常3、実PGの署名HTTP/CLI初期化拒否/実プロセス終了3を追加する。全回帰と独立Docker build/Compose起動、通常Windows buildを分けて記録する。
14. 提供済み実Supabase URL/ES256でlocal APIを起動したが、無認証401/旧経路404までの確認である。実ユーザー認証、browser UI/credential、新server stream/CRDT、公開運用は別工程。専用local API/volumeは次の画面開発のため保持する。

[起動手順](../development/PRIVATE_API_STARTUP.md)、[証拠](../../tests/evidence/private-runtime-20261005/SUMMARY.md)。改善送信は未実装/未収集。追加手操作を求めず、次はmemory-onlyログイン検証画面へ進む。
