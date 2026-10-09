# DB定義端末保存の判断

2026-10-09 / v0.51.0。[実装契約](../development/PRIVATE_DATABASE_SOURCE_CACHE.md)、[証拠](../../tests/evidence/private-database-source-cache-20261009/SUMMARY.md)。初期6型/Table/Listの端末保存を進める自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | Source read cacheを先に実装 | Record/Viewの型定義を耐久化してから内容適用へ |
| 2 | native8→9をbound open内で原子移行 | Page/title/Task/旧queueを保全 |
| 3 | binding照合後にDDL | foreign ownerで移行しない |
| 4 | snapshotとread responseの版履歴 | currentの元観測を照合可能にする |
| 5 | current→history参照 | 受信結果とprojectionを同commitへ |
| 6 | 古いreplyは履歴のみ | 遅着で最新定義を戻さない |
| 7 | 同版divergenceと位置変更を拒否 | 不整合を上書きしない |
| 8 | 6型/Name/Select/canonical refsをnative検査 | portable境界を迂回しても型を守る |
| 9 | ZodとUnicode codepoint/JS空白を一致 | 初回UTF16不一致Failを修正し証拠保持 |
| 10 | UUID keyset/default50/max100＋lookahead | 端末一覧の取得をboundedにする |
| 11 | unknown Sourceはnull | 読取でdefault entityを発明しない |
| 12 | 最新current/history/receiptを読取照合 | 破損を空cacheや補修へ変えない |
| 13 | strict IPC/app-owned rootを再利用 | SQL/path/profileをcommandへ追加しない |
| 14 | captured Auth generationを継続 | refresh後の旧cache accessを拒否 |
| 15 | actual Rust/SQLite/SIGKILL2 | 通常JS mockだけで耐久保存を証明しない |
| 16 | cacheとACK/fullsync/実native Gateを分離 | Record/View queue/delta/UIへ証拠を拡大しない |
