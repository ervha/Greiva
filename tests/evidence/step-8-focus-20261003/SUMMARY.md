# Step 8: 遠隔編集後の選択保持と再接続の回帰

2026-10-03、担当Codex。修正候補・開発checkpointは0.6.9。親commit `5364ae9e85565b205a9544259198bd439fd921b0`。[不備と限定修正](../../../docs/failures/step-8-remote-selection.md)、[手操作待ち・複数の対策案](../../../docs/plan/DEFERRED_VALIDATION.md)。利用者の最新指示に従い、この検証・Windows候補準備・commit/tag/pushまでで停止する。

## 修正前の再現

通常0.6.5構成の見出し2／Toggle summaryで、日本語3文字を選択してタイトルへfocusを移す。独立clientの先頭3挿入後、本文へ戻ると古いoffset 11〜14が `65 ` を選んだ。前後両方向の4ケースで再現。[初回9ケースの原結果](before/playwright.json)、[JUnit](before/playwright.xml)、[当時の試験source](before/test-source.txt)。

初回は3 Pass／6 Fail。うちTodoの2 Failは非表示のcheckbox説明を文字数へ含めた測定不備。測定をeditable block内へ限定した[診断3ケース](diagnostic/playwright.json)はTodo Pass／見出し・Toggle Failだった。遠隔更新後・focus復帰前からPM offsetが11のままであることをread-only snapshotで確認し、DOM表示の問題だけではないと分けた。[見出しtrace](diagnostic/heading-forward-trace.zip)、[Toggle trace](diagnostic/toggle-forward-trace.zip)。

固定版y-tiptapの構造変更用fallbackが、文字編集のみの場合にも旧絶対位置を選ぶ経路を確認。新しいextensionは文書構造が同じ遠隔文字編集だけYjs相対bookmarkを使い、本文の復元・focus強制・composition取消・同期停止を行わない。構造変更とlocal Undo/Redoは既存bindingへ任せる。

## 修正後の検証

| 確認 | 結果・証拠 |
| --- | --- |
| 新しい9ケースの独立run | 9 Pass、skip/flakyなし。[JSON](focused/playwright.json)、[JUnit](focused/playwright.xml) |
| 全Editor／保存／同期E2E | 54 Pass、skip/flakyなし。[JSON](full/playwright.json)、[JUnit](full/playwright.xml) |
| 通常unit/integration | 45 Pass、実DB専用20 skip。skip分は下記の別runで検証。[JSON](full/vitest.json)、[log](full/STEP8-UNIT-INTEGRATION.log) |
| 実PostgreSQL別run | 20 Pass、skipなし。[JSON](full/postgres/vitest.json)、[log](full/STEP8-POSTGRES.log) |
| Conflict UI | 2 Pass。[JSON](full/structured-e2e/playwright.json)、[log](full/STEP8-STRUCTURED-E2E.log) |
| 統合crashと復元 | 4境界Pass。[JSON](full/combined-crash/playwright.json)、[log](full/STEP8-COMBINED-CRASH.log)。実API SIGKILLの2ケースは上記PostgreSQL別runでPass |
| 性能workload | 4 Pass。[JSON](full/performance/playwright.json)、[log](full/STEP8-PERFORMANCE.log)、[測定値抽出](performance-metrics.json) |
| Build／型／store build／SQLite／locked Tauri check | Pass。[原runの条件と各log](full/summary.json) |
| 通常の試験用機能検査 | 初回offline cache不足Failを保持。[原log](full/STEP8-DEFAULT-FEATURES.log)。Dockerでlocked依存取得後、同じoffline検査Pass。[再検査条件](feature-cache-recheck.json)、[log](feature-cache-recheck.log) |

原full runの12項目は11 Pass／1 Failで、Failは未cacheの `android_system_properties 0.1.6` をofflineで取得できなかったことによる。原JSONを書き換えず保持する。依存取得後はroot／store 0.6.9、store featuresは `default` のみ、crash barrier無効を確認した。初回Failを隠してfull run自体を全Passとして報告しない。

新しい選択8ケースは段落・見出し2・Todo・Toggle summary×前後方向。blur中の3回先頭挿入と1回削除、復帰後の日本語3文字・方向・6文字の位置移動、選択置換とlocal Undo/Redo、両clientの全文・構造・clock・pending一致を確認する。残る1ケースは4回のoffline編集／交互再接続でmarkerが一件ずつ残り、fresh clientへ完全復元することを確認する。

修正確認途中に接続5秒待ち、focus直後snapshot、peer Home直後の未確認選択による試験上の失敗もあった。既存試験と同じ15秒接続待ち、PM offsetの確認、clock収束後のDOM両端の待機へ修正した。これらの未選別runはローカルの `tests/evidence/runs/container/step8-focus-fix*` に保持し、新しい受入条件の緩和や製品不備の解消根拠とはしない。

## Docker性能観測

- 1,000 block復元3回: 743.67／871.39／1,773.38ms。全1,001 journal update、本文・clock、104文字の入力と保存後一致、1,000 drag handle保持を確認。
- keydown→commit ACK: p95 356.7ms、最大400.2ms。keydown→次のframe機会: p95 77.7ms、最大96.8ms。以前の別runより保存応答が遅く、原因は未確定。修正有無を同条件で比較した結果ではない。
- 100回Yjs編集: 再接続後1,104.61msで全文・clock一致。
- 1,000 Task操作: queue作成13,018.36ms、offline復元262.18ms、実React engineの同期96,515.04ms。台帳1,000件・distinct 1,000件・head/cursor一致。

Docker内のproduction frontend／release Rust／実SQLite・PostgreSQLの観測であり、Windows release起動・実機IME・製品SLOへ拡張しない。端末と条件は[環境](full/performance/environment.json)に記録する。

## ソースとWindows候補

132ファイルのsource SHA-256: `22a3f1f4496b283a876f52b3a9d50e67c98c443d00031e06c36b737ad92e219c`。[inventory](full/source-files.json)、[host／Docker一致とlock監査](source-verification.json)。アプリ所有manifest／lockだけ0.6.9へ揃え、npm外部entryとCargo registry crateの版／checksumを変更していない。

[Windows build条件・hash](windows-build/build.json)、[host artifact照合](windows-build/host-artifact.json)。Dockerのlocked/offline cross-buildで通常production frontendを埋め込んだdebug候補を作成。test hook／test bridge無効、storeのcrash-test-hooksなし。ProductVersion 0.6.9、18,558,464 bytes、SHA-256 `65edd5c8f629f3acfc7ba3b8ff381938f6bd27a0712532af5726782194d14aca`。project内に保存し、起動していない。既存0.6.5候補・失敗fixtureを保持し、host toolchainを追加していない。

新しいWindows候補のnative操作・Microsoft IMEは **Not run**。Dockerのfixture日本語はliteral入力であり、実際の変換・再変換の代用ではない。[先日のIME対象範囲拡大](../step-8-ime-focus-20261002/SUMMARY.md)は未解決。利用者はWindows PCとAndroidを利用可能と回答したが、Android Chromeの実OS検証は未実施、機種・OS版・接続方法も未確認。Step 8全受入条件、Gate A/B/C最終判定、基盤選定は未完了。
