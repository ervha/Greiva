# Step 8：証拠監査と実機再開の準備

2026-10-03、担当Codex。検証準備checkpoint v0.6.10、製品baselineと候補は0.6.9。参照セッション `01a0f17f-74f8-71e1-9c31-65689f9c11da` の直近の利用者判断を読み、今回の再開指示に従って手操作に依存しない検証準備を進めた。

## 今回実行した検証

- Docker image `greiva-poc-development:step-7-client` の既存Nodeを再利用。専用container、networkなし、コピーしたソース／証拠、host toolchain追加なし。
- Node監査試験9件Pass。原Playwright集計だけ成功でも個々のFail／skip／retry／重複／runner errorを拒否。Vitestの欠落・重複、実ソース変更／追加、未実行のDBケース、feature再検査のFail／crash機能混入、誤ったartifact、元log欠落を検出。
- 保存済みの原0.6.9証拠に対する監査Pass。アプリのunit/E2E／性能を今回再実行した結果ではない。[監査結果](audit.json)・[試験log](unit.log)・[監査log](audit.log)。
- 0.6.9候補exeを親checkoutから専用作業場所へコピーし、原buildと同じhash／bytesを確認。起動・native操作・Microsoft IMEはNot run。
- [Windows環境](windows-environment.json)を読み取りだけで収集。インストール済みWebView2／IME部品の版であり、次のアプリが読み込むruntime・有効なIME設定の確認ではない。OS設定・更新・入力方式は変更していない。

原Docker証拠はfull 54 E2E、focused 9 E2E、Conflict UI2、crash4境界、性能4ケース。通常Vitest45 Pass／20 skipの20件が実PostgreSQL別run20 Passのcase名に一致した。原12検査の11 Pass／1 Failと、cache取得後の別offline feature再検査Passを別々に保持する。

## ソース差と初回検査

このworktreeの初回照合は132件中6件byte一致、126件はCRLF→LFだけの差、その他の内容差なし。新しい監査ツールはbaseline inventory外として別記。v0.6.10では文書checkpointの`VERSION`変更も明示する。原Dockerと同じbyte hashであるとは主張しない。

監査ツールの初回実行はHTML／CSSをtext拡張子一覧へ含めていなかったため、2ファイルの改行差を内容差として拒否した。text判定へ追加し、binary／BOMを正規化しない試験を維持した。これは監査ツールの分類不備で、製品不備や新しいnative試験のFailではない。[初回記録](first-attempt.json)。元のアプリソースを変更して対応していない。

## 残る作業

[受入条件対応表・再開順序](../../../docs/plan/POC_VALIDATION_MATRIX.md)へ8条件とGateの不足を対応付けた。Microsoft再変換の本文保持Fail、最新Windows全操作・統合crash・大量データ性能、Android／macOS／iOS実OS、Gate A/B/C最終判定は未完了。Pixel 7／Android 17 QPR1は今回の利用者申告であり、実OS確認・Chrome版・接続経路は未確認。

`evidenceIntegrity: Pass` と `readyForFinalGate: false` は両立する。監査成功でPoC合格・本文欠落解消・native操作Passにはしない。製品manifest／lockfile／候補は0.6.9のまま、文書・検証環境のPATCHだけを記録する。
