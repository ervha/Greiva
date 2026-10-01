# Windows実機: 遠隔更新中のMicrosoft IME

2026-10-01 10:47–10:49 JST。検証対象はGit `4b8469a`のDocker frontend **0.2.0**と既存Windows Tauri debug shell **0.0.0**。証拠チェックポイント**v0.2.1**は新規アプリビルドではない。

利用者がnative本文と同期表示を確認し、開始を指定した。Docker内の独立Hocuspocus providerから20秒遅延後、約5秒間隔で12回のYjs更新を送信。前半6回は追加段落、後半6回は先頭段落へ追記した。composition中も受信を停止しない。利用者がMicrosoft IMEを操作し、Codexはfocusを変えず観察だけ行った。

| 確認 | 結果・根拠 |
| --- | --- |
| 更新送信・受領 | 12/12、01:47:45.748Z–01:48:41.360Z。[peerログ](peer-events.json) |
| 実機IME候補と受信文字 | Codex独立観察。日本語「あああ」の候補と別段落の全6個の遠隔文字が同時表示。[画面](01-during-updates.jpg)・[時刻](01-during-updates.json) |
| 先頭段落の更新・継続操作 | Codex独立観察。遠隔7–11の文字、nativeの見出し・Slash候補を表示。[画面](02-during-updates.jpg)・[時刻](02-during-updates.json) |
| 変換・候補選択・確定・再変換、確定後の選択・Undo/Redo | 利用者が「試した操作はすべて正常で、自分の文字と遠隔の文字が保持された」と回答。手動Pass。[質問・回答と限界](manual-results.json) |
| 本文 | peerの最終状態に遠隔12回分と利用者の本文・見出し・Codeが存在。[state vector・XML](peer-final-state.json)。nativeとのvector比較とは扱わない |

Undo/Redoはこの編集セッションのlocal操作を対象にし、remoteの文字は取り消さない。

## 再現

default Pageで試験用本文を開き、利用者が操作できることを確認してから実行する。実際に本文へ文字を追加するため、通常ノートで無断実行しない。

```powershell
docker cp tests/manual/remote-ime-peer.mjs greiva-isolated-dev-1:/workspace/.data/remote-ime-peer.mjs
docker exec greiva-isolated-dev-1 node /workspace/.data/remote-ime-peer.mjs
```

native本文にfocusを残し、実キー入力でMicrosoft IMEを操作する。脚本はDocker内の`.data/host-ime/remote-<UTC>/`へログを保存する。Unicode直接入力・合成compositionで代替しない。操作後に利用者の結果を別記録する。[実施した脚本](../../manual/remote-ime-peer.mjs)。

## 対応と限界

native exe SHA-256を再確認: `1F397C61588B42F26CAA05EF7F23BA4C435CDF140F35536D70F299C8138D410C`。Docker imageは`sha256:1b18f67bc1e89fa7134fc40cc48b780ff7b1ccbfd24389425ca2ba5b4d829cf7`、user=node、privileged=false、no-new-privileges。[既存のソース照合・自動試験](../step-4-collaboration-20261001/SUMMARY.md)。アプリソース・依存・実行物は変更していない。

再変換・Undo/Redoのキー列や全過程の録画はない。候補画面の入力段落と遠隔更新段落は異なり、同一Paragraph内のcompositionと更新の重なりは確立していない。利用者の手動Passをnative全件・Gate A/B/C最終Passへ拡張しない。残る全ブロックの証拠と同一段落のcontrolled確認は最終Gateに向けて補強する。端末SQLite保存・offline強制終了復旧はStep 5。

試験後の追加captureは別ウィンドウに覆われていたため採用しなかった。選別した2枚だけを保存。脚本構文、12回の送信/ACK対応、JSON、リンク、差分、PoC仕様不変を確認。アプリ自動試験は今回再実行していない。
