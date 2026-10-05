# 認証済workspace接続

2026-10-05、v0.16.0。strict bootstrap共通DTO、PrivateWorkspaceConnection、auth generationと固定storeの境界を実装。

新10条件＋既存同期session9条件、通常158件Pass/実PG用27件skip、専用PG27件Pass、型/通常Windows buildがPass。実PGの認証→HTTP bootstrap→Rust/SQLiteを新connectionで接続し、foreign device/revoked拒否、refresh後同binding、server同期pathが404でもprepared pendingが残ることを検証した。provider login/refreshはfixture。

refresh/closeは旧syncを永久に閉じ、bootstrap後だけ同じbindingで再接続する。binding変更は拒否し、captureした旧storeで開始済みcommitが完了しても現在の成功として返さない。秘密のない固定errorとprepared wireの維持を確認した。

初回全回帰では既存移行fixtureのrollback直後読取りが非同期lock解放に競合した。読取接続に5秒上限を付け、version/columns/Page/pendingの検査を保持して全回帰を再実行した。製品の移行処理は不変。途中のimport/error分類修正も[全16判断](../../../docs/decisions/private-workspace-connection.md)へ記録。

[集約](verification.json)、[通常](vitest.json.gz)、[実PG](postgres-vitest.json.gz)、[source93](source-inventory.json)、[Windows build](windows-build.json)、[版/外部依存監査](version-audit.json)。外部npm315/両Cargo lock不変、両owner0.16.0。通常buildにcrash hooksなし、source hashをbuild前後に照合。生成exeはignored領域のみ。選択raw JSONのJWT/private key/Publishable key混入を検査。

未完成：通常UI/起動main/Tauri IPC、OS credential、新server同期HTTP/Page CRDT、実ユーザー正常login/refresh/失効、Windows/Android新native証拠。UIを変えない独立moduleのため画面59/実同期2は[v0.14証拠](../workspace-store-20261005/SUMMARY.md)を保持。実Supabase公開JWKSのnegative確認は[v0.15証拠](../auth-session-20261005/SUMMARY.md)と区別する。改善送信は未実装/未収集。
