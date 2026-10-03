# Pixel 7 / Android 17 / Chrome 0.6.11互換性

2026-10-03、記録checkpoint v0.6.15。Android ChromeはPOC_SPEC §12の**P2**。Pixel 7、Android 17 / SDK 37 / build CP3A.260905.009、Chrome 154.0.8037.126、Gboardを実機で確認。[環境と利用者報告](environment-and-user-report.json)。QPR1は利用者申告で、build番号から独立に判定していない。

通常0.6.11のrelease frontendをDockerから配信。[build記録・135ソース照合](frontend-build.json)と[配信ファイルhash一致](frontend.json)。試験hookは無効で、実画面の `window.greivaTest` もundefined。製品・manifestは変更していない。

## 自動26項目

[実機controller](auto-controller.mjs)は、利用者が開いたChromeの専用Pageから新しいPageを通常UIで作成。Docker Playwright/CDPから物理端末のChromeへtouchとbrowser key操作を送った。文字列fixtureはliteral入力であり、OSのGboard入力とは分ける。viewportは実際の520px幅・約492〜517px高、devicePixelRatio約2.075。fullscreenやemulationを仮定しない。

PL1-AUTO611（01a101ee-6bc2-7163-8167-a777f82c7aef）の[26結果](auto/results.json)はすべてPass。11必須blockの挿入／編集と削除（22件）、Todo touchチェック・indent/unindent・Undo/Redo、入れ子Toggle開閉、Mention選択置換・Undo/Redo、Slash候補の実viewport内表示・Escapeを確認。各項目で独立Hocuspocus peerとの全文XML・state vectorを比較。[最終画面](auto/final-page.png)。

初回controllerはPage遷移直後の古いURLを読んで中断した。[原記録](auto/navigation-attempt.json)。waitForURLを追加して再実行した。製品の失敗に読み替えない。

## 実Gboard E/F

利用者がPL1-IME611（01a101f1-ca11-7047-82ff-0455d1b6a940）で実Gboardによる「にほんご」→「日本語」を変換・確定。Eはlocal行、Fはremote行で候補表示中に3秒待つ条件。利用者は両方「問題なくできました」と回答。文字欠落・二重入力・候補異常なしの報告を保存した。

[observerと独立peer](ime-controller.mjs)はcompositionを合成せず、実Chromeのイベントを記録した。[原イベント・3更新・双方の全文／clock](ime/results.json)。Fのtrusted compositionstartを検出して、同じ段落の先頭へ600ms間隔で3更新を送信・ACK確認。変換開始から日本語inputまでは端末performance時計で約4,203.8ms。3更新を含む本文上でisComposing=trueのtrusted keydownを確認し、その後日本語inputとなった。端末とcontrollerの壁時計はずれるため、別の時計同士を比較していない。

- E最終行: `ANDROID611 local 日本語`
- F最終行: `［遠隔3］［遠隔2］［遠隔1］ANDROID611 remote 日本語`
- 第3行: `ANDROID611 peer`

[最終画面](ime/final-page.png)と独立peerのXML／clockが一致。「日本語」は各行1回、元のprefixと3更新を保持。start/update/beforeinput/inputはtrustedだが、観測されたcompositionend 2件はisTrusted=falseであり、原値を保持しtrusted OS eventと呼ばない。controllerはcomposition eventをdispatchしていない。候補表示の正常性は利用者報告で、候補の動画を独立収録した証拠ではない。

## 接続停止・再接続4項目

E/FのXML／clock不変を観察してから、別のPL1-SYNC611（01a101fe-e2a6-7434-ad5c-0c449d7f0751）へ移動。[controller](sync-controller.mjs)・[原結果](sync/results.json)。Page IDは原結果を正とする。

接続停止中のlocal編集と別peer編集の分離、通常「再接続」button後の双方保持・収束、接続中5組の交互編集の各1回保持、接続中reload後のサーバー復元を確認した。4項目Pass、全文XML／state vector一致。[最終画面](sync/final-page.png)。IME Pageは編集していない。

## 監査と境界

[Docker監査](verify-results.mjs)で26＋4結果、trusted実入力、Fの3秒以上・遠隔3更新、全文／clock一致を検査。[監査結果](verification.json)。初回監査は「遠隔3更新後にも未確定文字のinputがある」と過剰に仮定したためassertion失敗。rawでは待機後のtrusted isComposing keydownがあり、inputの追加は必須ではないため、その実イベントと確定時刻を検査するよう修正。次の実行はコピー先のroot所有で出力不可となり、Docker内rootで監査出力してPass。いずれもrawを変更せず、製品失敗／再入力は生じていない。

ブラウザにはSQLite／native Task保存がない。接続中reloadはサーバー復元であり、offline終了復旧ではない。実Gboardのcomposition中に接続を停止・再開する条件、Android全OS操作、macOS P1／iOS P2、Windows性能、最終Gateをこの結果からPassにしない。IME fixtureと他の専用Pageはサーバーjournalへ保持する。pairing code・端末serialは証拠へ含めない。
