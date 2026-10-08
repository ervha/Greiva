# 個人workspaceの同梱ヘルプ

2026-10-08 / v0.40.0。[P2](../plan/IMPLEMENTATION_PLAN.md)の基本記事を[ヘルプ仕様](../plan/HELP_SUPPORT_SPEC.md)から実装する。[判断16件](../decisions/workspace-help.md)、[検証](../../tests/evidence/workspace-help-20261008/SUMMARY.md)。通常PoC rootとserver/native schemaは変更しない。

## 提供する範囲

workspace previewの「ヘルプ・アプリ情報」から、はじめに、Page情報、タイトル、Task/Relation、端末保存と同期、保存エラー・結果不明、接続/認証、競合、キーボード/タッチの9記事を読める。固定ID、日本語locale、revision、カテゴリ、alias、desktop/touch、preview availabilityと関連記事を同梱する。未提供機能、復元や問い合わせの入口を創作しない。Calendar案内、初回学習設定、診断export/送信、本番FAQ全体は後続で、全HELP受入の完了とはしない。

タイトル/alias/要約/本文だけを端末内で検索する。NFKCと小文字で照合し、全検索語一致、カテゴリ絞り込み、安定順位、120文字/8語の上限を持つ。利用者のPage、Task、メール、パスワード、store、APIを検索元にしない。0件でも検索語と記事表示を保持し、クリア/カテゴリ選択を提供する。Enterで先頭記事を自動選択しない。同梱moduleは画面とともに読み込まれ、未ログイン・画面読込後のofflineでも利用できる。

版はclient manifestからVite build時に取り込む。サーバーの版や過去artifactの版を同じものとして扱わない。記事閲覧は保存、再送、設定変更、ログ送信を実行しない。

## 作業へ戻る動作

native dialogを使い、背景の操作をinertにしてkeyboard focusを閉じ込める。desktopは2列、360pxは1列、記事一覧を有界scrollにし、context/記事選択後は本文見出しへfocusする。中立色と44px以上の入力/ボタンを使う。開いたままeditor/title/Taskをremountしない。

pointerdownで元の入力focus、input選択範囲/方向またはDOM Range、window scrollを捕捉する。keyboard起動はlauncherへ戻す。閉じた後、接続中の元nodeへfocus/選択/scrollを復帰し、切替でnodeがなくなった場合はlauncherへ戻す。editor commandやsyncを呼ばない。dirty draftと保存結果不明でも記事を読めるが、変換中は入口を無効にする。検索変換中は記事選択/閉じる/Escapeを保留し、Enterを送信・選択に使わない。

Page情報、タイトル、Task/Relation、保存・同期、競合、端末保存失敗の説明をcontextから開く。workspace接続エラーはstorageとconnectionに分ける。結果不明の説明には同じ保存の再確認を案内し、記事表示のためにretry ID、wire、pending、copyable draftを変えない。

## 証拠の境界

content/search契約4件とDocker browserの新6条件×desktop/mobileを検証する。offlineでHTTP requestなし、未保存フォーム/選択/focus、本文node/DOM Rangeと未送信記録、composition Enter/Escape、unknown title commitのexact retry、metadata完了とbody pendingの分離を確認する。実MS IMEの候補・再変換、host Tauri invoke、実Auth/Androidは別条件として残す。
