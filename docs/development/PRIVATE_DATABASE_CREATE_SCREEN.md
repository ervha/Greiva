# 基本DBの作成画面

2026-10-12 / v0.69.0。[Source queue/runtime](PRIVATE_DATABASE_SOURCE_WRITE.md)、[Table/List読取](PRIVATE_DATABASE_BROWSER.md)。6型の定義を端末に保存し、明示的に送信・確認する画面を個人workspace接続プレビューへ追加する。行の作成・編集とView設定の保存画面は次工程。

## 作成と状態

- DB名とSelectの選択肢を入力する。Name/Text/Number/Checkbox/Select/Dateのproperty・option IDとoperation/source IDを明示保存時に生成する。NameはPageタイトル参照で、値や本文をSourceへ複製しない。
- DB名と各option名は120 codepoint、optionsは100件まで。DOMはUnicode surrogateを考慮した上限にし、Domainで型・件数・空欄・所属を検証する。invalid inputをnativeへ送らない。
- 初回は所有するSource write runtimeをlazy openし、pending-only queueを5件読む。HTTPは開始しない。limitオプションは1〜100の整数をsender作成前に検査し、既存callerのdefault100を保持する。
- 保存は独立した永続Source intent。native enqueueまたは直後の一覧の結果が不明なら、入力をcopy可能なreadOnlyで保持する。新しいIDを発行せず元intentで再確認する。保存確認後だけフォームを初期化する。
- 送信は最も古い未確認Sourceを1件確認する。HTTP unknownは元wireで再送、ACK unknownは元pairを追加HTTPなしで再保存する。結果不明の新規保存/送信やnavigationを止め、再確認ボタンを自己blockingしない。
- 最後に確認できた原作成応答をruntimeへ保持する。ACKが成功して後続のqueue readだけ失敗しても、原応答とstaleな一覧を区別し、ACK再確認を表示しない。古い一覧で同operationが残る場合は確認済み・再読取待ちと表示する。
- empty prepareは現在の送信時点に未確認操作がないという観測で、最後の原作成応答を消さない。新しいenqueueでempty観測を解除する。privateな応答はowner閉鎖時に消す。
- 確認済み応答からDBを開く操作は、native cacheの所属・ID・確認済みsnapshotを検査する。一覧の5件外でも正しいSourceを選べる。架空のversionや確認済み定義を作らず、queueのpending定義を通常のconfirmed読取へ混ぜない。

## 入力と所有権

未保存フォーム・composition・未知のenqueue/ACKではworkspace navigationを止める。own draft/unknownを再確認操作の外部blocking条件へ混ぜない。compositionは即時refでも検査し、保存・取消・送信を止める一方で、変換中の自分のinputをreadOnly/disabledへ切り替えない。

controllerはCreatorとBrowserを別々に所有し、Page/Title/Taskの保存層を共有する。Creator openの失敗は専用errorとし、Pageを閉じたり別DBへ置換しない。Auth/owner閉鎖・遅着は元sessionのguardを使い、storeは全session cleanup後に閉じる。生cause・内容・tokenを診断へ追加しない。

通信/保存暗号化の配備、実Supabase正常系、最新Windows invoke/実MS IME、Android native、credential/offline grantと最終Gateは別条件。
