# 個人版の提供順と基盤設計 — 自律判断全件

2026-10-05、checkpoint v0.6.27。source/製品0.6.25は変更しない。利用者回答は「機能優先はおまかせ」「個人利用と自分の端末間同期を先行」。既存[PoC採用条件](poc-technology-selection.md)と[要件](../plan/GREIVA_REQUIREMENTS.md)の境界を維持する。

1. 初期はWindows/AndroidのPage/Task/Relationと基本DB Table/Listを選ぶ。全Notion対象という製品要求は維持し、全機能の同時提供とはしない。Calendar/Automation/AIは後続、Home/Inboxの未決定機能は仮定しない。
2. 個人workspaceと自分の端末間同期を先行し、共有/招待/public link UIを初期へ含めない。個人版でもserver/CRDTの認証/所属検査を省略しない。
3. architecture→技術→データ→sync→CRDT→Editor→認可の設計案を作り、実装済みPoCとの差/証拠を明示する。port分離とdomain/applicationを最初の実装単位にする。folder移動だけで本番化としない。
4. verified atomicityを残すため、初期native保存はRust/sqlx Repository＋Tauri IPCを基準とする。SQL plugin経由への書換えをしない。plugin依存整理は別検証。要件v0.8に変更理由を記録する。
5. 初期monorepoはnpm workspaceを継続する。pnpm/Turborepoへの移行・lock変更・Docker再構築を基盤設計と一括実施しない。要件v0.8へ明記する。
6. 旧「server操作ID採番」とoffline enqueue/現client UUID v7の食い違いを整理し、client安定operationIdとserver sequence/version/cursorを分ける。要件の表記を修正し、既存wireを黙って変更しない。
7. Page metadata同期、workspace/wire/migration、Web保存、Auth/token/配布、retention/失効/PoC import/基本DB詳細は未実装として追跡する。保持期限やschema帰属を仮定して旧DBを書換え・削除しない。
8. 本番provider/署名/endpointや課金を設定せず、既存specの設計だけを具体化する。初期範囲の回答を停止理由にせず、独立する基盤コード・fixtureを先に進める。
9. 文書PATCH27、同じbranch、製品manifest/lock/実行物は25を保持。今回のリンク/技術版表/source照合を検証し、59 E2Eや最新native/IMEを新たに実行したと呼ばない。

具体的な[実装順](../plan/IMPLEMENTATION_PLAN.md)、[残契約](../plan/PRODUCTION_READINESS.md)。前の[Windows診断判断8件](windows-profile-followup.md)と[描画等13件](step-8-render-isolation.md)はそのまま保持。技術判断を記録済みで、利用者の選択とCodex判断を混同しない。
