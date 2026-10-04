# Greiva UI・横断設計仕様 v0.8

## 1. 目的と適用範囲

本書は、GreivaのUI/UX、画面構造、状態表示、モバイル操作、アクセシビリティ、セキュリティ、運用、リリースの横断設計を定義する。ドメイン・同期・CRDTの基盤要件は`GREIVA_REQUIREMENTS.md`、技術検証の範囲は`POC_SPEC.md`を正本とする。

本書は本番設計のための方針であり、PoCに全項目を実装する指示ではない。PoCの対象は、Editor、local-first、sync、Android/IMEの技術的成立性に限定する。

2026-09-30改訂: 汎用定期予定・時間割登録とCalendar表示を追加。時間割では曜日＋時限を基本にし、時刻の直接指定も可能とする。原則の繰り返しと休講・振替・補講に相当する例外を扱い、大学専用にしないことはユーザーと合意済み。具体的な画面・モデル・受入条件の設計案は`CALENDAR_TIMETABLE_SPEC.md`にまとめる。

同日v0.3改訂: ヘルプページと、機能・エラーに対応する利用案内を追加した。詳細案は`HELP_SUPPORT_SPEC.md`にまとめる。

同日v0.4改訂: 将来の文章・音声によるAI操作を追加した。アプリ内の操作につながる入力・確認・結果の案は`AI_ACTION_SPEC.md`にまとめる。

2026-10-01 v0.5改訂: AI初期提供範囲、共通パネルと各画面の入口、既存音声ファイル取込み、会話履歴の初期30日保存・期間変更・手動削除を一括回答に基づき追加した。元録音の端末内/選択クラウド保存も反映。AI実装やPoC拡張を意味しない。

2026-10-01 v0.6改訂: アプリ内更新の非遮断の検知案内、利用者によるダウンロード、延期と再起動前の確認を追加。保存・署名・復旧の詳細案は`APP_UPDATE_SPEC.md`。未実装でありPoCの範囲を変更しない。

2026-10-01 v0.7改訂: 汎用DBビュー・プロパティ・レコード詳細レイアウトと、Button/automationの製品設計を追加。時間割画像は任意PropertyのGroup/Subgroup・カード表示・共通actionの利用例として扱う。対応目標と受入条件は[DATABASE_SPEC.md](DATABASE_SPEC.md)・[BUTTON_AUTOMATION_SPEC.md](BUTTON_AUTOMATION_SPEC.md)。未実装でありPoCの範囲を拡張しない。

## 2. UX原則

2026-10-04 v0.8改訂: 利用者指定により、UI全体で滑らかさと見た目の整い方を重視する。[共通品質基準](../development/ui-quality.md)に、列を保つ行の並び替え、短い状態遷移、統一した余白／影／focus、reduced motion、入力・選択の保持を記録。PoCの対象や新機能の範囲は変更しない。

1. **保存を意識させない。ただし状態は隠さない。** ローカル保存を標準とし、同期中・offline・エラー・競合だけを明確に見せる。
2. **内容を主役にする。** Page編集の視線を、常時表示されるツール群や装飾で奪わない。
3. **同じ概念は同じ操作で扱う。** Page、Task、Relation、Conflictの用語とアイコンはsurfaceを越えて統一する。
4. **破壊的操作は可逆にする。** 削除はtombstone/Trashを前提にし、Undoまたは復元導線を持つ。
5. **モバイルを縮小版にしない。** Android/iOSではタップ、長押し、ソフトウェアキーボード、Back、background/resumeを主軸に設計する。
6. **不確実性を偽装しない。** 未同期や解決待ちのConflictを「同期済み」「解決済み」と見せない。端末への保存状態は同期・競合解決の状態と別に表示する。
7. **動きと見た目を整える。** 持ったものと移動先が自然に分かる動き、揃った余白・状態差・影を使う。反応を待たせず、入力・選択・IMEを保持し、reduced motionに対応する。

## 3. Information Architecture

初期の上位ナビゲーションは次の概念に限定する。

