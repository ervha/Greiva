# 個人版の実装順と受入

2026-10-05、初期提供順の委任と個人利用先行の回答に基づく計画。[範囲/残契約](PRODUCTION_READINESS.md)、[architecture](ARCHITECTURE.md)、[技術](TECH_STACK.md)、[データ](DATA_MODEL.md)、[同期](SYNC_SPEC.md)、[CRDT](CRDT_SPEC.md)、[Editor](EDITOR_SPEC.md)、[認可](AUTHZ_SPEC.md)を参照。v0.7.0で[P0のDomain/portable Application](../../tests/evidence/production-foundation-20261005/SUMMARY.md)を実装。本番adapter/UI接続とworkspace導入は未完了。

| 段階 | 具体的な変更 | 受入と進行条件 |
| --- | --- | --- |
| P0 基盤 | Domain/Application port、型付きTask/Relation command、validationと端末commitの結果 | DB/UI依存なし、invalid intentで無書込み、entity/operation原子的commit、commit失敗時に成功なし。既存PoC動作保持 |
| P1 個人workspace | workspace/device/user境界、認証/認可adapter、version付きwire/stream、schema migration | 他user/workspace拒否、account切替/ACK loss、cursor所属、保存済みpending復旧、実Auth検証 |
| P2 Page/Taskの日常操作 | 本番adapter、metadata同期、navigation、Conflict、offline状態、ヘルプ基本記事 | 必須操作/IME、元データ保全、異field merge/同field3値、保存→kill→offline復元→収束 |
| P3 基本DB | 初期型付きRecord/Property、Table/List、本文Page、filter/sortとビュー保存 | view切替で複製なし、型validation、offline/Conflict、権限、binding。初期subsetを明記 |
| P4 Windows/Android提供 | Native package、実SQLite、keyboard/lifecycle、更新/署名/backup/restore | 実MS IME/Gboard、app kill、network switching、restore/入力、配布/移行失敗から復旧 |
| 後続 | 他DB view/property、Calendar/時間割、Button/Automation、AI/音声、共有/Web/Apple OS | 各既存仕様と対応platformの受入、提供時期/費用/外部契約を個別に確定 |

P0は既存contractを型/portへ整理し、テスト済PoCを一括置換しない。P1以降でwire/storage互換を変える場合は0.xのMINOR checkpointを作り、旧artifact/旧fixtureを保存する。commitは同じcodex/poc-editorで、関連checksの済んだ変更をまとめる。区切りのpushだけを停止理由にしない。

P0の9境界条件、型/通常64＋専用PG20/画面59/実同期2/通常Windows buildは検証済み。Applicationのdurable portはcontract doubleで、production atomic SQLite adapterやJWTを実装済みとはしない。実SQL adapterのworkspace所属・account切替・遅着応答はP1/P2で受入する。

P1はv0.8.0でowner/resource読取policy、正規Page文書名、PG1snapshot adapterを部分実装。10境界条件/実PG1を含む通常74＋専用PG21とbuildがPass。実session/JWT、正本view、version付きwire/cursor、migration、write/全HTTP/CRDT経路は未完了。

初期Windows/Androidを完成扱いにするには両OSの通常アプリが必要。Android実機不在ではDockerでbuildとadapter試験を進めても実Gboard/lifecycleをPassへしない。外部provider/署名/実機を要する時は必要事項をまとめ、残る独立作業へ進む。
