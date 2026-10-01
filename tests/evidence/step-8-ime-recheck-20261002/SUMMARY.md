# Step 8: Microsoft IME再変換の再確認

2026-10-02 JST、文書チェックポイントv0.6.7、実行物／Dockerは0.6.5。**遠隔6更新後の別fixtureでも、選択した「日本語」の直前の `al ` の欠落を保存データとfresh peerで確認した。未修正、発生層は未特定。** 遠隔更新なしの一回は本文を保持した。今回の二条件は初期入力のIMEも異なるため、差だけで遠隔更新を原因と断定しない。

## 環境と証拠の範囲

[起動](launch.json): 新しいSQLite／WebView保存先を使った既存debug Tauri 0.6.5、exe SHA-256 `b3f09fbaad951d76f657550bdeec017cca474fd939fdc701700d2e8cfe655863`。通常production frontendを埋め込んだ、試験frontend flags無効の候補を再利用し、ホストtoolchainは追加していない。[元のbuild](../step-8-todo-layout-20261001/windows-build-0.6.5/build.json)・[ソース識別](../step-8-platform-validation-20261001/tested-source.json)。製品ソースはcommit `c6b1c8bde39996cd7b5bcbca5f737b6106789680`、130ソースSHA-256 `c0f39a8a19274ef4150c4c770189fce4b927e21befb9c542bb24402975846205`。再確認終了時もDocker内で同じhashを照合した。起動時のHEADは文書v0.6.6の `00c3d4d4412777842729e5f5e3a8c8363b57226b`。

Windows実キー操作・UIA／画像と、Dockerの独立Hocuspocus provider・実Rust PageStore監査を分けて使用。接頭辞のliteral入力を日本語IME試験に数えない。Microsoftへの切替と物理変換キーによる開始は利用者、他の入力・候補選択・確定はCodexが実施。[操作原記録](operations.json)は観測レコードであり、すべての物理キーを記録したtelemetryではない。UIAの入力直後の遅延を画像で補った。操作runtimeの更新・reset後、Greivaのprocess／windowがなくなっていた。終了操作やexit codeは観測しておらず、異常終了の断定も、計画したcrash試験の成功扱いもしない。

## 今回の二系列

| 系列 | 観測・結果 | 限界と証拠 |
| --- | --- | --- |
| 遠隔更新なし、接続一時停止中のMicrosoft再変換 | `MS65 local 日本語` から日本語3文字を選択し、利用者の変換キー、Down→Up→Returnで確定。接頭辞を保持。再接続後のfresh peer、後のSQLite監査も期待全XMLに一致 | 最初の日本語入力はGoogle。Microsoft通常入力＋再変換全体のPassではない。[開始候補](offline-reconversion-start.png)・[確定](offline-reconversion-commit.png)・[peer](offline-peer.json) |
| 実Microsoft入力、preedit／候補中の同一段落への6遠隔更新 | 3更新ずつ受信、今回の第2段階では候補一覧も継続表示。Up→Returnで正常確定、`local ` を保持して日本語3文字だけを選択 | [送信／ACK](remote-events.json)・[候補中の第2段階](remote-phase-two.png)・[再変換前の選択](remote-selected-for-reconvert.png)。通常確定UTC15:32:13.125、選択15:32:26.541（JST10月2日00時台） |
| 同じ6更新後の再変換開始と保存結果 | 利用者は「変換キーだけを一度押した」と回答。その後のSQLite／fresh peerには `MS65 loc日本語`。期待全XML比較は両方false | **本文保持Fail**。二回目の開始後のnative候補画像、Down／Up／Returnの完走記録はない。終了理由は不明。保存結果の確認を、native再変換完走の証拠に読み替えない |

遠隔なしのPageは `01a0f808-b90b-775f-9bd2-24f83b2f40af`、遠隔ありのPageは `01a0f813-c52c-71a6-a885-c030269b0788`。どちらも新規の1段落fixture。前回は複数blockを含む既存Pageであり、完全に同一の条件ではない。第2系列の期待値と保存結果:

