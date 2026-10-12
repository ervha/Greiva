# 基本DB作成画面 checkpoint

2026-10-12 / v0.69.0 / native16 / server11。[契約](../../../docs/development/PRIVATE_DATABASE_CREATE_SCREEN.md)。

## 実装

DB名とSelectの選択肢から6型のproperty/op/source/option IDを明示保存時に生成し、独立した永続Source intentを保存・送信する。名前は120 codepointを検査し、120emojiを含むUnicode入力を扱う。結果不明はcopy可能なdraftと元intent/pairで再確認する。自分の変換中inputをreadOnlyにせず、保存・取消・送信・navigationを止める。ACK成功後のqueue読取失敗とACK unknownを分け、最後の原確認結果・古いpending一覧・empty観測を保持する。確認済みSourceを一覧5件外から開く操作もnative cacheへ照合する。Pageの保存先・本文を置換しない。

## 検証

- Source runtime12/browser9/controller15の単独36条件がPass。新3条件はlimit検査前のsender未作成・UI5件、原ACK/一覧失敗/empty/閉鎖、lazy作成の失敗・Page保持・draft navigation・一覧外Sourceを扱う。
- actual signed HTTP/PG/SQLiteのSource4条件がPass（新1＋既存3）。原ACKが保存済みで一覧だけ失敗したこと、元結果・empty・共有storeのSource保持を実保存層で確認する。
- 新DB作成画面6条件がPass（desktop/mobile-dark-reduced-motion）。6型・120emoji・選択肢、保存だけではHTTP/confirmed Sourceがないこと、copy可能なunknown draft/同intent、HTTP unknownの同wire、ACK unknown/pending0でも同pair/networkless retry、変換中inputの編集継続、known ACK/一覧失敗を確認する。


| 対象 | 結果 | 証拠 |
| --- | --- | --- |
| 単独Source/Browser/controller | 36 Pass | [report](focused.json.gz)、[log](focused.log) |
| actual Source HTTP/PG/SQLite | 4 Pass | [report](source-create-pg.json.gz)、[log](source-create-pg.log) |
| 新作成画面 | 6 Pass / 0 flaky | [report](workspace-ui-focused.json.gz)、[log](workspace-ui-focused.log) |
| 最終通常回帰 | 761 Pass / 220 PG条件skip | [report](normal.json.gz)、[log](normal.log) |
| 実PG全35files | 220 Pass / 0 Fail | [report](postgres.json.gz)、[log](postgres.log) |
| 全workspace画面 | 64 Pass / 0 flaky | [report](workspace-ui.json.gz)、[log](workspace-ui.log) |
| 型/native/crash/features/frontend/Windows | Pass | [型](typecheck-final.log)、[native](native-build.log)、[crash](crash-build.log)、[features](native-features.log)、[frontend](frontend-build.log)、[Windows](windows-build.log) |

通常761=以前758＋新3、PG220=以前219＋新1、画面64=以前58＋新6。[desktop](workspace-db-create-desktop.png)、[mobile](workspace-db-create-mobile-dark-reduced-motion.png)。Docker source360/raw350一致・CRLF/LFのみ10・診断等excluded5：[照合](source-inventory.json)。外部npm315/Cargo501・118不変：[版監査](version-audit.json)。PE Product/FileVersion69とDocker/host SHA一致：[Docker](windows-build.json)、[host](host-exe-inspection.json)。hostでは起動していない。[全結果](verification.json)。
## 元fixture失敗

初回単独36条件は35 Pass / 1 Fail。UI/native-command doubleが作成URLをdatabases直下として実装し、実際のdatabases/createを受け取れなかった。次の単独も35 Pass / 1 Failで、doubleがACKにprepared objectを期待し、実際のsequence/wire/response形式を受け取れなかった。このACK fixtureのまま初回DB作成画面6条件もFailになった。HTTP/native commandの実装形式へfixtureを修正し、単独36・画面6を確認した。アプリまたはserverの不具合へ読み替えず、各原report/logを保持する。[初回単独](initial-focused.json.gz)、[初回log](focused-initial.log)、[ACK fixture単独](focused-ack-fixture.json.gz)、[ACK log](focused-ack-fixture.log)、[初回画面](initial-workspace-ui.json.gz)、[画面log](workspace-ui-initial.log)。

T3の限定fixtureでも作成・確認後のpending0と6型を観測した：[inspection](live-preview-inspection.json)。長時間稼働していたViteはtests外部ファイルの古いtransform（誤った作成URL）を返していたため、今回の正しいSourceを配信するようlive serverだけを再起動した。最終自動E2Eは別のfresh serverで全64 Passを確認済みで、古いlive表示を新しい合格証拠へ読み替えない。

## 境界と次工程

行の作成・編集、View設定の保存/競合解決画面へ続行する。実Supabase正常系・最新Windows invoke/実MS IME・Android native、credential/offline grant、配備暗号化・復旧/配布・最終Gateは別条件。Dockerのsynthetic compositionやcross-buildを実MS IMEの合格にしない。Git checkpointはinstaller公開ではない。
