# v0.40.0 同梱ヘルプ検証

2026-10-08。Docker内の同sourceで実行する。[実装](../../../docs/development/WORKSPACE_HELP.md)、[判断](../../../docs/decisions/workspace-help.md)。server5/native8/本文・structured wireと通常root入口を保持する。

| 検証 | 結果 | 境界 |
| --- | --- | --- |
| content/search契約 | 4 Pass | stable ID/関連、alias/NFKC/順位、全語/カテゴリ/0件、保存案内 |
| ヘルプ初回画面 | 12 Pass | 新6条件×desktop/mobile、retryなし |
| 最終workspace画面 | 52 Pass | 新12と既存40、desktop/360px dark/reduced-motion |
| 通常回帰 | 350 Pass | SQLite/kill/HTTP/portable、PG条件は別実行 |
| 実Postgres | 94 Pass | Auth/title/changes/body/structured/kill |
| root/Auth画面 | 64 / 12 Pass | 既存入口・login previewを保持 |
| 型/frontend | Pass | 通常flags0 build |
| native/Rust/Windows build | Pass | Docker locked buildとfeatures検査。host PE版/SHA照合のみ |
| 外部依存 | 不変 | npm315/app Cargo501/page-store Cargo118、owned版のみ更新 |

host/Docker source269件一致（raw259、CRLF/LFのみ10）。既存診断5件を対象外として明示する。[初回ヘルプ12件](help-ui-initial.json.gz)と最終52件のreportを分けて保存する。desktop/360pxの画像でneutral palette、折返し、記事scrollと閉じるボタンを確認した。

記事検索は既存Page/Task/メール/パスワードを索引しない。未ログインのフォーム入力後にofflineへ移り、検索・記事・関連・カテゴリを操作してHTTP requestが0件であることを確認する。0件でもqueryは保持され、Enterは記事を選択しない。版はclient manifestと一致する。

dirty title/Taskはvalue/selection方向/focusとpendingを保ち、本文はnode/DOM Range/未送信wireを保つ。keyboard起動後のEscapeはlauncherへ戻す。synthetic composition中は入口・検索のEnter/Escape・選択/閉じるを保留する。unknown title commitの記事閲覧ではdraft/operation/receiptを変えず、閉じた後のretryは同operation IDで行う。metadata記事を読むだけではpull/receive/本文ACKを実行しない。

browser suiteはbuild/type/通常/native検証後にsequential実行し、Vite再buildとの干渉を避ける。元v0.39の失敗は元証拠へ保持する。本証拠をactual Supabase正常login、Windows host Tauri invoke/Microsoft IME、Android、配備暗号化の成功とは扱わない。native dialogのbrowser composition試験はMS IME候補/再変換ではない。Calendar/初回学習/診断export等の全HELP Gateも未完了。

[集約](verification.json)、[契約](focused.json.gz)、[通常](normal.json.gz)、[PG](postgres.json.gz)、[workspace](workspace-ui.json.gz)、[root](root-ui.json.gz)、[Auth](auth-ui.json.gz)、[型](typecheck-final.log)、[frontend](frontend-build.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[Windows](windows-build.log)、[exe情報](windows-build.json)、[host PE](host-exe-inspection.json)、[source](source-inventory.json)、[依存](version-audit.json)。reportsはconfig除去/gzip、logsは行末空白のみ整理。DB/credential/dependency/cache/exeをGitへ含めない。

[desktop画像](workspace-help-desktop.png)と[360px画像](workspace-help-mobile-dark-reduced-motion.png)、[desktop保存案内](workspace-help-storage-desktop.png)、[360px保存案内](workspace-help-storage-mobile-dark-reduced-motion.png)を確認する。
