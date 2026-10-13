# v0.81.0 Offline grantの明示起動設定

2026-10-13。[実装契約](../../../docs/development/PRIVATE_OFFLINE_STARTUP.md)。通常APIの起動設定と署名鍵検査を接続した。

| 検証 | 結果 |
| --- | --- |
| 対象 | 4 Pass（設定unit3、実runtime/PG1）。未設定/部分設定/不正鍵・権限・symlink・容量・鍵ペア、DB接続前の拒否、認証→bootstrap→署名発行、未設定時404 |
| 全unit | 487 Pass、Fail/skip 0 |
| 全PostgreSQL | 37 files、229 Pass、Fail/skip 0。自動検出runnerで実行 |
| 型・build | typecheck/server/frontend/通常Windows custom-protocol build Pass。test hooks/SQLite bridge 0 |
| Windows成果物 | 0.81.0のPE版とDocker/host SHAを照合。GUIは起動していない |
| Source | Host/Docker395件一致（raw385、改行のみ10）。対象外5件はverification.json |
| 外部依存 | npm315、Cargo506/135の外部entry不変。dependency-audit.json |

Windows SHA-256は `aff963b5f9da3fa35e971af7c0ef8795471da111db1727f502d046fc0eebabbf`。元のWindows linker warningをbuildログに保持。各テストの詳細は圧縮JSON、集計はverification.jsonに記録した。鍵・token・本文は証拠へ含めない。

Rust12とWindows OS保管の3プロセス復元・logoutは[v0.80.0の証拠](../native-offline-lease-20261013/SUMMARY.md)であり、今回は再実行していない。実行中の旧接続プレビューへ鍵設定を追加していない。native provider/通常UI・IPC/実Auth/IME/Android、鍵配布・rotationと最終Gateは未完了。

利用者指示により、検証済みの本checkpointで停止する。追加のテスト周期や次機能の実装へ進まない。