```text
Workspace
├─ Home                 # 要約・次に行うこと。詳細は要決定
├─ Inbox                # 未処理項目。詳細は要決定
├─ Pages
│  └─ Page Editor
│     └─ DB埋込み / 全画面DB / Record詳細（同じDataSourceを参照）
├─ Tasks
│  ├─ List
│  └─ Task detail
├─ Calendar             # 定期予定・時間割を表示。外部連携と提供時期は要決定
├─ Search
├─ Conflicts            # 同一field競合の解決キュー
├─ Settings
│  ├─ Account / Workspace
│  ├─ Sync & Storage
│  ├─ Integrations
│  └─ Appearance / Accessibility
└─ Help & About         # 補助導線。使い方・FAQ・問題解決・アプリ情報
```

Calendar内に定期予定・時間割の登録、任意の期間/時間帯設定、各回の詳細への導線を設ける。時間割だけのために上位ナビゲーションを増やさない。汎用DBはPage内の埋込みと全画面から同じDataSourceへ到達し、各ビューをtab/一覧で切り替える。Home/Inboxの初期範囲、DB各機能とCalendarの提供時期は未決定であり、仮データや未提供の空画面を本番機能として見せない。

Help & AboutはDesktopのサイドバー下部、MobileのMore等の補助導線へ置く。主要な編集・予定画面のナビゲーションと競合させず、関連する説明には各画面からも移れるようにする。

## 4. 基本レイアウト

### 4.1 Desktop / large tablet

```text
+----------------+-----------------------------------------------+
| Workspace       | Top bar: search / sync status / profile       |
| Home            +-----------------------------------------------+
| Inbox           |                                               |
| Pages           |              Active content area              |
| Tasks           |                                               |
| Calendar        |                                               |
| Conflicts       |                                               |
| Settings        |                                               |
+----------------+-----------------------------------------------+
```

- 左サイドバーはworkspace切替、主要ナビゲーション、最近開いたPage/Taskを扱う。
- コンテンツ領域は一度に一つの主要タスクに集中させる。詳細パネルは必要時のみ右側に開く。
- Top barにはグローバル検索、同期状態、未解決Conflict数、アカウントメニューを置く。
- ウィンドウ幅が不足する場合、サイドバーはicon modeまたはdrawerへ移す。

### 4.2 Mobile

```text
+-----------------------------------+
| Header: back / title / sync state  |
+-----------------------------------+
|                                   |
|            Content                |
|                                   |
+-----------------------------------+
| Home  Pages  Tasks  Search  More   |
+-----------------------------------+
```

- primary navigationはbottom navigation、補助導線はMore/drawerに収める。
- Editor中はbottom navigationの誤タップを避け、必要に応じて最小化する。
- Page/Taskの文脈操作はoverflow menuまたはbottom sheetで提供する。
- 横幅で隠した操作は、キーボードショートカットだけに依存させない。

## 5. 共通UIコンポーネント

`packages/ui`は、単一のデザイントークンと再利用コンポーネントを提供する。アプリごとに色、余白、状態ラベル、確認ダイアログを個別実装しない。

### 5.1 Tokens

- 色: semantic token（`surface`、`text`、`muted`、`border`、`accent`、`danger`、`warning`、`success`）で定義する。
- 文字: 本文、見出し、補助、コードの役割を持つtype scaleを定義する。
- 余白: 4px基準等の一貫したspacing scaleを定義する。
- corner、shadow、focus ring、z-index、motion durationをtoken化する。
- Light / Dark / system設定を提供する。色だけで状態を表現しない。

### 5.2 必須コンポーネント

- Button、IconButton、Link、Menu、Tooltip
- TextField、TextArea、Select、DatePicker、Checkbox、Switch
- Dialog、BottomSheet、Toast、InlineAlert、EmptyState、Skeleton
- List、VirtualList、Table、Tabs、Badge、Avatar
- Page breadcrumb、Task status、Due date、Relation chip、SyncIndicator、ConflictBanner

各コンポーネントはdefault、hover、focus-visible、active、disabled、loading、errorの状態を定義する。

