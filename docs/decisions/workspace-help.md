# 同梱ヘルプの実装判断

2026-10-08 / v0.40.0。P2と継続開発の委任に基づく自主判断。利用者回答を追加で得た決定とはしない。[実装](../development/WORKSPACE_HELP.md)、[証拠](../../tests/evidence/workspace-help-20261008/SUMMARY.md)。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | workspace previewへ同梱 | 既存P2基本記事を進め、通常入口の昇格は別 |
| 2 | 9記事で開始 | 現在提供している操作だけを案内 |
| 3 | 固定ID/カテゴリ/locale/revision | 関連参照と後の差替を安定させる |
| 4 | desktop/touchとpreview availability | 本番/全platform対応を主張しない |
| 5 | bundled moduleのみ検索 | 利用者情報/API/storeに検索portを持たない |
| 6 | NFKC/全語一致/安定順位 | 日本語alias/全角英数字から到達する |
| 7 | 120文字/8語上限 | UIと検索処理を有界にする |
| 8 | 0件でquery/articleを保持 | 再入力とカテゴリからの回復を可能にする |
| 9 | manifestから版を注入 | 版の手入力ずれを避け、artifactの実版を保つ |
| 10 | native modal dialog | background inert/keyboard focusと可逆の閉じる操作 |
| 11 | pointer前のorigin捕捉 | clickで失われるinput/DOM Rangeを復帰 |
| 12 | 元node不在時はlauncher | アカウント取消後の旧nodeへ復帰しない |
| 13 | dirty/errorでも閲覧可能 | copyable draft/exact retryを残して案内を読む |
| 14 | composition中の入口/Enter/Escape保留 | modalで変換を中断せずsynthetic検証を分離 |
| 15 | context記事は操作を実行しない | 再送/消去/ログ送信を自動化しない |
| 16 | HELP全体の完成とはしない | Calendar/初回学習/診断とnative受入を後続へ保持 |
