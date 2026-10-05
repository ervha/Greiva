# ログイン接続確認画面

2026-10-05、v0.18.0。独立auth.html、memory-only controller、明示login/bootstrap/refresh/local logout、Compose previewと固定proxyを実装。

controller7/配置2/fetch receiver1を追加。通常171件Pass/PG用30件skip、専用PG30件Pass、型/通常Windows buildがPass。専用browser8（PC/モバイル各4）、通常画面59、実structured同期/Conflict2、既存heading-backward再確認3がPass。自動retryは0。keyboard/password欄消去/合成composition submit抑止、失敗body非表示、期限/遅着/close/再読込み、tokenの端末storage不使用、dark/reduced motion/横overflowなしを確認した。

初回auth browserは4/8失敗。Nodeでは出なかったnative fetchのreceiver不備を修正し、関数呼出の回帰条件とbrowser操作で再検証した。初回通常画面は58/59で、peerのHome位置が0にならず14となった。本文focusを確認する前提を加え、同条件3回と全59を再確認した。初回原因は未確定で、製品の選択処理は変更せず、再発調査へ保持する。配置試験のTS5097/helper prefix/preview初回502も[全21判断](../../../docs/decisions/private-login-preview.md)へ記録した。

fresh Docker imageでCompose previewを起動。提供済みSupabase公開設定をignored local envから使用し、auth.html200/保護proxy無認証401を確認した。既存専用local private PG volumeを保持し、通常PoC/旧SQLiteを変更していない。T3 previewでPC/モバイル表示も確認し、実ユーザーのcredentialは入力していない。

[集約](verification.json)、[通常](vitest.json.gz)、[実PG](postgres-vitest.json.gz)、[専用画面](auth-ui.json.gz)、[通常画面](root-ui.json.gz)、[実同期](structured-ui.json.gz)、[再確認](focus-recheck.json.gz)、[source100](source-inventory.json)、[Windows](windows-build.json)、[Compose](compose-check.json)、[両lock/版監査](version-audit.json)。外部npm315/両Cargo不変、両owner0.18.0、build前後source hash一致、通常buildにcrash hooksなし。選択JSONのJWT/private key/公開キー混入を検査。exeはignored領域のみ。

browser reporterのconfig.webServer.envだけを選択JSONから除外した。元reportはignoredへ保持し、test結果を変更していない。選択JSONのJWT/private key/公開キー混入検査がPass。[PC表示](login-desktop.png)、[mobile/dark表示](login-mobile-dark-reduced-motion.png)はfixtureの入力前capture。

未完成：実Supabase正常ユーザーlogin/refresh/失効、OS credential/Tauri workspace IPC/new server stream/CRDT、公開配布とWindows/Android新native受入。browser responseはfixture、合成compositionは実MS IME証拠ではない。通常Tauri CSPは不変で、専用画面はbrowserの確認用。改善送信は未実装/未収集。追加の手操作を求めず、新server同期等へ続ける。