文脈ヘルプの説明ボタン、入力補助、エラー解決リンクは共通コンポーネントとして扱う。重要な説明をTooltipだけへ閉じ込めず、keyboard/タッチでも読める形で提供する。

## 6. Page Editor UI

### 6.1 基本挙動

- Page titleは本文と分離した入力欄として扱い、本文はTiptapのY.Docに保持する。
- 編集ツールバーは常時固定ではなく、選択範囲、slash command、block menuなど文脈に応じて出す。
- Drag handleはpointer環境で表示し、キーボード・タッチ利用者には別経路で「上へ移動」「下へ移動」「indent」「outdent」を提供する。
- Undo/Redoは標準ショートカットに加え、タッチ環境でも見つけられる導線を持つ。
- 長大Pageはvirtualizationを検討対象とするが、selection、IME、Drag & Drop、Yjsの正確性を壊さないことを優先する。

### 6.2 Editor状態

| 状態 | UI | ユーザー操作 |
| --- | --- | --- |
| local saved / synced | 控えめな「保存済み」 | 通常編集 |
| local saved / syncing | 「同期中」spinner | 編集継続可 |
| offline | 「オフライン・端末に保存済み」 | 編集継続可 |
| sync retrying | 「同期を再試行中」 | 編集継続可、詳細表示可 |
| local storage error | 明確な危険表示 | コピー/書き出し等の保全導線、診断表示 |
| remote permission error | 権限エラー | 再試行ではなく権限確認導線 |

「同期済み」は、ローカル永続化と、該当データのサーバー反映が確認できた場合にのみ表示する。offlineでの変更は「端末に保存済み」と表示し、「同期済み」とは表示しない。

2026-10-01のユーザー判断（A）: 入力は即座に反映し、「保存中」と保存完了を区別する。保存済みと表示した全変更は強制終了後も復元する。保存完了前の強制終了では未保存の入力が失われる可能性を、hoverだけに依存しない説明で示す。同期前でも端末保存済みの変更は保持する。保存待ち時間を改善しても、この境界を曖昧にしない。

### 6.3 日本語IMEとモバイル入力

- composition中は選択・カーソル位置・未確定文字を尊重する。
- リモート更新が届いても、compositionを強制確定、二重挿入、意図しないselection解除を起こさない。
- Androidではsoftware keyboard表示時に、入力位置が隠れないようviewportを調整する。
- Back gestureは、まず開いているmenu/sheet/dialogを閉じ、編集内容を破棄しない。
- Copy/Paste、long press selection、scroll、dragを実機で確認する。

## 7. Task / Relation UI

### 7.1 Task

- title、status、due、関連Relationを最小表示・編集できる。
- status更新は即時ローカル反映し、同期失敗時もユーザーが変更を失わない。
- dueの入力は日付の意味を明示する。時刻・タイムゾーンの導入は要決定であり、日付のみモデルを勝手にdatetimeへ変えない。
- 削除は確認またはUndo toastを持ち、同期確定前後を問わずtombstone復元が可能であること。

### 7.2 Relation

- Relationはfrom/to entityを明示し、循環・自己参照の可否は`DATA_MODEL.md`で決定する。
- Page内Mentionと構造化Relationは同一とは限らない。表示上のリンクと、同期対象のRelation entityを混同しない。
- Relation削除はUI上で明示確認し、削除後に復元可能な導線を持つ。

### 7.3 Calendar / 定期予定・時間割

