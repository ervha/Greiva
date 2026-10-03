# Windows 0.6.11通常releaseの大量データ・同期・観測時間

2026-10-03、記録checkpoint v0.6.16。製品コードは変更しない。Windows 11 Home / build 26300、i7-12700H（14 core / 20 logical）、RAM約16GiB。[環境](environment.json)。Dockerでbuild・dataset準備・保存層監査、Windowsで通常Tauri releaseの表示・入力・native IPC同期を実行。Computer Useは試験区切りで解除。

## 正常releaseと隔離

[build controller](build.mjs)・[135ソースhash、frontend build、feature graph、locked/offline cross-build](build.json)。frontend試験flagは0、SQLite crash hookなし。build用identifierだけを `dev.greiva.poc.bench20261003v611` へ変更し、最初のPageを01a10230-0000-7000-8000-000000000001とした。exe SHA256 `4c3aca1467189c4916f3167f37f8436fb5446cbf0e74197d5f3004b4755193bc`、13,092,864 bytes。ホストへtoolchainを追加していない。

Computer Useから起動したprocessはCodexのWindows package filesystem virtualizationを引き継ぎ、論理AppData保存先はpackageのLocalCache内へredirectされた。[実保存先・停止コピー](empty-stopped-copy.json)。通常Greiva、IME69-A/B、前のnative fixtureは編集していない。

## 観測時間

| 条件 | 結果 | 意味 |
| --- | --- | --- |
| 最初の空DB・新WebView profile | main UI確認、正確な時間は未取得 | 初回2.927秒のcaptureはoccluded。activation後32.470秒でUI確認した上限を起動時間の実測値にしない |
| 空SQLite・warm WebView・API/collab停止 | main UI＋端末保存済みの観測上限 **2,662.7ms** | helper起動／window選択／前面化／UIAを含む一回。3秒目安内だがcold profileの保証ではない |
| 1,000 block＋250 Task・warm WebView | 本文先頭＋端末保存済みの観測上限 **3,567.4ms** | 2秒の復元目安を超える観測。起動とUIAを含み、Page restore単独や編集可能になる時刻とは分ける |
| 1,000 blockで111文字のliteral入力 | action **138.4ms**、次の画面まで **727.4ms** | 111文字を保持・保存。1文字のkeydown→ACK、frame、実IMEの測定ではない |
| 1,000 structured operation | 最初→最後のserver応答 **75,973ms** | 通常native engineが1件ずつpush。初回request前と最終native ACK commit時間は含まない |

[初回起動](empty-startup-observation.json)・[画面](empty-startup.jpg)、[空DB再計測前提](empty-repeat-preconditions.json)・[修正後観測](empty-repeat.json)・[画面](empty-repeat.jpg)、[復元観測](warm-restore.json)・[画面](warm-restore.jpg)、[入力観測](input-observation.json)・[画面](input-final.jpg)。

初回の大量fixtureはshared emptyPageUpdateを含めず、同じPageの既存サーバー空段落とmergeして1,001 blockとなった。[初回観測](restore-observations.json)。通常native UIで先頭空行をDeleteしてから入力し、停止後に正確に1,000 paragraphと全seed本文を確認した。これは試験fixtureの補正で、製品修正ではない。初回復元の27秒capture上限も観測間隔が空いており、正確な復元時間には使わない。

空DBの初回再計測ではobserverがdocument_textにplaceholder「無題のPage」を要求したため10秒でfalseとなった。[原観測](empty-predicate-attempt.json)・[実画面](empty-predicate-attempt.jpg)はUI表示済み。実ラベル・保存状態を条件に修正し、別の空SQLiteで2,662.7msを得た。rawを上書きせず、製品の10秒起動失敗へ読み替えない。

現状のrestore単独内訳は未測定。1004 journal updateのdecode、1,000 paragraph／handle描画、250 Taskのprojection／描画、WebView起動、UIA観測が候補で、原因が確定したとはしない。次の性能改善では同じdatasetで層別計測を行う。今回の1回の上限からp95やSLOを主張しない。

## 保存・サーバー・独立peer照合

[seed controller](seed.mjs)は実Rust repositoryで1,000 paragraph、250 Task×create/update/update/updateの1,000 pending operationを作成。[seed・全operation ID](seed.json)。[停止中の隔離先設置](seed-install.json)の後、通常Windows releaseを起動してnative IPC／通常React engineに同期させた。seedをnative UI入力と呼ばない。

保存済みを画面で確認しAlt+F4で停止、[SQLiteコピーhash](final-copy-hashes.json)を取得。[監査script](verify-release.mjs)をDockerで `node --import tsx` により実行。[結果](verification.json)はPass。

- integrity_check=ok、1004 Page updateのdigestが一致。最終1,000 paragraph、先頭のseed本文＋111文字、他999行はseedと完全一致。
- native1,000 operationがすべてacknowledged、元のoperation IDを保持、errorなし、cursor=head。
- 250件の最終Taskは期待どおりの名前・done・期限2028-02-29・version4。先行試験9件を含むreceiptとサーバー台帳は各1009件。
- PostgreSQL request/result、native prepared wire/local result/receiptが全件一致。[今回1,000応答の原proxy記録](queue-proxy.jsonl)。operation IDはすべて一意、1000件すべて200／acknowledged。
- 空の実Rust独立peerのTask／Relation／Conflict／cursor、空Y.Doc peerの全文XML／state vectorがnative停止データと一致。
- 同じDBを無編集で再起動し、111文字を含む本文の復元画面を確認した。

監査初回はTypeScript parameter propertyのためplain nodeが起動できず、既存tsxを使用。次はPage peerに必須clientId queryがなく接続待ちtimeoutとなったため、通常client同様にclientIdを付けてPass。製品やraw SQLiteを変更していない。

通常releaseの起動・大量データ保持・native同期の証拠を補完したが、cold profileの正確なpaint時間、per-key遅延／frame、1,000 blockでの実Microsoft IME、残るnative必須操作、macOS P1／iOS P2と最終Gateは別の課題。性能目安の達成やPoC全体のPassにはしない。製品suiteはコード変更がないため再実行していない。
