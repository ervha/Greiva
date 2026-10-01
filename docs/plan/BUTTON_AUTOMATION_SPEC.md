# 汎用ボタン・データベースオートメーション 設計案 v0.1

更新: 2026-10-01。製品要求と実装前の詳細案。未実装であり、PoCの範囲・順序・Gateを変更しない。

## 1. 要求と位置付け

ユーザーはNotionのボタンプロパティと押下時のオートメーションを確認し、Greivaへ汎用的に取り込むことを指定した。「課題追加」「講義ノート追加」は利用例で、任意のレコードから関連データ作成・プロパティ変更等を組める機能とする。

[DATABASE_SPEC.md](DATABASE_SPEC.md)のProperty/View/Record、[AI_ACTION_SPEC.md](AI_ACTION_SPEC.md)の共通application command、[GREIVA_REQUIREMENTS.md](GREIVA_REQUIREMENTS.md)の保存・同期・認可を引き継ぐ。UIボタン、プロパティのボタン、将来のAI、変更triggerは同じ処理基盤を使う。直接SQLやProvider呼び出しをUI定義へ埋め込まない。

本書の具体的な実行管理・offline契約はGreivaへの適合案であり、ユーザーが細部まで選択済みという意味ではない。全機能の同時リリースは未決定。外部送信を含む機能の設計は、開発中に実際のメール等を送る指示ではない。

## 2. Notion公式仕様との対応基準

2026-10-01確認。機能の名称だけでなく入力、参照、実行順、失敗、権限も項目別に照合する。

| 区分 | 元仕様の確認事項 | Greivaの対応目標 |
| --- | --- | --- |
| Database button | Propertyとして定義し、押下で複数actionを実行 | Table/Board/詳細等から同じ定義を現在Recordの文脈で実行 |
| Page button | Pageに置くボタン、本文blockの挿入を含むaction | 同じaction基盤を使い、本文挿入はYjs commandへ接続 |
| Database automation | 追加/Property変更/定期trigger＋複数action | DataSourceまたは保存ビューを対象に、自動処理の定義・停止・履歴を管理 |
| 動的入力 | 現在/triggerのPage、実行者、日時、mentions、formulas、変数 | 型付き参照と式、前actionで作ったRecordの結果を後actionで参照 |
| ボタンと自動処理の関係 | ボタンによる変更はDB automationを起動できる。automation同士は起動しない | 原因種別を記録し、同じ関係を基本の契約にする |

