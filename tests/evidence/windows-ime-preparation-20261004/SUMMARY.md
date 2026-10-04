# Windows 0.6.20実キー入力と1,000段落の保存照合

2026-10-04、検証checkpoint v0.6.21。製品／通常実行物は0.6.20のまま。利用者の手入力なしで、Computer Useによる実キー操作を試す。Microsoft IMEというproviderの同定は未完了で、確認質問への回答待ち。この試行をGate AのMicrosoft IME Passへ昇格しない。

## 代行できた範囲

Dockerで作成した[通常Windows 0.6.20 release](../block-drag-large-20261004/build.json)（SHA256 `8dc52aa61302777a41b927de599cbd4239592894e16e61ca68329b1ad5b8d115`、13,094,912 bytes）。試験flag=0、crash hookなし。identifier `dev.greiva.poc.validation620`、新Page `01a10400-0000-7000-8000-000000000001`／WIN620-IME1000、1,000 paragraph。既存の通常GreivaやIME失敗fixtureとは別。

Computer Useの新しいapp/window選択・前面化が成功。正しい試験用Pageの画面と保存状態を確認し、1行目をclick、End、Alt+graveで「あ」表示を確認。`press_key`で `n,i,h,o,n,g,o` を送り、画面で「にほんご」compositionを確認。Spaceで「日本語」変換、Returnで1回確定。[確定後の実画面](first-commit.jpg)。literal Unicode投入やsynthetic compositionを使用していない。途中の予測候補画面には入力履歴らしい文字列があるため、公開証拠へ保存していない。

[online backupの保存先と件数](native-copies.json)・[監査](audit.json)・[監査script](audit.mjs)・[独立peerの最終XMLとclock](peer-final.json)。packaged Roaming内の実DBはseed1→9更新、通常Roaming側はseed1更新のまま。SQLite online backupでWALを含めて整合コピーし、Dockerで監査。

- integrity_check=ok、9更新のSHA256 digestが正しい。
- 最終1,000 paragraph。先頭は `WIN620 local 日本語`、残る999 paragraphはseedと完全一致。文字欠落・二重確定・余分な段落なし。
- タイトルWIN620-IME1000を保持、独立Hocuspocus peerの全文XML／state vectorが一致。
- [旧0.6.19 Page保持](original619-preserved.json): 開いたままのWIN619-DRAGの全metadata／13更新の全byteが前回online backupと完全一致。旧Pageへinputしていない。

## 準備時の失敗と修正

[seed controller](seed.mjs)は既存の実Rust SQLite driverを使用し、共有empty seedを削除したupdateと正確な1,000 paragraphを作る。初回は未integrateのY.XmlElementへのpushでwarningが出たためinsertへ変更。初回DB／seedは隔離したまま保存し、製品修正とはしない。

最初のhost配置は4KiBのSQLite main fileのみで、seedのWALを含めていなかった。起動した新Pageはserverから本文を受け取れたが、local titleが無題となり配置不備を検出。実入力前に保存済みの新しい試験appだけをAlt+F4で閉じ、[SQLite backup](backup-seed.mjs)でtitleとupdateを含む自己完結したseedを作成。旧配置のDB／WAL／SHMを専用backupへ保存し、停止した試験identifierの2配置だけを置換。再起動後、実画面で正しいtitle／本文／保存済みを確認してから入力した。利用者の既存Pageは不変。

初回監査はnode:sqlite rowのnull prototypeを通常objectとdeepStrictEqualして失敗。[原script](audit-first.mjs)・[原log](audit-first.log)。field値を保ってrowを通常objectへ変換し、再監査でPass。監査の都合でDBを編集していない。

## 残条件と再開

入力方式がMicrosoft IMEかは画面とprocess inventoryだけでは確定できず、利用者に「Microsoft IMEです／切替済み／今は操作できません」の確認を依頼した。候補の外見やGoogleIME／TextInputHostのprocess存在からproviderを決めない。回答が来るまではMicrosoft条件の試験へ進めない。

実日本語1変換の証拠であり、連続入力の体感・per-key SLO・遠隔compositionとの同時性は未確認。現在の試験appは保存済み・同期済みで開いたまま。旧0.6.19も開いたまま、Computer Use解除済み。遠隔入力試験はまだ開始していない。

[試験用collaboration service](serve.mjs)はPageだけを扱い、structured APIは明示503。Task側の再試行表示は実験条件であり、このrunをstructured syncの合否へ使用しない。既存server台帳や同期DBを変更しない。

[peer controller](peer.mjs)の`--send-now`は、Microsoft IMEを確認した後、Codexが2行目末尾で実キー変換中の画面を確認してから実行する。3更新を1秒間隔で同じ段落の先頭へ入れ、各ACKを記録。候補／選択が維持されていることを画面で確認してからEnterで確定し、SQLite online backup・全1,000 paragraph・独立peer全文／clockを再照合する。marker待機を使う場合も明示startのみで送信し、回答の代わりに時間経過で開始しない。

準備・1変換・保持照合を終えたので、回答待ちで停止する。Gate Aの残条件、P1 macOS／P2 iOS未実施、Windows性能目安の扱い・正式Gate判断は維持する。Calendar／AI等へPoCの範囲を拡大しない。
