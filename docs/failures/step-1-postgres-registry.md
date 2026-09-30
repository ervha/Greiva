# STEP1-POSTGRES-START — Docker registry 接続制限

状態: 未解決（環境による起動検証ブロック）。PoC 技術仮説の否定や Gate Fail は判定しない。

## 環境と証拠

- 実行日時: 2026-09-30T08:12:09.946Z（UTC）
- 担当: Codex。Git commit: null（初期commitなし）。ソース hash と依存版は [実行metadata](../../tests/evidence/step-1/summary.json)。
- Linux x86_64 / Debian 13、Docker daemon 28.4.0、Compose 2.40.3、PostgreSQL image `postgres:18.4-bookworm`。
- [起動ログ](../../tests/evidence/step-1/STEP1-POSTGRES-START.log)、[有効なCompose構成の検査](../../tests/evidence/step-1/STEP1-POSTGRES-CONFIG.log)（成功時出力なし）。

## 最小再現

前提: Docker daemon が稼働する同じ管理環境、imageが未キャッシュ、sessionのproxy/network policyを維持する。

```sh
cd /workspace/Greiva
npm run db:up
```

期待: image pull後、PostgreSQLが起動しhealthcheck成功。

実結果: `Get "https://registry-1.docker.io/v2/": Forbidden`、終了コード1。DB接続試験は未実行。Vitest通常実行の1件skipを成功とは扱わない。

データ損失・非収束: entityデータや同期機能は未実装、DBも起動していないため該当なし。

## 原因候補の切り分け

確認済み: daemon 自体は local Unix socket で応答する。Compose構文検査は成功。image pullはregistry到達時点でForbidden。executorのnetwork権限を付けても発生する。

未確認: Forbiddenの生成元（sessionのegress policy/proxy、registry側の制限、registry認証要件）の詳細。依存版やAPI実装の不具合を示す証拠はない。registry認証の新規設定やネットワーク制限の迂回は行っていない。

## 影響と次の判断

Step 1 の PostgreSQL 起動検証を完了できない。将来の Gate C（サーバー正本とstructured sync）の検証前提に影響するが、Gate Cの合否をここで判定しない。

次の選択肢: 管理環境の公式設定でDocker registryへのアクセスを可能にする、または同じ固定imageを取得できるローカル環境で再実行する。その後 `npm run test:postgres` を実行し、実DBの証拠を追加する。別DB、代替engine、要件緩和は採用しない。Step 2 には進まない。

## 再検証

2026-09-30 17:20:21 JST: 同じ作業環境で再実行し、同じ失敗を確認した。ソース・仕様・lockfileは初回検証と同一。[今回のログ](../../tests/evidence/step-1-recheck-20260930-1720/STEP1-POSTGRES-START.log)、[環境と結果](../../tests/evidence/step-1-recheck-20260930-1720/summary.json)。状態は未解決のまま。技術置換・要件緩和は行わず、Step 2 には進んでいない。

2026-09-30 17:32 JST: 環境設定完了の連絡後、稼働セッションで同じ問題を再確認。[ログ](../../tests/evidence/step-1-environment-recheck-2026-09-30T08-32-32.197Z/POSTGRES-START.log)。設定した環境と本セッションの対応・セットアップ反映状況は未確認。