根拠: [Database buttons](https://www.notion.com/help/database-buttons)、[Page buttons](https://www.notion.com/help/buttons)、[Database automations](https://www.notion.com/help/database-automations)。Greivaの後続節はこれらを基にした設計案で、Notionの内部実装を説明するものではない。

Notionのボタンは確認・Page/URLを開くactionを持つ。DB automationはPage追加、Property編集、頻度による定期実行をtriggerにし、any/allを選べる。定期triggerは他triggerと組合せず、現在PageのEdit propertyとは組合せない。複数の編集triggerのall判定には約3秒の窓があり、式はaction入力で使い、trigger自体の任意式としては使わない。Greivaでも対応の可否・差異を隠さない。

## 3. 設定モデルの案

| 概念 | 責務 |
| --- | --- |
| ActionDefinition | 安定ID、版、ラベル、順序付きaction、型付き入力、対象・変数・結果参照 |
| ButtonDefinition | PropertyまたはPage配置、label/icon、ActionDefinition、実行権限、確認設定 |
| AutomationDefinition | DataSource/保存ビュー参照、trigger、any/all、頻度、active/paused、ActionDefinition |
| Execution | 実行ID、定義の版、原因event、実行者/委任主体、文脈、確定入力、状態、各step結果 |
| TriggerEvent | operation/event ID、Record、変更前後、変更Property、原因種別、commit順序 |
| Delivery | 外部actionの配信ID、送信先、状態、attempt、Provider結果。Executionの保存成功とは独立 |

内部参照はProperty/Record/DataSource/Action IDを使う。名前の変更で定義が別対象を指さない。実行開始時に定義の版と入力を固定し、処理途中の設定変更が同じ実行へ混ざらない。

Buttonに対する「値」を各行に保存せず、定義と実行履歴を保存する。定義編集、実行、対象データ編集、外部接続管理は別権限とする。

## 4. 共通actionの提供対象

| Action | 入力・意味 | 保存・実行の境界 |
| --- | --- | --- |
| プロパティを編集 | 現在Recordの指定Property、値/式 | 単一値の置換、複数値の置換/追加/除去を区別 |
| レコード/Pageを作成 | 対象DataSource、任意template、初期Property | 新IDを実行に固定し、作成結果を後actionへ渡す |
| レコード群を編集 | 対象source、明示集合/Relation/条件、変更内容 | 対象集合とbaseを固定し、未取得の全件対象をローカル数件で代用しない |
| 変数を定義 | 定数、型付き参照、許可された式 | 後actionから名前/IDで参照。未定義/循環/型エラーを検出 |
| 確認を表示 | message、対象、変更概要 | ButtonのUI境界。キャンセル前の確認に従う実行を設計 |
| Page/URLを開く | 既存Page、今回の作成結果、URL | 保存成功後に開く。サーバー自動実行は利用者UIを操作しない |
| Page本文へblock挿入 | template、挿入場所、対象Page | Page button等のYjs command。Property値と二重本文にしない |
| アプリ内通知 | 対象利用者/Person、message、関連Record | 通知作成と通知の配達/既読を分ける |
| メール送信 | 接続アカウント、宛先、件名、本文等 | Provider Adapter、配信履歴、明示された接続・権限 |
| Webhook | 設定済みendpoint、送信内容 | Provider Adapter、配信ID、秘密情報を定義/ログへ埋めない |
| Slack等の通知 | 接続先、channel、message | Provider Adapter。外部サービス固有部分は独立仕様 |

NotionのDatabase button、Page button、automationでは利用できるactionが異なる。Greivaも設定surfaceごとの対応表を作り、利用不可のactionを実行可能として保存しない。本文挿入はPage buttonの比較対象で、DBボタンの既存機能と混同しない。

Notionの式対応にもactionごとの制限がある。元仕様ではblock挿入/Page・URLを開く/Slack通知等の式入力に制限があるため、Greivaの式対応を増やす場合は拡張として記録する。式によるIF値計算と、実行手順そのもののif/else分岐は別機能。後者は今回確認したNotionの基本action一覧にあるものと断言せず、Greivaで採用する場合は別判断・実行契約を設ける。

### 4.1 Task・予定・本文の扱い

Task/予定にbindingしたsourceの作成/編集は、そのdomain commandを呼ぶ。TaskのstatusやScheduleの変更範囲・例外を汎用Property更新で迂回しない。予定の曜日変更でどの回を変更するか不明な場合は入力/確認を要求する。

Pageの初期本文を使う場合は、予約済みPage IDと冪等な初期化を用い、再試行でtemplate blockを二重挿入しない。本文CRDTとstructured storeにまたがる完了契約は第7節に従う。

## 5. Triggerと適用対象

| Trigger | 対応目標 | Greivaの判定案 |
| --- | --- | --- |
| Record/Page追加 | 対象sourceまたは保存ビューへ新規追加 | durableなcreate eventを受理後に一度だけ評価 |
| Property変更 | 指定Propertyが編集/指定値へ変更/値を含む等 | 型に適した条件、変更前後と実際の変更を判定。pullの再表示では起動しない |
| 定期実行 | 日/週/月等、時刻、開始/終了、timezone | server schedulerによる予定時点ID。端末ごとに別実行を作らない |

any/allの条件はUIで明確に表示する。複数の変更条件を一つのcommand内で満たす場合は同じ変更eventで評価する案。別command間のall編集triggerを元仕様と同様に短い窓でまとめる場合は、サーバー受理時点を使うdurableな窓・締切・復旧を定義する。約3秒の挙動を端末時計やpullのタイミングで模倣しない。厳密な時間窓とoffline連続操作の判定は実装前の未決定事項とする。

保存ビューを対象とする場合、評価に使う共有filterとその版を固定する。個人の一時filterではautomation定義を変えない。後値がfilterを満たす場合に対象とする案を基本とし、「ビューから外れる」triggerを追加する場合は別契約とする。

操作原因を`user` / `button` / `automation` / `import`等で記録する。Buttonによる確定変更はtriggerになり、automation由来の変更は他automationを起動しない。pull適用、ACK、派生値再計算、閲覧、CRDT projection生成で新しい変更eventを作らない。importと繰り返しtemplate由来の起動可否は対応表で明示する。

定期実行のtimezone・夏時間・欠落時点・停止中の回・遅れた回を実装前に確定する。定期actionが予定を作成することと、Calendarの繰り返しProjectionを生成することは異なる機能である。

## 6. 設定・実行UI

Property設定のButtonからlabel/icon、action追加・並べ替え・削除、対象source、Property、値/式、変数、確認を編集する。データベースのautomation入口では名前、対象、trigger、action、有効/停止、実行履歴を編集する。特定の用途の固定フォームではなく、同じaction editorを使う。

- 定義のdraft、検証、保存、有効化を分ける。対象の欠落、型不一致、読み取り専用Property、許可不足、未定義変数をstep単位で示す。
- 「現在のレコード」「実行者」「実行日時」「この手順で作成したレコード」を入力候補で見分けられるようにする。静的な特定レコード参照と区別する。
- previewは対象と変更内容を示し、実行しない。試験実行は利用者が明示的に開始し、実データ/外部送信を伴うことを表示する。
- Buttonはidle、実行中、端末保存済み、同期/実行待ち、完了、部分完了、失敗、結果不明を区別する。連打/timeout時に新実行を自動生成しない。
- 実行中の同じ押下は同じExecutionを表示する。完了後に改めて押す操作は新しい実行。毎回Taskを作るボタンと、特定状態へ更新するボタンの意味を混同しない。
- 作成したRecordや変更した項目を結果から開ける。設定・結果パネルを閉じた際は元のカード/セルへfocusを戻す。保存応答や同期で本文IMEを確定させない。
- 広範囲編集・削除・外部送信は、設定時の権限/送信設定と実行時の対象・必要な確認を通す。任意のボタンに全操作の無条件承認を持たせない。
- 元仕様の途中の「確認」actionも表現する。確認前に実行済みstepがある場合はその結果を表示し、キャンセルで既実行の外部処理が取り消されたと表示しない。新規定義では副作用前の確認を入力補助とする。

## 7. 保存・同期・一度だけの実行

### 7.1 手動Buttonとoffline

Button押下はExecution IDを端末で生成・保存してから開始する。入力/定義版、作成するRecord/Page ID、各step IDを固定する。同じExecutionの再送・再起動は途中から再開でき、create・Relation追加・block挿入を増やさない。

完全に端末内の既知の対象へ実行できるstructured変更は、entity/Relation/queue/実行stepの記録を同じSQLite transactionで保存する案。選んだレコード群が未取得、server側認可が必要、外部action等の場合は待ちを保存する。offlineを実行成功に見せず、実行場所と待っているstepを示す。

Yjs本文、structured変更、外部配信を一つのDB transactionとして扱わない。step順序と依存、耐久化した結果、再開条件を持つ。途中まで成功した場合は部分完了とし、再試行は確定済みstepを繰り返さない。取り消しは新しい補償commandとして可能な対象だけに行い、メール/Webhook等の既送信を消したと表示しない。

### 7.2 自動triggerの実行場所

複数端末でtriggerを独立実行しない。structured変更をサーバーへ受理したtransactionでevent/outboxを保存し、server workerがdefinition版＋event IDでExecutionを一意に作る案。端末は同期で受け取った結果を表示する。offlineのユーザー操作は保存・送信待ちを保持し、自動処理は受理後に進むことを明示する。

Buttonのローカル変更を受理した場合もeventは同じoperationを原因に一度だけ作る。未解決Conflictの候補値で自動実行せず、受理した値とConflict解決operationの起動規則をSYNC仕様に定義する。後からdefinitionを追加/変更しても、過去eventの無断再実行をしない。

### 7.3 外部actionと失敗

外部配信はoutboxとstep IDを保持し、Providerが対応する場合は固定idempotency keyを渡す。Providerに冪等性や照会がない場合、送信後応答喪失を完全に一度だけと保証できない。結果不明を表示し、無条件再送で二重メール等を作らない。外部actionごとの再試行/照会/手動判断をProvider仕様へ記録する。

失敗の対象・step・理由・済んだ処理・再開条件を残す。恒久的な型/参照/認可エラーは停止して修復後に明示再開する。一時的な通信エラーは上限付きretry。tokenや本文全体を通常ログへ出さない。実行履歴の共有範囲・保持期間は未決定。

## 8. 設定による利用例

| 利用例 | Button設定の手順 | 固定しない要素 |
| --- | --- | --- |
| 科目→課題 | Task sourceへcreate、title初期値、科目Relation=現在Record、作成Taskを開く | ラベル「課題追加」、科目source、テンプレート |
| 科目→講義ノート | Page/ノートsourceへcreate、科目Relation=現在Record、日時初期値、本文template、結果を開く | ラベル「講義ノート追加」、本文/日時の形式 |
| 案件→対応Task | Task作成、案件Relation、担当者を現在Recordから反映 | source、担当Property、status |
| 顧客→商談記録 | 記録作成、顧客Relation、開始日時=実行時点 | 業務名、入力Property |
| 備品→点検 | 点検Record作成、備品Relation、状態を点検待ちへ | 種別、チェック項目、状態 |
| 状態変更→担当・通知 | Property変更trigger、対象に値/変数を反映、通知 | trigger値、宛先、message |

ボタンでcreateしたRecordは同じexecution resultをRelationや「開く」の対象に使う。名前検索で直近の同名Recordへ関連付けない。通知や外部連携のactionを設定しなければ送信は発生しない。

## 9. 受入条件の案

| ID | 操作・条件 | 期待結果 |
| --- | --- | --- |
| AUTO-01 | 任意sourceでButtonを追加し、create→Relation→結果を開く | 現在Recordへ正しく関連し、Board/Table/詳細のどこでも同じ定義で動く |
| AUTO-02 | 課題/ノート例と案件/点検例を設定だけで作る | 用途固有のschema/actionコードなしで同じ処理を使える |
| AUTO-03 | 実行者/日時/変数/前stepの結果/式で初期値を設定 | 型を検証し、再試行では同じExecutionの確定入力と作成IDを使う |
| AUTO-04 | 確認をキャンセル、または途中確認の前に成功stepがある | 確認後のstepを実行せず、既成功分を取り消したと表示しない |
| AUTO-05 | offline押下→再起動→ACK喪失→再送 | 保存したExecutionを復元し、Record/Relation/本文初期化が重複しない |
| AUTO-06 | 一つのsourceのProperty編集、複数値の追加/除去 | 無関係な値を保持し、同fieldの競合を隠さない |
| AUTO-07 | 複数端末で同じeventを受け、workerも再起動 | event＋definition版の実行は一件。端末pullでは起動しない |
| AUTO-08 | Button createがDB automationを起動、そのautomationが別Recordをcreate | Buttonの変更は起動し、automation由来の変更で連鎖を再起動しない |
| AUTO-09 | any/all・保存ビューfilter・定期triggerを設定 | 許される組合せと判定範囲/時点を示し、未確定の窓を黙って実装しない |
| AUTO-10 | 権限/Property/接続が失効し、処理途中で停止 | 成功stepを保持し、失敗対象と修復/再開を示す。既成功stepを再実行しない |
| AUTO-11 | 外部送信後の応答を失い、冪等性のないProviderを使う | 結果不明とし、無条件再送や虚偽の完了をしない |
| AUTO-12 | 多数対象の編集でlocal replicaが一部のみ取得 | 読み込んだ件数を全対象として処理せず、完全な対象確定後に進む |
| AUTO-13 | 定義/Property名を変更し、実行中に別版を保存 | 安定IDを維持し、既実行は元版で完了。新実行から新定義を使う |
| AUTO-14 | keyboard/タッチで編集/実行、日本語IME中に同期応答 | hoverなしで操作でき、compositionとfocus・選択を維持 |
| AUTO-15 | 個人/共有filterと不可視Recordが混在 | 共有対象の契約と認可を維持し、履歴/候補/通知に不可視値を漏らさない |

これらは将来の受入条件であり、PoCの試験成功や対応完了の証拠ではない。

## 10. 実装前に確定する項目

共通action schema/commandと実行台帳、Yjs＋structuredの途中完了契約、定義版・認可・実行主体、確認/再開/取消、target snapshot、triggerの集約窓とoffline判定、定期実行の欠落/遅延、外部Providerの冪等性/結果照会、実行履歴の保持/公開範囲、初期actionとリリース順を確定する。

実装順の案: 共通command/実行IDと型検証 → 内部create/edit/Relation/変数＋Button → 永続event/outboxとDB trigger → scheduler → 通知/外部Provider。対象機能を取り落とさず段階提供し、外部送信を含むactionは専用の検証と接続設定が整うまで有効化しない。
