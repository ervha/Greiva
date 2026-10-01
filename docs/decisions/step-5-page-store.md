# Step 5: native PageのSQLite永続化

2026-10-01。`POC_SPEC.md` Section 18 Step 5に対応する。Page本文はYjs binary updateを正本とし、metadataを別表に保存する。Tiptap JSON/textの二重保存やPage本文のREST同期を追加しない。Task/Relationのentityとqueue/cursorはStep 6以降。

Tauriから固定のlist/load/append/title commandだけをRust PageStoreへ渡す。frontendにはraw SQL・任意DB pathを許可しない。WAL、FULL synchronous、foreign key、update digest、transaction内のupdate/updatedAt変更とdedupを使う。schema未対応やchecksum不一致は復元を止め、DBを自動初期化しない。last opened PageをSQLiteで保持し、sessionごとに選択IDを固定する。

restoreを終えてからproviderへ接続する。local update listenerを先に登録し、同期のupdateだけでなくSyncStep2応答も、そのframeに含む変更のSQLite commit後に送信する。失敗した保存境界は後続送信へ進めず、エラー表示・read-only・本文保全を案内する。正常browserは永続保存のない補助プレビューと明示し、試験時だけDockerの同じRust repositoryへIPC相当のtransportを置く。

offline初期化はserverと同一のCRDT seedを使い、独立した空paragraphの重複を防ぐ。titleは現時点で端末内のみ。本文やPageの存在をtitleのsync済み表示に読み替えない。保存/ACKで頻繁にrerenderするためEditorのextension/NodeView構成を安定させ、選択状態を保つ。

[Dockerの検証](../../tests/evidence/step-5-page-store-20261001/SUMMARY.md)と[Windows実機の独立結果](../../tests/evidence/step-5-native-recovery-20261001/SUMMARY.md)を分ける。実機は通常権限で自作候補を起動し、host toolchainを導入していない。Google IMEの結果をMicrosoft IMEへ転用しない。native全Editor項目・Android・最終Gateは未判定。