- Calendar内の週表示を主な時間割確認導線とし、曜日に対する時刻と、設定済みの「1限」「早番」等を併記できる。通常予定との位置関係は実時刻に基づく。
- 登録では予定名、繰り返す曜日、時限/時間帯または開始・終了時刻を入力する。学期・授業固有の属性は必要時だけ提示し、汎用予定に入力を強制しない。
- 通常の繰り返し設定と、一回だけの取消・振替・追加を識別する。表示名は大学用の「休講」「補講」と汎用の「取消」「追加開催」を同じ操作モデルへ対応させる。
- 定期予定の変更範囲は「この回だけ／この回以降／全体」の3択とし、「この回以降」では過去の予定を保持する。既存の休講・振替への影響は確定前に表示する。Drag & Dropは一回の変更として扱い、繰り返し全体を無断で書き換えない。
- 既存例外は、維持する引き継ぎ案を初期選択にした確認一覧を表示する。休講は対応先へ引き継ぎ、振替先の日時は保持する。各案を修正でき、対応が不明な例外は要確認として個別に解決してから確定する。
- 休講/取消、振替/変更、補講/追加は文言またはbadgeで示す。予定の重複と同期Conflictを別の状態として表示する。
- Desktopでは詳細パネル、Mobileでは日別agendaとbottom sheetを利用する設計案とする。日付・予定の選択と編集はkeyboard/タッチで到達可能にし、細いCalendar枠のDragだけに依存させない。
- 詳細案・境界・受入条件は`CALENDAR_TIMETABLE_SPEC.md`を参照する。Page/Taskの期日モデルやPoCの同期DTOをこの設計追加だけで変更しない。

### 7.4 汎用データベース・ビュー・プロパティ

- NotionのTable/Board/Timeline/Calendar/List/Gallery/Chart/Form/Feed/Map/DashboardとRecord詳細のLayoutsを対応目標とし、共通データ・独立したビュー設定・型付きPropertyを使う。詳細は`DATABASE_SPEC.md`。
- ビューtab、filter/sort/group/subgroup、表示Property、カード密度/preview、右パネル/中央preview/全画面を設定できる。詳細から戻る際は元のscroll・選択・focusを復元する。
- Boardの横Groupと縦Subgroupは任意の対応Propertyから選び、空/未設定・複数カード・複数値を扱う。Drag以外の分類変更を提供し、両軸変更は一つの操作で検証する。
- Propertyの型別入力、選択肢/色/順序、Relationの候補、Formulaの補完/型エラー、Rollupの集計を共通editorで扱う。名前変更と型変換を区別し、依存設定や変換不能値を保全する。
- レコード詳細は固定表示Property・セクション・本文・詳細パネル・現在Recordに絞った関連ビューtabを設定できる。カードの表示設定と独立させ、配置のリセットでデータを消さない。
- 時間割は「曜日×時限」「区分/場所/期間表示」の設定例とする。同じ機能で「担当者×優先度」「状態×部署」等を作れる。予定の原則とCalendar上の実際の回は識別し、例外・変更範囲を迂回しない。

### 7.5 ボタン・データベースオートメーション

- Buttonはlabel/icon、action列、参照/式/変数、確認を利用者が設定し、カード/表/詳細から実行する。用途固有の作成ボタンを中核へ固定しない。
- 共通action editorでcreate、Property編集、複数対象編集、Relation、変数、確認/開く、通知/外部action等の対応範囲を設定する。Page buttonの本文挿入はYjs commandへ接続する。
- automationは対象source/保存ビュー、追加/Property変更/定期trigger、any/all、有効/停止、action、実行履歴を扱う。Buttonと自動triggerは同じ処理定義・検証を使う。
- previewは対象と変更内容を表示し、実行しない。現在Record・静的参照・作成結果・実行者・日時を入力候補で見分けられるようにする。
- 実行中、端末保存済み、実行待ち、完了、部分完了、失敗、結果不明を区別し、既成功のstepと次の対処を示す。再試行で新しい作成や送信を無条件に繰り返さない。
- Buttonを押す/設定する権限、データ編集、外部接続を分ける。key/タッチから操作でき、同期応答でfocusや日本語IMEを奪わない。詳細案と受入条件は`BUTTON_AUTOMATION_SPEC.md`。

## 8. 同期・Conflict UI

### 8.1 Sync center

設定配下にSync & Storage画面を置き、以下を確認できるようにする。

- 現在の接続状態、最終同期時刻、pending operation数
- ローカル保存エラー、再試行中エラー、権限エラー
- 手動再試行、診断情報のコピー、サポート用ログのエクスポート
- ローカルデータの消去や再初期化は、復旧可能性と影響を明示してから実行する

