# Page情報受信画面の全判断

2026-10-08 / v0.39.0。継続開発の委任に基づく自主判断。公開/実Auth/native grantの許可を追加しない。

1. 認証付き増分runtimeの確認済みcommit後に個人workspace previewへ接続する。
2. server5/native8・本文/structured wireと通常root入口を維持する。
3. local open/reconnectでcacheを読むだけとし、network取得を明示操作へ限定する。
4. catalogを本文保存済み一覧・server queryと分け、100件window/先頭/続頁を表示する。
5. actual native hasPageで本文有無を照合し、bounded local一覧の欠落から推測しない。
6. 本文未取得Pageを開く時は既存認証付きbody経路を通す。
7. 以前の取得結果/観測head末尾/続頁/error/unknown保存と本文/title pendingを分ける。
8. unknown receiptは以前の一覧を保持し、新pullを止めexact再確認を提供する。
9. Auth失効/closeでprivate表示を消し、DB/入力/未送信変更は保持する。
10. 受信で本文editorをremountせず、binary/selection/focusを変更しない。
11. dirty/composition中のactive title refreshを保留し、入力終了後のlocal refreshと明示再確認を用意する。
12. canonical cacheとpendingを含むlocal投影を区別し、received値で入力を上書きしない。
13. remote resolutionをactionable候補へ反映し、intent/拒否履歴を消さない。
14. controller/desktop/mobile実操作、型/全回帰/buildと画面を検証する。共通package再buildがViteをreloadするため、build/type/通常検証の完了後にbrowser試験を順番に実行する。
15. browser fixture/Docker/native署名fixtureを実Auth/Windows IME/配備暗号化へ広げず、元失敗があれば保持する。
16. owned版/外部依存/source/証拠・リンクを確認してcommit/tag/push後も、accepted P2の独立工程へ続ける。

[契約](../development/PRIVATE_PAGE_CHANGES_SCREEN.md)、[証拠](../../tests/evidence/private-page-changes-screen-20261008/SUMMARY.md)、[判断索引](../plan/AUTONOMOUS_DECISIONS.md)。
