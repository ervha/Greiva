# 2026-10-13 開発停止checkpoint — v0.81.0

利用者の「キリのいいところまで進めて止めて」に従い、検証済みv0.81.0で一旦停止する。次のnative provider実装や追加テスト周期には入らない。

## 今回進んだ範囲

| 版 | 完了した実装 | 証拠 |
| --- | --- | --- |
| v0.76–0.77 | 暗号化backup、別DBへの復元リハーサル、平文fileなしの検査と鍵更新 | [backup](../../tests/evidence/private-backup-20261013/SUMMARY.md)、[rotation](../../tests/evidence/private-backup-rotation-20261013/SUMMARY.md) |
| v0.78 | Windows OS資格情報保管、SQLite世代marker、永続logout lockと遅着拒否 | [credential](../../tests/evidence/native-credential-20261013/SUMMARY.md) |
| v0.79 | 認証・workspace/device認可に基づく7日固定grant発行とnative署名検証 | [grant](../../tests/evidence/native-offline-grant-20261013/SUMMARY.md) |
| v0.80 | OSへのgrant/確認時刻保管、local保存操作の期限検査、logout後のlockとpending保持 | [lease](../../tests/evidence/native-offline-lease-20261013/SUMMARY.md) |
| v0.81 | 通常API起動への明示署名設定、秘密鍵file/鍵ペアの検査、未設定時の発行無効化 | [startup](../../tests/evidence/private-offline-startup-20261013/SUMMARY.md) |

基本DBは既存のName/Text/Number/Checkbox/Select/DateとTable/List、行・View編集/競合解決、同梱ヘルプまで進んでいる。今回の資格情報とoffline処理はnativeライブラリ・API基盤の段階で、通常アプリの自動ログイン復元や7日間offline利用の画面接続まで完了したものではない。

## 検証済みの範囲

v0.81はDocker全unit487、全PG229（37 files）、対象4、型/server/frontend/通常Windows buildがPass。0.81.0 Windows実行物の版とSHAをhostで照合したがGUIは未起動。

v0.80ではRust12とWindows別3プロセスによる架空grant保存・pending復元・logout後lock、v0.78ではWindows架空credentialの保存/読取/置換/削除とDocker実SIGKILL7を確認した。各版の証拠を保持し、今回の再実行として集計しない。実Supabase正常ログイン、Tauri画面/実IPCとMicrosoft IME、Androidの合格証拠にはしない。

## 再開時の順序

1. native provider通信、署名sessionのowner確認、refresh/資格情報置換、logout全体のlifecycleを接続する。秘密情報をUIへ返さない契約と永続lockを維持する。
2. Tauri commandと起動時復元、offline/期限/既知失効の表示を接続する。期限・logout時に表示とhandleを閉じ、draftと確定済みpendingを保持する。
3. 配備用秘密鍵の供給とnative公開鍵pin、鍵更新の手順を整備する。現行の実接続v0.75.0プレビューは設定変更・再起動していない。
4. 利用者が操作可能になった時点で実ログイン/refresh・保存/再接続、Windows IMEを確認する。Android OS保管/lifecycle/IME、配布署名・installerの受入へ進む。

backupのKMS・保持/廃棄・自動実行・保管先暗号化、native端末backup/復旧画面は別工程として残る。本文の暗号化はserverでの復号を許容する採用方針を維持する。

現在、新たな利用者操作は必要ない。実ログインは利用者都合で保留中のため、再開時も独立した実装から進められる。既存サービスを一括停止・削除せず、共有Dockerと旧プレビューを保持する。
