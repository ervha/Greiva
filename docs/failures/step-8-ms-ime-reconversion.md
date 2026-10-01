# Step 8: Microsoft IME再変換で直前の文字が欠落

2026-10-01の観測、2026-10-02に解釈を補足。状態: **期待本文との比較はFail、欠落の原因・アプリ不具合への帰属は未確定**。[POC_SPEC.md §1.3](../plan/POC_SPEC.md)に従い、観測できた一回の手順と影響を記録する。Step 9の最終Gate判定は行わない。

利用者は「再変換のキー操作時に誤って消した可能性」を指摘した。元の記録では、欠落は候補確定前、物理変換キーによる開始後の最初の観測（UTC14:10:20.853）ですでに存在する。「確定時にアプリが消した」とは断定できない。手操作の入力キーを記録していないため、誤操作を除外できず、候補選択・Return確定だけを原因にしない。元のraw証拠は変更せず保持する。

## 前提・環境・発生日時

Windows 11 Home build 26300、Tauri debug 0.6.5、Microsoft IME（切替は利用者申告、native候補UIを観察）。DockerのAPI／Hocuspocusは0.6.5。検証commit `c6b1c8bde39996cd7b5bcbca5f737b6106789680`、130ファイルsource SHA-256 `c0f39a8a19274ef4150c4c770189fce4b927e21befb9c542bb24402975846205`。native exe SHA-256 `b3f09fbaad951d76f657550bdeec017cca474fd939fdc701700d2e8cfe655863`。[環境・原記録・build](../../tests/evidence/step-8-platform-validation-20261001/SUMMARY.md)。

Page `01a0f723-8015-71d9-9445-0579cfef41a3` の末尾段落を使用。事前に同じ段落へ遠隔6更新を受信し、通常変換を確定した。再変換の操作間には追加の遠隔送信をしていない。遠隔更新の履歴が発生に必要かは未確認。再変換開始の観測UTC14:10:20.853、確定後の観測UTC14:11:14.078、Fail訂正UTC14:12:13.560（JST23時台）。

## 最小の観測手順

1. literal接頭辞 `MS65 local ` を段落へ準備し、日本語modeで実キー `n i h o n g o` を入力する。
2. 独立providerから同じ段落の先頭に `[ms65-1]`〜`[ms65-3]` を順に挿入。Spaceで変換、さらにSpaceで候補一覧を開く。
3. `[ms65-4]`〜`[ms65-6]` を同じ先頭へ挿入。候補一覧が隠れるが下線付きpreeditは残る。Upで候補一覧を再表示し、Returnで日本語を確定する。
4. 末尾からCtrl+Shift+Leftで「日本語」を選択する。実画像で選択範囲を確認する。
5. 利用者が物理「変換」キーを押して再変換を開始したと回答。開始後の最初の観測ですでに `al ` が欠落していた。Codexが候補UIを観察し、Downでひらがな候補、Upで日本語候補へ戻し、Returnで確定する。手操作の実キー列は未記録。
6. fresh native画像／UIA、独立read-only peer、通常終了後にコピーしたSQLite／WAL／SHMの実Rust PageStore監査で本文を比較する。

これは2026-10-01に観測した失敗系列の手順であり、条件を削った最小再現を確認したものではない。別fixtureでの再確認は後述する。literal `ni` になった最初の入力は除去してmodeを切り替え、IME trialに数えていない。再変換開始だけは操作APIが変換キーを扱えず手操作を依頼した。

## 期待結果・実結果・影響

期待値:

```text
[ms65-6][ms65-5][ms65-4][ms65-3][ms65-2][ms65-1]MS65 local 日本語
```

実結果:

```text
[ms65-6][ms65-5][ms65-4][ms65-3][ms65-2][ms65-1]MS65 loc日本語
```

選択範囲の直前の `al ` が欠落。遠隔6接頭辞と他のblockは保持されたが、この編集は本文保持の受入条件を満たさない。[再変換前の選択](../../tests/evidence/step-8-platform-validation-20261001/microsoft/selected-for-reconvert.png)、[確定後](../../tests/evidence/step-8-platform-validation-20261001/microsoft/reconvert-committed.png)。

[peer比較](../../tests/evidence/step-8-platform-validation-20261001/microsoft/peer-after-reconvert.json)の期待全XML一致はfalse。[SQLiteコピー監査](../../tests/evidence/step-8-platform-validation-20261001/microsoft/sqlite-audit.json)でも欠落を確認した。98 updates／2,821 bytes、実際の欠落後の本文と5 client clockがpeerと一致。**非収束ではなく、誤った編集結果が保存・同期されたデータ損失**である。保存済み／同期済み表示を正しい編集内容の証明にはしない。強制終了はこの系列では行っていない。

## 確認済みと未確認

確認済み: 選択と再変換UIを画像で確認し、確定後の欠落をfresh native観測・peer・保存データの3経路で確認した。単なるUIA遅延ではない。raw actionの意図を表す成功風の記述は後続訂正レコードで修正し、元の記録を保持した。

原因候補: 開始時の手操作の誤り、WebView2／TSFの再変換対象範囲、ProseMirror／Yjsのselectionとcomposition処理の連携。どれも原因としては未確認。候補一覧の非表示・位置の観察だけで原因を結び付けない。plain contenteditable、同期なしのProseMirror、Yjsありの各比較、native event／selection traceは未実施。2026-10-02の再確認は別の証拠として記録し、一回の成功を元の欠落の原因証明へ拡張しない。

## 影響と次の切り分け

2026-10-02 JSTの[再確認と順序再生](../../tests/evidence/step-8-ime-recheck-20261002/SUMMARY.md)を追加した。遠隔更新なしの新規Pageでは、Googleで初期入力した日本語をMicrosoftで再変換し、Down→Up→Return後も期待本文を保持した。別の1段落Pageでは実Microsoft入力中に同一段落への6遠隔更新を受け、正常確定・日本語3文字だけの選択まで観察した。その後、利用者は「変換キーだけを一度押した」と回答し、保存データとfresh peerには再び同じ `al ` 欠落が存在した。二回目は再変換開始後のnative画像・候補確定の完走記録がなく、アプリの終了理由も未観測。crash recoveryの計画試験とは扱わない。

今回の20 updatesの順序再生では、update 19が直前の `al ` と日本語3文字を削除し、update 20が日本語だけを再挿入した。前回の98 updatesでもupdate 95が同じ本文変化を示す。削除更新の特定まで進んだが、journalには入力event／DOM target range／物理キーの情報がなく、原因層は未確定。初期入力IME・文書構成が異なる二条件から、遠隔更新の必要性を断定しない。一回の遠隔なし成功で元の失敗を解消扱いにしない。

Gate Aのnative IME／本文保持の証拠に影響し、この系列はPassにできない。今回の保存・収束一致をGate B／C全体の合格に拡張しない。最終Gate判定・基盤選定はStep 9として留保する。

再開時は、初期入力IMEを揃えた複数回比較、native event／selection／target range traceとplain contenteditable→ProseMirror→Yjsの比較で発生層を絞る。明白な小規模不備が判明したら修正と同系列の回帰を行う。基盤変更が必要な場合は証拠付き判断を提示する。現時点では修正・大規模回避・要件緩和を行わず、[利用者指定の停止境界](../decisions/step-8-validation-boundary.md)で停止する。