同期の再試行は自動で行うが、指数backoffと上限を持つ。無限再試行の表示や電池・通信の浪費を許容しない。

### 8.2 Conflict center

- 未解決ConflictはナビゲーションbadgeとConflict一覧で示す。
- 各Conflictはentity、field、発生元、base/local/remote、発生時刻、同期状況を表示する。
- ユーザーはlocal、remote、または編集した新しい値を選べる。
- 解決は新しいoperationとして記録し、いつでも監査できる。
- 解決済みの履歴は閲覧可能とし、勝手に古い候補を消さない。

```text
Status conflict

Before: Todo
This device: Done
Other device: Cancelled

[Use Done] [Use Cancelled] [Edit value]
```

## 9. 検索・Command設計

検索は将来の主要横断導線であり、CRDT JSON Projection/plain textを利用できる。初期機能範囲は要決定だが、以下の境界を守る。

- 検索indexはY.Doc binaryの正本を置き換えない。
- 検索結果からPage、Task、Relationの識別可能なプレビューを提供する。
- アクセス権のないworkspace/resourceを検索結果へ含めない。
- グローバルcommand paletteはdesktopの効率化として提供可能だが、モバイルや支援技術利用者の唯一の導線にしない。

### 9.1 ヘルプ・利用案内

- ヘルプには専用検索、目的別カテゴリ、FAQ、ショートカット一覧を設ける。検索対象はヘルプ記事であり、Page/Task本文を読み取る経路にしない。
- 文脈ヘルプは、現在の画面・操作・エラーに対応した記事へ直接移る。Desktopでは並行して読めるパネル、Mobileでは戻り先を保持する記事画面/sheetを使う案とする。
- ヘルプを開いて戻っても、未確定のフォーム、Editorの入力内容、選択・表示位置を失わない。自動案内はフォーカスを奪わず、IME composition中には開始しない。
- 初回案内は短く、スキップ・再表示が可能にする。空状態は最初の操作と対応ガイドを提示する。模擬操作は利用者の実データと分ける。
- アプリに同梱する説明はofflineでも使え、現在の版と提供中の機能に適合させる。未提供の機能へ操作を促す記事や、実体のない問い合わせボタンを表示しない。
- 同期・保存・権限エラーには、安全に確認できる手順と実行可能な次の操作を示す。診断情報は既存のredaction・内容確認の方針に従う。
- 情報構造・記事の管理・受入条件は`HELP_SUPPORT_SPEC.md`を参照する。

### 9.2 将来のAI・文章/音声操作

