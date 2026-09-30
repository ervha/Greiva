# Greivaの隔離開発環境

2026-09-30のユーザー指定: **Dockerで開発・自動テスト、Windows VMでTauri・Microsoft IMEを検証する**。

以後、ホストWindowsでアプリ、npm test、Tauri、IME試験を実行しない。ソース編集とDocker CLIの操作はホストで行い、実行は下記の環境へ分離する。

## Docker: 開発・自動試験

前提: 既存のDocker DesktopがLinux containersモードで正常起動していること。ホストにNode、npm、Rust、ブラウザ、PostgreSQLを追加する必要はない。

```powershell
docker compose -f infrastructure/development/compose.yaml up --build -d dev
```

[Editor](http://127.0.0.1:1420)、[API health](http://127.0.0.1:3000/health)、[Collaboration health](http://127.0.0.1:1234/health)を開く。

- Node 24.19.0、npm 11.9.0、Rust 1.98.1、LinuxのTauriコンパイル前提、Playwright管理Chromiumはimage内に入る。
- ソースは`.dockerignore`を適用したbuild時のコピー。ホストの`.tools/`、`node_modules/`、`.git/`、`.env`、DB、過去の証拠はimageへ送らない。
- 依存、ビルド出力、SQLite、キャッシュはcontainer filesystemに置く。ソースのbind mount、Docker socketのmount、privileged実行は使わない。
- PostgreSQL 18.4のデータはCompose専用volumeに保持する。DBのhost portは公開しない。
- UI/API/collaborationのみ127.0.0.1に公開する。コンテナ側の0.0.0.0待受はポート転送に必要な設定。
- testsはRAM上限4GB・2CPU、Cargo同時ビルド2jobで実行する。
- ホストのソース変更は、同じ`up --build -d dev`を再実行して反映する。

実装を検証するには:

```powershell
docker compose -f infrastructure/development/compose.yaml --profile test run --build --rm tests
```

build、typecheck、unit/integration、Chromium E2E、SQLite初期化、**実PostgreSQL接続**、Linuxのlocked Cargo checkを実行する。開発用containerとは別のfilesystem・loopbackで実行するため、devを停止せず試験できる。

証拠だけを`tests/evidence/runs/container/<UTC時刻>/`へ出力する。試験の終了コード1は失敗を意味する。Docker socketを共有しないため、試験containerから別containerを起動しない。PostgreSQLはComposeが事前に起動してhealthcheckを待つ。

```powershell
docker compose -f infrastructure/development/compose.yaml --profile test down
```

停止時はDB volumeを保持する。LinuxでのCargo check成功をWindows起動・Microsoft IME・Gate A/Bの証拠として扱わない。

構成の参照: [Docker Compose services](https://docs.docker.com/reference/compose-file/services/)、[Playwright Docker](https://playwright.dev/docs/docker)。依存・browserはこのimageの固定版から取得する。

## Windows VM: P0検証

[Windows VM手順](windows-vm.md)を参照。Windows VMはDockerのLinux containerとは別に用意する。VMのWindows、Microsoft IME、WebView2、C++ Build Tools/Windows SDKで実際にTauriを起動する。

## 現在の状態

- Compose構文: Pass。[ログ](../../tests/evidence/isolation-20260930/compose-config.log)。
- Docker engine: ユーザーの起動後、29.6.2の応答を確認。PostgreSQL 18.4はhealthy、host port公開なし。
- image build、container内build/typecheck、unit/integration、全23件のE2E、SQLite初期化、実PostgreSQL接続、Linux locked Cargo check: **Pass**。[最終証拠](../../tests/evidence/step-2-docker-20260930/SUMMARY.md)。
- 初回のDocker E2Eで見つかったnative drag無効化、composition Enter消費、移動Undoの履歴グループ化を修正した。
- VirtualBox 7.2.20導入と空のWindows VM作成: 完了。ユーザーがホストへの仮想化ソフト導入を許可した。[VM構成](windows-vm.md)。OS ISO取得中、VM内Tauri起動とMicrosoft IMEは**Not run**。

以前のDocker Desktop起動時には`dockerInference`ソケットのアクセスエラーが記録され、ソケット退避も失敗した。現在は正常起動を確認できた。古い[ログ](../../tests/evidence/isolation-20260930/docker-engine.log)は当時の失敗記録として保持する。factory resetやvolume削除は行っていない。

## 切替前のホスト上の生成物

切替前に`.tools/`へNode/npm/Rust/Chromiumを配置し、`node_modules/`、各workspaceの`dist/`、Tauriの`target/`と試験証拠を生成した。すべてプロジェクト配下。Rustは`--no-modify-path`、Node/npmはプロジェクト内配置で、システムPATHやグローバルnpmへインストールしていない。

Docker Desktopの起動を試みたため、Docker自身の通常ログはAppDataに生成された。ソケット退避は失敗し、factory resetや設定変更はしていない。既存生成物は残している。これらは隔離環境の実行に不要だが、ユーザーの削除指示なしに消さない。
