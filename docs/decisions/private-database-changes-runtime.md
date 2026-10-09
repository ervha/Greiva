# DB差分画面用runtimeの判断

2026-10-09 / v0.58.0。[契約](../development/PRIVATE_DATABASE_CHANGES_RUNTIME.md)、[証拠](../../tests/evidence/private-database-changes-runtime-20261009/SUMMARY.md)。既存delta sessionの画面compositionに関する自主判断。

| # | 判断 | 理由・境界 |
| --- | --- | --- |
| 1 | server11/native12保持 | runtimeのみ追加 |
| 2 | captured connection/store/Source | 旧対象の遅着操作を転送しない |
| 3 | opening/reloadはlocalのみ | offline表示と通信開始を分ける |
| 4 | unknown/corrupt progressは拒否 | 空の成功へfallbackしない |
| 5 | syncは明示max100の1window | 有界操作と次windowを保つ |
| 6 | 背景loop/poll/retryを追加しない | 手動取得のlifetimeを明確にする |
| 7 | busy/error/data/retryを区別 | unknownを取得成功と扱わない |
| 8 | observedHeadは取得位置の観測 | 全DB同期/Page送信ACKと分離 |
| 9 | local reloadで観測完了にしない | 保存位置と現在server headを区別 |
| 10 | unknown後local reloadでもpair保持 | COMMIT読取で結果確認を省略しない |
| 11 | retryは最新progressを返す | 古い応答cursorを現在と扱わない |
| 12 | 共有native storeを所有しない | Page/Taskの保存を継続 |
| 13 | closeはprivate状態除去/終了待ち | late resultを表示しない |
| 14 | observer例外/再入closeを隔離 | 新通信・close再帰を防ぐ |
| 15 | portable11＋signed HTTP-native PG2 | actual100window/増えたhead/offline/unknown/取消 |
| 16 | 作成更新queue/Table/Listへ続行 | runtimeを画面完成/native Gateへ昇格しない |