- 文章・音声からPage作成、Task・予定登録等を行う入口をアプリ内に設ける案とする。通常UIと同じ操作・権限・保存・同期の経路を使う。
- AI初期提供は作成・登録・録音整理とする。既存編集・削除・検索は後続段階で追加し、未提供の操作は通常画面へ案内する。必要な現在の対象・関連データの参照は初期段階でも利用する。
- 共通AIパネルと各画面の文脈に応じた入口を併用する。入口を切り替えても下書き・処理・結果を引き継ぎ、使用する対象を明示する案とする。別画面への移動で対象を黙って変更しない。
- 音声入力元はアプリ内録音と既存ファイルの取込みを用意する。取込みだけではマイク権限を求めず、元ファイルを保ったアプリ管理下のコピーを扱う。取込み日時を録音日時として扱わない。
- 入力、音声認識中、解釈中、情報不足、操作案、実行中、保存/同期待ち、成功/部分失敗を区別する。音声の認識結果を訂正でき、曖昧な対象・日時は質問できる。
- 音声は短い指示と長い会議/講義の録音を扱う。長い録音ではPage作成・Task/予定候補の抽出、処理状態と元の発言に戻れる導線を設計する。候補一覧から登録したいものを選び、一括登録する。内容を訂正でき、選択した各候補の実結果を示す案とする。候補保持・処理上限等は後続の回答で決める。
- 録音から作るPageは、要点を整理したノートと、初期状態で折りたたんだ全文文字起こしを持つ。両者をラベルで区別し、全文を開閉・確認・訂正できるようにする。候補の根拠から対応する発言箇所へ移れる導線を設計する。
- 元録音の保存期間は初期30日で変更できる。保持期限・削除状態を確認できる導線を設計し、期限後もPageと全文を残す。音声が削除された場合は再生/再認識の利用可否を示す。保存形式・期限の適用等の詳細は後続設計で決める。
- 元録音は端末内を基本にし、必要な録音だけ選んでアプリのクラウドへ保存できる。端末限定・アップロード中・クラウド保存済み等を示し、他端末での再生可否を区別する。Page同期とProviderへの処理用送信は別の状態/設定として扱う。
- 新規作成は直接実行し、作成内容・具体的な日時・保存先と結果への導線を示す。既存変更・削除は対象、変更前後・件数、変更範囲・影響を示して確認後に実行する。曖昧な情報は先に質問し、確認画面は修正・中止ができる。
- 結果は実際の実行・保存状態に対応し、作成したPage/Task/予定へ移れるようにする。生成した文章を実行成功の表示にしない。
- AIは現在のPage・予定と、関連するノート/Taskを参照できる。参照した対象を確認できる一覧等を設ける案とし、対象を黙って切り替えず、関連先の読み取り権限も検証する。
- 初回設定で外部送信先とデータ種別を示して許可を得る。許可範囲内では毎回の送信確認を省略でき、後から変更・解除できる。範囲を広げる場合は追加の許可を得る。既存変更・削除の実行確認とは区別する。
- AI会話履歴は初期30日保存とし、期間変更と手動削除を用意する。元録音の設定とは区別し、履歴削除で作成データや登録結果を消さない。履歴を開き直しても操作を自動再実行しない。
- AIと音声は既存の入力・keyboard・タッチ操作、EditorのIMEを妨げない。入口の具体的な配置、送信設定の保存・同期、関連参照の深さ・上限、履歴の保存先・同期・期限適用と復元、対応音声形式・処理上限、platformごとの提供は後続設計で決める。
- 詳細案と受入条件は`AI_ACTION_SPEC.md`を参照する。

## 10. アクセシビリティと国際化

- WCAG 2.2 AAを初期目標とする。実現不可能なEditor固有の制約は例外理由と代替操作を記録する。
- すべての操作はkeyboardで到達・実行でき、focus-visibleを失わない。
- Dialog、Menu、BottomSheetはfocus trap、閉じた後のfocus復帰、Escape/Backの扱いを持つ。
- icon-only操作にはaccessible nameを付与する。
- エラー、同期状態、Conflictは色以外に文言・icon・ARIA live regionで伝える。
- UI文言と日付/時刻表示はlocale対応可能な設計とし、初期ロケールと翻訳運用は要決定とする。

## 11. セキュリティ・プライバシー設計

### 11.1 クライアント

- access token、refresh token、Provider tokenをUIログ、crash report、operation payload、search indexへ平文保存しない。
- ローカルDBの暗号化、OS keystore利用、端末共有時の再認証方針は初期リリース前に要決定とする。
- diagnostics exportは秘密情報をredactし、ユーザーが内容と送信先を確認できるようにする。

### 11.2 サーバー

- APIとHocuspocus接続は認証済みユーザーとworkspace contextを必須とする（PoCの無認証は本番へ継承しない）。
- resourceごとにworkspace membershipとroleを検証する。
- PostgreSQL/Supabase Row Level Securityだけに依存せず、API/application層でも認可を検証する。
- audit対象、保持期間、削除要求、backupの扱いを`AUTHZ_SPEC.md`および運用仕様で確定する。

## 12. 運用・可観測性設計

### 12.1 構造化ログ

少なくとも以下の相関IDを持つ構造化ログを出す。

- request ID、operation ID、client ID、workspace ID、entity ID、Y.Doc ID
- API/Hocuspocus instance ID、cursor、retry回数、エラー種別

本文、token、個人情報、Yjs binary全体を通常ログへ出力しない。

### 12.2 Metrics / alert

