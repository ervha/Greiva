# Docker Desktop起動不能（Windows、復旧確認済み）

2026-09-30の追記: ユーザーの「起動しました」という連絡後にdesktop-linux server 29.6.2の応答を確認した。image build、PostgreSQL 18.4起動、隔離環境の全自動試験が成功。[最終証拠](../../tests/evidence/step-2-docker-20260930/SUMMARY.md)、[Dockerの実状態](../../tests/evidence/step-2-docker-20260930/docker-runtime.json)。以下は復旧前の記録。ソケット問題の原因やユーザー側の具体的な復旧操作は未確認で、修復方法を推測しない。

2026-09-30、隔離環境の前提確認でDocker desktop-linux engineへの接続に失敗した。

## 再現

```powershell
docker --context desktop-linux info --format '{{.ServerVersion}}'
```

期待: server版が返り、`docker compose -f infrastructure/development/compose.yaml up --build -d dev`を実行できる。

実結果: `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.`。[ログ](../../tests/evidence/isolation-20260930/docker-engine.log)、[日時・結果](../../tests/evidence/isolation-20260930/environment.json)。Compose構文はexit 0。

切替前にDocker Desktopの起動を試みた際、backendログに`initializing Inference manager`、`dockerInference`、`The file cannot be accessed by the system`を確認した。対象は0バイトのreparse pointで、同じフォルダへ退避する試みもアクセスエラーで失敗した。実データやvolumeは削除していない。

確認済み: Docker CLIは利用可能、Compose定義は有効、指定engineに到達できない。

未確認: ソケット不具合の原因、現在のDocker Desktopの回復方法、image pull/build/起動、container内の全試験。

影響: Step 1 PostgreSQL実起動、Step 2の隔離環境E2E再検証が未完了。アプリのデータ消失/非収束やGate Failは判定しない。

次に必要な外部状態: 既存Docker Desktopが正常起動し、Linux engineに接続できること。factory reset、volume削除、ホストへの再インストール/設定変更は自動で行わない。正常起動後に隔離手順のコマンドを実行し、証拠を追記する。
