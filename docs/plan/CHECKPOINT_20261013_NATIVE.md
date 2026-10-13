# 2026-10-13 native認証・本文checkpoint

利用者の「キリの良いところまで進め、進捗と計画をまとめて一時停止」に従い、v0.90.0の検証・commit/tag/push完了で停止する。既存PoC/製品化の受入条件は変更しない。

## 今回の進捗

- v0.84–0.86：固定native HTTP provider、OS credentialの復元/rotation、local-first logout、verified owner/device/bootstrapをSQLite admissionへ接続。tokenを画面へ渡さないIPCと旧command/SQL pluginを閉じるbuild modeを追加。
- v0.87–0.89：専用native認証画面、自動復元1回・明示login/refresh、workspace一覧、Page作成/本文編集/直列端末保存を接続。unknown保存・遅い応答・composition中の失効に対応し、同scopeだけへmemory下書きを明示復帰する。
- v0.90：[native Page送信/ACK基盤](../development/NATIVE_PAGE_SEND.md)を追加。実署名API/PG/SQLiteでwrong-scope receipt、応答喪失、同wire再送、冪等保存と全文/vector一致を確認。

画面回帰はv0.89で20件・全unit518、v0.90は通常Rust34と専用TLS/API/PG3件。失敗runと後続Passを別に保持。Windowsでv0.89隔離候補がnative.htmlの未ログイン画面まで起動した。これは最新native本文invokeや実IMEの受入ではない。

過去v0.82.0の実登録・本文保存/強制終了/再接続・同期、v0.82.1の短いMicrosoft IME入力と保存/同期の証拠を保持する。再変換の本文欠落Fail、remote composition/reconnect・性能・offlineの未実施は残る。

## 再開順

1. native Page sendをTauri IPC/client port/明示同期操作へ接続。local保存と送信/ACKを分離し、known remote receipt＋unknown local ACKの保持・networkなし再確認を追加する。
2. native Page remote read/pull、一覧/catalog、再接続を元handle/owner/世代へ固定。既存Task/Relation/基本DBのnative認証経路も順に移す。
3. 署名offline grant/leaseを新runtimeの認証・logoutへ接続し、期限/時計rollback/既知失効を守って端末利用を復元する。
4. 実接続候補で手動login、Windows本文invoke・保存・再起動・送信、実Microsoft IMEのcomposition/再変換/remote再接続を検証する。未解決Failを合格へ置換しない。
5. その後にナビゲーション、画面の整理・モダンな配色/余白、mobile操作、配布・署名/復旧の残項目を進める。

停止時に利用者の操作は不要。次の実接続Windows受入では手動認証/IME入力が必要になる。隔離fixture候補は実providerへ接続できない設定であり、そこで実accountの入力を依頼しない。
