# 基本DBのView作成・設定・競合解決画面

v0.72.0 / P3初期範囲。[Browser](PRIVATE_DATABASE_BROWSER.md)の確認済みSourceから、[View runtime/実HTTP](PRIVATE_DATABASE_VIEW_WRITE.md)と[端末queue](PRIVATE_DATABASE_VIEW_QUEUE.md)を明示的に開く。Name/Text/Number/Checkbox/Select/Date、Table/Listの範囲を保持する。

## 保存対象と入力

Viewは既存Recordに対する表示設定であり、RecordやPage本文を複製しない。新規Viewの未保存設定と、端末から読み取った既存Viewの確認済み版を分ける。既定の一時表示を確認済みViewとして保存しない。操作/View IDは明示保存時に生成する。

名前・Table/List・表示列の順序・条件・並べ替えを保存できる。Name列は表示を保持する。新しい条件は最大20項目の単一AND/ORグループで、各型に適した演算子/値を指定する。null/空文字/0/falseと選択肢ID、日付を区別する。新しい並べ替え指定は1列またはなし。既存の多段条件と複数列の並べ替えは、置き換えを選ばなければ元構造をそのまま保持する。この画面で高度な条件/複数sortの新規編集を提供したとはしない。

既存Viewは選択時にNativeWorkspaceStoreからsnapshot/versionを読み、変更した設定fieldだけをpartial patchへ含める。列順/複合条件を名前変更で正規化し直さない。入力用pure helperは型付きDomain validatorを使い、行作成/編集の共通値検証と一致する。名前は120 codepoint、inputはUTF16のmaxlength240で受ける。確認済み設定と候補は人が読める列名・値で表示し、長いテキストpreviewは160 codepointで省略して保存値を変えない。

## 保存・再確認・選択

端末保存と送信・確認は独立した明示操作。未送信設定をBrowserの確認済み値へ混ぜない。known busyでは新しい入力を保存せず編集可能なまま保持する。unknown enqueueではcopy可能なreadonly入力または元解決操作を保持し、同一intentで再確認する。HTTP unknownは元wireを再送、native ACK unknownは元sequence/wire/response pairだけをnetworklessで再保存する。pending0をunknown解除の証拠にしない。

known ACK後の一覧読取失敗では原応答と旧一覧の再読込待ちを表示し、ACK unknownと区別する。送信はworkspace全体のView FIFOで、選択中Viewだけの送信とは限らない。元結果はapplied/conflict/rejectedとして表示する。対象Sourceの確認済みViewをnative cacheで照合してBrowserへ開く操作を用意し、View header window10件の外も開ける。選択肢を重複させず、同IDの新しい版を開いたら一時layout切替を解除する。

draft/unknown/保存中/変換中はSource/Page選択・logout・他DB操作をguardする。自分のcomposition inputは編集可能なまま、保存/取消/列移動/条件選択/送信を止める。Rootには1つのView panelだけをmountする。独立runtimeのqueue windowは5件、global pendingと次cursorを別表示し、次windowは置換する。

## 競合と読み直し

端末のView snapshotと候補/解決履歴をlimit1・独立cursorで読む。HTTPを発生させず、queue windowへ候補を混ぜない。失敗時は前の設定/候補/入力を保持して以前の読取結果と表示する。busy/unknown/閉鎖・Auth世代変更の遅着はguardし、共有storeはworkspace ownerが閉じる。

base/local/remoteの設定と元版/remoteVersionを比較する。`prepareDatabaseViewResolution`で現在のconfirmed snapshotと候補を照合し、local/remoteを選んだ新operationをqueueへ保存する。原ACKの解決proofを保存し、読み直したresolvedByを履歴として表示する。解決履歴の次にある未解決候補も継続読取できる。

元設定が変わった候補は解決ボタンを無効にする。保存済み解決操作がサーバーでresolution_staleとして拒否された場合は原拒否を保持し、反映済みとしない。base_unknown/不適切な解決も別結果とする。端末の読取はサーバーの最新確認とはしない。最新DB情報の取得はBrowserの明示変更取得で行う。

## 検証と残範囲

[証拠](../../tests/evidence/private-database-view-screen-20261012/SUMMARY.md)。Docker UI fixtureのmock Auth/IPC/HTTP、actual signed HTTP/PostgreSQL/Rust SQLite、Windows cross-buildを区別する。native16/server11、外部依存・既存rootを保持する。実Supabase正常login、最新Windows invoke/実Microsoft IME、Android native、credential/offline grant、配備暗号化・backup/restore・配布/最終Gateは別条件。

P3初期のDB作成/行作成・更新/候補解決、View作成・設定/候補解決を接続した。削除/型追加/高度なDB機能をこの区切りで拡張しない。次は初期DBの保存・同期・未取得状態のヘルプを既存ヘルプ入口へ接続し、既存P4計画に沿う実行・復旧準備へ進む。