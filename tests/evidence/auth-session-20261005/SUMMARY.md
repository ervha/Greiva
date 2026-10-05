# Supabase認証sessionと保護HTTP接続

2026-10-05、v0.15.0。明示配置設定、memory-only AuthSession、password/refresh/local logout REST adapter、Supabase設定からserver verifierを合成するfactoryを実装。

追加client14条件はtoken非公開、server検証後identity、rotation、refresh中の要求拒否、owner切替拒否、close/旧応答、期限、固定error、local logout確認、配置設定/安全なHTTP要求を検査する。実署名JWT/loopback HTTP2ではGreiva側の署名検証とowner access、期限/subject不一致を拒否した。追加実PG1では認証済client→bootstrap transaction→実Rust/SQLite pending再起動保持を接続し、他owner端末ID衝突のrollbackと失効済み端末再登録の拒否を確認した。provider password/refresh/logoutはfixtureである。

通常148件Pass/実PG用27件skip、専用PG27件Pass、型/通常frontend/API/Windows buildがPass。source92、通常buildにcrash hooksなし、外部npm315/parent Cargo不変。tracked standalone lockのowner版を0.15.0へ修正し、yoke-deriveだけを既存parent 0.8.3へ揃えた。全driver依存のname/version/checksumがparentに含まれる。歴史記録の「ignored lock」の誤りと途中失敗は[全16判断](../../../docs/decisions/supabase-auth-session.md)に訂正している。

実SupabaseへのHTTPS JWKS/Auth settingsは200、ES256/Email有効。提供済みprojectの実公開鍵を使う保護HTTPで、無認証/偽の署名を401とし、storageへ到達しないことを確認した。外部へユーザーを作成したりpassword/tokenを送っていない。正しい実ユーザーでのlogin/refresh/失効は未確認。

[集約](verification.json)、[通常](vitest.json.gz)、[実PG](postgres-vitest.json.gz)、[実公開鍵negative検証](live-check.json)、[source92](source-inventory.json)、[通常Windows](windows-build.json)、[両lock監査](version-audit.json)。raw JSONのcompact JWT/private-key/project Publishable key混入を検査。生成exeはignoredローカル領域だけ。

未完成：通常ログインUI/起動main、OS credential/再起動復元、自動refresh scheduler、新workspace同期HTTP/Page CRDT、全device失効経路とoffline/logout保持契約、実Auth正常系、Windows/Android新native証拠。GUIを変えない独立moduleの追加のため既存画面59/実同期2は[v0.14回帰証拠](../workspace-store-20261005/SUMMARY.md)を保持し、今回再実行していない。改善送信は未実装/未収集。