```text
期待: [ms65-6][ms65-5][ms65-4][ms65-3][ms65-2][ms65-1]MS65 local 日本語
実際: [ms65-6][ms65-5][ms65-4][ms65-3][ms65-2][ms65-1]MS65 loc日本語
```

## 更新単位での切り分け

process不在の確認後にSQLite／WAL／SHMをコピーし、byte hashを確認してからDockerのコピーだけを実Rust PageStoreで読む。[コピー記録](interruption-backup.json)・[監査](interruption-audit.json)。遠隔なしは16 updates／442 bytesで期待全XML一致。遠隔ありは20 updates／531 bytesで欠落し、端末とpeerの実XML・全3 client clockが一致する。**表示だけの問題でも非収束でもなく、欠落した内容が保存・同期されている。** 既存の前回失敗DBと今回の原DBは変更していない。

[今回の順序再生](current-ordered-replay.json): update 18は正常な通常確定。update 19（12 bytes、structs 0）が `al ` と「日本語」の計6文字を削除し、update 20が「日本語」3文字だけを再挿入する。遠隔6接頭辞は保持される。[前回の順序再生](original-ordered-replay.json)もupdate 95（14 bytes）で同じ本文変化を示す。journalの順序と削除範囲は分かるが、DOM target range、trusted key、composition event、各更新の発生時刻は記録されていない。どの入力層が削除範囲を作ったかは確定できない。

前回の原画像・原操作を読み直すと、欠落は候補確定前、利用者の再変換開始後の最初の観測UTC14:10:20.853ですでに存在する。前回は手操作の誤りを除外できず、「Return確定が原因」とはしない。今回の利用者回答は変換キーのみだが、物理キーtelemetryの代用にはならない。今回の候補一覧保持成功も、前回の一覧非表示を解消済みとはしない。

## 再現補助と未実施

[監査スクリプト](reproduce/recheck-audit.mjs)・[今回の順序再生](reproduce/recheck-current-journal.mjs)・[前回の順序再生](reproduce/recheck-journal.mjs)・[6更新sender](reproduce/recheck-remote.mjs)は実行した補助コードを保持する。既存Dockerの依存と `.data/native-target/debug/examples/store-driver`、隔離SQLiteコピーを前提にする。current replayの引数はDBコピー、監査JSON、出力JSONの順。DB実体はGitへ含めない。senderのPage IDは今回のfixture固定なので、再試験では新しいPageへ置き換え、二つのsignalも新規にする。[senderの終了時snapshot](remote-sender-final.json)は再変換前の状態であり、最終本文の証拠ではない。

[原ファイルhash](raw-files.json)はコピー元との一致を確認した選択証拠。画像を加工せず、Googleの学習予測が写る画像は選択しない。操作JSON中の画像名は元の保存名を保持し、選択して公開した画像との対応はhash一覧のsource／fileで示す。それ以外の画像はローカルのみ。[checkpoint検証](checkpoint-verification.json)はhash、JSON整合、リンク、製品ソース非変更を確認する。製品変更なしのためDocker全E2Eや新規buildは再実行していない。

次は同じ初期IMEを使う複数回比較と、readonlyのnative event／DOM selection／ProseMirror selection／target range記録、plain contenteditable→ProseMirror→Yjsの比較で発生層を絞る。これらは未実施。根拠のある小規模修正はまだ特定できず、製品修正・同期抑制・要件緩和は行っていない。[失敗記録](../../../docs/failures/step-8-ms-ime-reconversion.md)・[停止境界](../../../docs/decisions/step-8-validation-boundary.md)。利用者指定の検証記録の区切りで停止し、Step 9へ進まない。Step 8全native組合せ、統合crash、性能、P1／P2実OS、最終Gateは引き続き未完了。
