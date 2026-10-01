# Step 7: 端末structured sync・競合解決の区切り

2026-10-01。[POC_SPEC.md](../plan/POC_SPEC.md) Section 18 Step 7の端末側を追加する。PageのYjs経路とTask/Relationのoperation経路は独立させる。[Docker証拠](../../tests/evidence/step-7-structured-client-20261001/SUMMARY.md)。Windows実機のnative IPC/IME、統合した4境界の強制終了試験と最終Gateはこの区切りで完了扱いにしない。

## 保存と再送

端末SQLiteをschema 3から4へtransactionで移行する。既存Page、CRDT binary、Task/Relation、queue、stable client IDを保持し、互換性のない既存tableがある場合は新列・versionもrollbackする。初期化によるデータ消去をしない。

送信前にprepared wire requestを保存する。ACKを失っても同じoperation ID・payload・base・predecessor・resolutionを再利用する。連続offline変更の次の操作だけは先の確定結果versionとpredecessor IDで初回requestを作り、元のlocal base/payloadは変更しない。恒久rejectionに依存する後続はrejectedとして記録し、元の入力を残す。

ACKは操作状態、確定結果、サーバーentity replica、Conflict、表示用entityを一つのtransactionで保存する。ACKだけでcursorを前進させない。pullはサーバー順序が連続していることを確認し、receipt・entity・Conflict・cursor/head/orderを同じtransactionで確定する。cursor保存が失敗した場合はentity/receiptも戻す。再送された確定結果はimmutableであり、違う内容を同じIDで受け付けない。

サーバーentityを別に保持し、そこへpending操作の「元のbaseから変えたfield」だけを重ねる。full formの未変更fieldでpeerを巻き戻さない。サーバーorderの古いACKが新しいentityや解決済みConflictを戻すことも防ぐ。tombstoneはpending更新より優先し、入力はqueue履歴へ保持する。

## 同期エンジンとUI

application用のstore/transport interfaceを`packages/sync`へ置き、端末復元→全pull→pendingを作成順push→再pullの順で処理する。各ネットワーク応答はSQLite確定後に次へ進む。直列化、15秒request timeout、1〜10秒のbounded retry、通常2秒pollを使う。cursorを端末時計で比較・採番しない。

保存/受信検証、プロトコル、権限のエラーは停止して明示再試行を待つ。通信障害は再試行待ちとし、未送信/Conflict/rejectedを同期済みにしない。ローカル変更の保存自体はネットワーク失敗と独立して進められる。再試行でqueueやcursorを初期化しない。

Task/Relationの保存状態と同期状態を本文の状態から分ける。接続停止はPageとstructuredの双方に適用し、同じrendererのreload/Page切替でもsessionStorageで保持する。新しいPageを表示するために停止を無断解除しない。

Conflict UIは対象・field・日時・base/local/remoteを表示し、local/remote選択を新しいoperationとして保存する。ACKが届くまで元Conflictを解決済みにしない。対象にpendingがある間は選択を待つ。完了後は競合一覧へfocusを戻す。受信だけではfocusや編集中のTaskフォームを変えず、古いフォームのbase versionを使った保存は入力を残してエラーにする。

## 試験の構成と限界

- Docker内のRust JSON-lines driverはTauriと同じrepositoryを使う。prepared再送、ACK/pull失敗rollback、古い応答、競合解決、削除優先、恒久エラー、migrationを検証する。
- 実PostgreSQLと実Nest HTTP、2つのRust/SQLite端末を結合し、offline因果chain、ACK喪失後のAPI再作成・store SIGKILL、異field保持・同fieldConflict、cursor保存失敗、500ms/2秒/5秒遅延、連続pause/resumeを検証する。
- 通常のEditor回帰はDB未設定のAPIで行い、新規structured E2Eは実DBの専用namespaceで別runする。回帰を新機能のPassとして代用しない。
- structured E2Eは毎回`greiva_test_<UUID>`だけを作成/削除し、既存developmentのデータを消さない。2画面の実同期、offline reload、両選択、stale draft保持、keyboardとfocusを確認する。

ChromiumのRust橋はnativeの保存層を使うが、Windows WebViewのIPC/ウィンドウ操作や実際のMicrosoft IMEではない。APIのclose/recreateもOSプロセスのSIGKILLと同一とは数えない。残る統合crash境界、renderer/app lifecycle、性能・互換性・native証拠を後続で監査する。汎用DB、Calendar、Button/automation、AI、updaterは設計のみでPoCへ実装しない。