- sync success/failure/retry、pending operation数、cursor lag
- idempotency hit、Conflict生成/解決、Yjs reconnect、snapshot/compaction
- API latency/error rate、Hocuspocus connection数、DB/storage error
- mobile crash、local storage recovery failure

閾値、通知先、on-call、SLOは運用開始前に要決定とする。PoCでは計測点の妥当性を優先する。

### 12.3 Backup / restore / migration

- PostgreSQL、CRDT binary、Object Storageのbackup対象と復元手順を定義する。
- DB migrationとY.Doc schema versionを独立管理し、upgrade/downgrade方針を持つ。
- snapshot compaction前後の復元試験を自動化する。
- 端末ローカルDB migration失敗時は、破壊的な自動初期化を行わず、保全と復旧の選択肢を提示する。

## 13. リリース・品質ゲート

### 13.1 環境

`local`、`development`、`staging`、`production`を分ける。stagingでは、最低限API、PostgreSQL、Hocuspocus、認証、migrationをproduction相当の結合で検証する。

### 13.2 CI

Pull Requestごとに以下を実行する。

- format / lint / typecheck
- unit / integration
- protocol compatibility test
- sync simulation
- Playwright（Chromium、Firefox、WebKit）
- migration検証
- 依存関係・秘密情報・ライセンスの検査（具体ツールは要決定）

Android、Windows desktop、macOS/iOS実機はCI対象またはrelease candidate検証として明示的に運用する。未実行ならrelease判定で可視化する。

### 13.3 Feature flagとrollout

- Google Calendar、AI、automation、実験的Editor extension等はfeature flagで段階公開できるようにする。
- flagは認可の代替に使わない。
- rollbackはDB/CRDTの互換性を壊さないこと。不可逆migrationを伴う場合は別途roll-forward手順を用意する。

### 13.4 アプリ内更新

起動時・定期的に更新を確認し、作業を遮らない案内と設定の「アプリについて／更新」へつなぐ。ダウンロードは利用者が開始し、取得後は「今すぐ更新／後で」を選ぶ。終了・再起動の確認と端末保存完了をinstaller呼び出し前に済ませ、未送信の変更を保持する。

確認中・更新なし・更新あり・取得中・検証済み・保存待ち・導入中・失敗を区別する。offlineや確認失敗を「最新」と扱わず、IME composition中のfocusを奪わない。署名、配布物の公開、schema/protocol互換性、復旧、受入条件は`APP_UPDATE_SPEC.md`で整理する。製品設計の追加であり、現在のPoCの検証順序は変更しない。

## 14. 未決定事項と次の仕様化順序

次の順で詳細仕様を作成する。

1. `DATA_MODEL.md` と `SYNC_SPEC.md`（Conflict entityを含む）
2. `EDITOR_SPEC.md`（block schema、IME、accessibility、mobile gesture）
3. `AUTHZ_SPEC.md`（workspace/role/RLS/共有）
4. `CALENDAR_TIMETABLE_SPEC.md`（定期予定・時間割の追加要求と詳細案。提供時期は要決定）と`HOME_INBOX_CALENDAR_SPEC.md`（主画面全体の初期リリース範囲）
5. `HELP_SUPPORT_SPEC.md`（ヘルプ・文脈案内・記事管理と受入条件）
6. `SEARCH_SPEC.md` と `INTEGRATION_SPEC.md`
7. `AI_ACTION_SPEC.md`（将来の文章/音声操作、共通command、確認・参照範囲と受入条件）
8. `APP_UPDATE_SPEC.md`（利用者が開始する取得・導入、保存/再起動、署名・配布・復旧）
9. `DATABASE_SPEC.md`・`BUTTON_AUTOMATION_SPEC.md`（Notion対応目標、汎用View/Property、共通actionと実行/triggerの詳細契約）
10. 運用SLO、backup、privacy、release checklist

ここにない具体UI、色、ブランド、画面ごとの優先順位は要決定である。実装者はプレースホルダーを恒久仕様として扱わず、wireframe・利用者シナリオ・受入条件を提示して決定を得る。
