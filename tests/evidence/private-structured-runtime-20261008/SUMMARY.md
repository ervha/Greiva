# 個人workspace Task・Relation runtimeの検証

2026-10-08 / v0.30.0。captured Auth/native storeへtyped mutationとexplicit workspace同期を接続。画面mountは後続。

| 検証 | 結果 | 範囲 |
| --- | --- | --- |
| 通常 | 268 Pass / 70 Skip | 新native adapter2、実Rust runtime6、試験bridge2を含む全体回帰 |
| PostgreSQL | 70 Pass / unhandled 0 | signed fixture HTTP＋実PG＋二つのRust SQLite。Conflict三値、新operation解決、Relation、ACK喪失/restart、rejection、失効後pending保持 |
| 型/Rust/frontend | Pass | app/test全体、normal/crash drivers、normal frontend flags=0、default native features |
| Windows | Docker cross-build Pass | locked debug/custom-protocol。hostでexe FileVersion 0.30.0とSHA照合。未起動/IME未実施 |
| source/依存 | Pass | 235一致：raw223/LFのみ12、診断5を明示除外。外部npm315/両Cargo118・501 entry不変 |

初回型検査は既存WorkspaceSyncSessionにsignal getterがなく失敗。公開read-only AbortSignalを追加してstream置換の取消も実SQLiteで検証した。初回focusedは16 Pass、追加のstream置換を含む最終normalは268 Pass。

PG focusedの初回1 Pass/1 Failは、server rejectionを確認しようと古いlocal版999を指定し、端末のbase検査で先に拒否された試験期待の誤り。存在しない参照先へのRelationに変更し、native保存→server拒否→operation保全を検証した。

最初の全PGはassertion70 Passに加えて、既存StructuredDeviceのstdout途中JSONでunhandled exception1、exit1だったため不合格として保持する。SIGTERM/SIGKILLで終了した不完全frameを成功として扱わず、pending requestを拒否するbridge修正と2条件のunitを追加。型/通常268/PG70を再実行し、unhandled0・exit0を確認した。製品の失敗を無視する設定は追加していない。初回reportを後のPassで置換しない。

新しい画面変更はないためUI E2Eは再実行していない。再現はDockerで `npm run typecheck`、`npm test`、既存開発DB設定の `npm run test:postgres`、normal flags=0の `npm run build`。locked Rust normal/crash examples、Windows cross-buildとfeature監査は前checkpointと同じ既存cache/command。SDK/PDB警告を保持する。秘密credentialを使用しない。

[集約](verification.json)、[通常](normal.json.gz)、[PG最終](postgres.json.gz)、[初回focused](initial-unit.json.gz)、[PG focused初回](initial-postgres.json.gz)、[PG unhandled](postgres-unhandled.json.gz)、[型](typecheck.log)、[normal Rust](native-build.log)、[crash Rust](crash-build.log)、[frontend](frontend-build.log)、[Windows](windows-build.log)、[exe](windows-build.json)、[features](native-features.log)、[source](source-inventory.json)、[依存](version-audit.json)、[契約/13判断](../../../docs/development/PRIVATE_STRUCTURED_RUNTIME.md)。reportのconfig除外/gzip、log行末空白整理、secret/JWT patternと相対リンクを確認。実Auth正常系、native JWT/OS credential/offline grant、Windows invoke/IME、Android、暗号化配備、本番既定入口は未完成。

外部npm数の説明はv0.31.0で323の誤記を315へ訂正。元のversion-audit.jsonと実行結果は変更していない。
