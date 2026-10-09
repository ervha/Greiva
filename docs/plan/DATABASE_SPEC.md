# 汎用データベース・ビュー・プロパティ 設計案 v0.1

2026-10-09 / v0.63.0：[Record実HTTP送信](../development/PRIVATE_DATABASE_RECORD_WRITE.md)でtyped原capture/wire/ACKをcaptured Authへ接続する。native15/server11保持。画面用runtime・View queue・6型Table/Listと本書の全受入は後続。

2026-10-09 / v0.62.0：[Record更新・競合解決queue](../development/PRIVATE_DATABASE_RECORD_UPDATE_QUEUE.md)で確認済みbase/元候補・busy・原ACK原子確認とnative15を追加する。server11保持。View queue・Record HTTP/runtime・Table/List画面と本書の全受入は後続。

更新: 2026-10-01。製品の追加要求と実装前の詳細案。現在のPoCに実装済みの機能を示す文書ではない。

2026-10-08 / v0.41.0：[基本DB基盤](../development/BASIC_DATABASE_FOUNDATION.md)として6型のSource/Record検証とTable/Listのlocal queryを部分実装する。plain Text/date-onlyの初期subsetで、物理保存・同期・DB操作画面・全ビュー/型・本書の全受入は未完了。[証拠](../../tests/evidence/basic-database-foundation-20261008/SUMMARY.md)。

2026-10-08 / v0.43.0：利用者回答AによりName/Text/Number/Checkbox/Select/DateとTable/Listを初期範囲へ確定。[保護Source保存](../development/PRIVATE_DATABASE_SOURCE.md)で作成/取得/bounded catalogを実装する。Record/View保存、端末DB同期、Table/List操作画面と全受入は次工程。型/queryだけを実保存やビュー完成へ昇格しない。

2026-10-08 / v0.44.0：[Record保存/競合](../development/PRIVATE_DATABASE_RECORD.md)で既存Page-bound create/update、historyとimmutable operation、三値候補/新操作解決、bounded readを部分実装する。schema7/native8。Record一覧/View保存、端末DB同期、Table/List画面と全DB受入は次工程。

2026-10-09 / v0.45.0：[Record header一覧](../development/PRIVATE_DATABASE_RECORD_CATALOG.md)で明示schema8、max100/固定creation範囲/HMAC/raw進捗を追加。内容やNameは別に取得し、変更受信/全同期とは扱わない。View/端末DB/Table/List画面は次工程。

2026-10-09 / v0.46.0：[View設定intent/merge](../development/BASIC_DATABASE_VIEW_MUTATION.md)を追加。name/layout/visiblePropertyIds/filter/sortsをSource-boundで検証し、別field保持・同field三値と新intent解決を計画する。pure契約でactual View保存/同期/UIは未実装。server8/native8保持。

2026-10-09 / v0.47.0：[View設定保存](../development/PRIVATE_DATABASE_VIEW.md)をactual PGへ接続。明示server9/current/history/三値候補/new解決/immutable結果、bounded候補readを追加。Source/Record/Pageは複製せずnative8を保持する。View一覧/Record受信/端末DB/Table/List画面は後続。

2026-10-09 / v0.48.0：[View header一覧](../development/PRIVATE_DATABASE_VIEW_CATALOG.md)を追加。max100/current name/layout/version、gdv1で固定creation範囲とraw進捗、明示server10のID seed/atomic位置。設定全体や変更受信/同期完了とは扱わず、native8を保持する。Record/View受信・端末DB/Table/List操作画面は後続。

2026-10-09 / v0.49.0：[DB変更packet/cursor契約](../development/PRIVATE_DATABASE_CHANGES_CONTRACT.md)でtyped Record/View snapshot/候補解決状態、Source-bound検証、bounded raw進捗/gdb1を追加。server10/native8保持。actual journal/schema11/API/端末適用と画面は後続。

2026-10-09 / v0.50.0：[DB変更履歴/取得](../development/PRIVATE_DATABASE_CHANGES.md)で明示server11、永続Source journal/current・候補seed、atomic追記、認証付きbounded差分APIを追加。native8保持。端末DB適用/queue/runtime/Table/List画面は後続。

2026-10-09 / v0.51.0：[Source端末保存](../development/PRIVATE_DATABASE_SOURCE_CACHE.md)でnative9/current/履歴/read receiptの原子保存、late reply保護、6型/strict IPCとbounded端末一覧を追加。server11保持。Record/View replica/queue/DB cursor/runtime、Table/List画面は後続。

2026-10-09 / v0.61.0：[Record作成端末queue](../development/PRIVATE_DATABASE_RECORD_CREATE_QUEUE.md)でSource/Page未送信からtyped intentを保持し、確認後に元wireを固定する。原create ACK/cache/history原子確認、read/deltaとの区別、native14移行を追加する。server11保持。update/View queue・HTTP/runtime・Table/Listは後続。

2026-10-09 / v0.60.0：[DB作成送信/状態管理](../development/PRIVATE_DATABASE_SOURCE_WRITE.md)でnative queue→captured Auth HTTP→原ACKへ接続。offline enqueue・結果不明の同操作retry・pending-only一覧/catalogFresh・遅着除外を追加。server11/native13保持。Record/View操作queueとTable/List画面は後続。

2026-10-09 / v0.59.0：[DB作成queue](../development/PRIVATE_DATABASE_SOURCE_QUEUE.md)でpending定義・元wire/checksum・原ACKとcache/historyをnative13へ保存する。readでqueueを清算せず、作成HTTP/runtime・Record/View queue・Table/List画面へ続行。[証拠](../../tests/evidence/private-database-source-queue-20261009/SUMMARY.md)。

2026-10-09 / v0.58.0：[DB差分runtime](../development/PRIVATE_DATABASE_CHANGES_RUNTIME.md)で端末進捗/明示取得/unknown再確認/取消を画面用状態へ接続する。observedHeadを全DB同期やqueue ACKと分け、作成更新queueとTable/List画面へ続行。[証拠](../../tests/evidence/private-database-changes-runtime-20261009/SUMMARY.md)。

2026-10-09 / v0.57.0：[DB差分取得session](../development/PRIVATE_DATABASE_CHANGES_SESSION.md)で認証付きbounded pull→native deltaを接続する。durable進捗・結果不明の同応答retry・保存後cursor・取消を検証し、全DB同期/作成更新queue/Table/List画面の完成と分ける。[証拠](../../tests/evidence/private-database-changes-session-20261009/SUMMARY.md)。

2026-10-09 / v0.56.0：[DB差分端末保存](../development/PRIVATE_DATABASE_CHANGES_STORE.md)でnative12、元window/event・Record/View履歴・候補/解決・cursorを原子保存。server11保持。差分HTTP/runtime、作成/更新queueと画面は後続。

2026-10-09 / v0.55.0：[DB内容取得session](../development/PRIVATE_DATABASE_CONTENT_SESSION.md)でcaptured Source/AuthのRecord/View read→native cache、headers catalog、結果不明の同応答retryと世代取消を接続。server11/native11保持。差分cursor/queue/画面は後続。

2026-10-09 / v0.54.0：[View端末保存](../development/PRIVATE_DATABASE_VIEW_CACHE.md)でnative11のtyped Table/List設定、whole-field既知候補、履歴/receipt/currentとbounded headersを追加。server11保持。差分cursor/queue/runtime/画面は後続。

2026-10-09 / v0.53.0：[Record端末保存](../development/PRIVATE_DATABASE_RECORD_CACHE.md)でnative10のsnapshot/history/receipt/既知候補、bounded local読取と遅着履歴照合を追加。server11保持。View replica/差分cursor/queue/runtime/画面は後続。

2026-10-09 / v0.52.0：[Source取得session](../development/PRIVATE_DATABASE_SOURCE_SESSION.md)でcaptured Auth/明示catalog・readを端末cacheへ接続し、unknown commitの同応答再保存と世代取消を追加。server11/native9保持。Source作成/Record/View queue、内容replica/DB cursorとTable/List画面は後続。

## 1. 要求と適用範囲

ユーザー指定:

- Notionで利用できるデータベースのレイアウトビューとプロパティを基本すべて提供対象にする。Greivaへ適合させつつ、元の機能・意味・操作をできる限り維持する。
- 提示された時間割は利用例の一つ。汎用的な仕様として実装し、曜日・時限・大学・課題・講義ノートを中核の固定項目や固定ボタンにしない。
- 任意のプロパティによる縦横のグループ化、カード表示項目、関連データの作成、ボタンプロパティと押下時の処理設定を扱う。

本書の具体的な論理モデル・操作契約・受入条件は設計案である。提供時期とリリース単位は未決定。ビューやプロパティを一部だけ実装して全対応と表示しない。PoCのTask/Relation最小モデルをこの文書だけで汎用DBへ置換せず、[POC_SPEC.md](POC_SPEC.md) Section 18の順序・範囲・Gateを維持する。

基盤は[統合要件](GREIVA_REQUIREMENTS.md)、UIは[横断設計](GREIVA_DESIGN_SPEC.md)、ボタン・自動処理は[BUTTON_AUTOMATION_SPEC.md](BUTTON_AUTOMATION_SPEC.md)、日時規則は[Calendar設計](CALENDAR_TIMETABLE_SPEC.md)に従う。

## 2. 互換性の基準

2026-10-01に確認したNotion公式Helpを比較基準とする。以下は機能互換を目指す製品要求であり、Notionとの接続・テンプレート取込み・API互換・移行結果を保証する契約ではない。取込みが必要になった場合は形式と損失を個別仕様にする。

対応表には機能単位で「要求／設計済み／実装済み／検証済み／差異／未決定」を分けて記録する。上記の初期基盤以外は要求・設計段階であり、実装済み・検証済みではない。元仕様の制限を緩める場合も差異として記録する。Notion側の課金プランは機能調査の条件であり、Greivaの料金体系の決定ではない。

公式の[ビュー一覧](https://www.notion.com/help/category/database-views/all)には従来のTable等に加え、Feed、Map、Dashboard、FormsとレコードページのLayoutsがある。ビューとレコードページのレイアウトは別の設定として扱う。

## 3. 論理モデルと正本の案

| 概念 | 責務 |
| --- | --- |
| Database | 名前・配置・ビューをまとめる利用者向けの入口。Page内の埋込みと全画面表示が同じ内容を参照する |
| DataSource | レコード集合とプロパティ定義の所有境界。参照ビューから編集しても同じ正本を変更する |
| Record | 安定ID、DataSource ID、Page ID、version、tombstone、作成/変更記録を持つ項目 |
| PropertyDefinition | 安定ID、名前、型、型別設定、選択肢、参照先、算出定義、schema version |
| PropertyValue | Record ID＋Property IDに対応する型付き値。表示文字列を正本にしない |
| ViewDefinition | DataSource参照、レイアウト、filter/sort/group/subgroup、表示項目、カード・日時・地図等の設定 |
| RecordLayout | レコード詳細の見出し、固定表示項目、セクション、本文、詳細パネル、関連ビュータブの配置 |
| DerivedValue | Formula/Rollup・集計等の再生成可能な値。評価エラーと鮮度を含む |

DataSourceを新規作成する操作と、既存DataSourceを参照する操作を区別する。一つのDatabase内で複数DataSourceを選択・参照できる境界を設けるが、異なるschemaのレコードを無条件で一つの表へ混ぜない。具体的な複数sourceの表示契約は実装前に確定する。

Recordの本文はPageのY.Docを参照する。プロパティ・定義・ビュー・Relationはstructured syncを用いる。Task/Scheduleの専用画面とDBビューを併用する場合は、同じentityを参照するbindingを定義する。コピーしたTaskや予定を別の正本にせず、Task due、開催日時、任意のDateプロパティの意味を区別する。

この表は物理schemaの決定ではない。型付き値の格納、索引、検索、権限、汎用Recordと既存entityのbindingを後続のDATA_MODEL/SYNC仕様で確定する。PoCの既存Task/Relationを早期にEAV化しない。

## 4. ビューの提供対象

下表はNotionの各ビューを基準にしたGreivaの対応目標。Greiva独自の追加挙動は後続節で示す。

| ビュー | 維持する中心機能 | Greivaでの設計・検証対象 |
| --- | --- | --- |
| Table | レコードを行、プロパティを列として編集 | 列の順序/幅/表示/固定、セル編集、複数行操作、型に応じた集計 |
| Board | 任意プロパティによる列とサブグループ | 縦横の分類、空グループ、折りたたみ、順序、カードの移動・表示項目・ボタン |
| Timeline | 日付範囲を期間として表示 | date/rangeの選択、時間スケール、期間変更、グループ、補助の表、依存関係の表示契約 |
| Calendar | 選んだDateに基づく配置 | 月/週等の表示、日付移動、未設定項目。Greivaの実開催日時Projectionと接続する場合は第8節 |
| List | 簡潔な項目一覧 | 表示プロパティ、並べ替え、グループ、詳細を開く導線 |
| Gallery | 画像・本文プレビューを中心としたカード | cover/本文/Filesの選択、サイズ、fit、表示項目、画像なし/未取得状態 |
| Chart | 集計の可視化 | 縦棒/横棒/折れ線/ドーナツ/数値、軸・集計・内訳、凡例、drilldown、PNG/SVG出力 |
| Form | 質問への回答をDBレコードへ登録 | 型との対応、必須/説明/選択肢、条件付き質問、内部回答。公開回答は認可・配信仕様に従う |
| Feed | 投稿状の縦並びカード | 表示項目と本文、コメント・閲覧数の対応境界、レコード詳細へ戻る導線 |
| Map | Placeプロパティによる地図上の配置 | 場所選択、pin・詳細、pan/zoom、位置未設定一覧、表示範囲と件数制限の明示 |
| Dashboard | 複数ビューをwidgetとして配置 | 複数source、幅/高さ/並び、閲覧と編集の分離、共通filter、各widgetの認可 |

詳細基準: [Board](https://www.notion.com/en-gb/help/boards)、[Chart](https://www.notion.com/help/charts)、[Forms](https://www.notion.com/help/forms)、[Feed](https://www.notion.com/help/feeds)、[Map](https://www.notion.com/help/maps)、[Dashboard](https://www.notion.com/help/dashboards)。Table/Timeline/Calendar/List/Galleryの設定の網羅性は各公式Helpと項目別に照合してから実装ゲートを確定する。

### 4.1 共通の設定と操作

[Notionのビュー設定](https://www.notion.com/help/views-filters-and-sorts)の独立性を維持する。ビューごとに名前、icon、型、プロパティの表示/順序、filter、複数sort、group/subgroup、開き方を保持する。ビューの作成・複製・名前変更・順序変更・削除・直接リンクを提供する。ビュー削除やレイアウト変更でレコードを削除しない。

- filterは型に適した演算子とAND/ORの入れ子を扱い、少なくとも元仕様の3階層を表現できる。相対日付のtimezone・週境界は設定に保持する。
- 共有ビューの保存と個人の一時的なfilter/sortを区別する。個人の操作で他の利用者の表示を黙って変えない。
- 明示sortと手動順序を区別する。sortが有効な際のDragは、分類値の変更と並び変更の可否を別々に案内する。
- レコードは右パネル、中央preview、全画面から開ける。戻る際は元ビューのfilter・scroll・選択・focusを復元する。
- filter結果が0件、元データ0件、未取得、権限なし、評価エラーを区別する。非表示を削除扱いにしない。
- 表示項目を隠す操作は認可ではない。集計、候補検索、画像、Relation、drilldownにも認可を適用する。
- 参照するDataSource・Propertyが削除/非互換変更された場合、設定と入力を残して修復対象を示す。別プロパティへの無断置換をしない。

### 4.2 集計・複合表示・外部依存

Chartの集計は認可・filter後の対象に対して行い、読み込んだ1ページだけを全件の集計として表示しない。集計結果から対象レコードへ移れるが、グラフ要素自体を編集セルにしない。元仕様の数値Chartも対象とし、単に棒/折れ線だけで対応完了としない。

Dashboardの共通filterはProperty IDと型が対応したwidgetに適用する。名前だけ同じ別sourceの項目を自動対応させない。対応しないwidgetとfilterの効く範囲を示す。widgetの並べ替えと、元ビュー定義の編集を分ける。

Formの送信IDは再試行で固定し、offline回答の端末保存とサーバー受領を区別する。公開フォーム、Feedの共有コメント/閲覧数、地図背景/住所検索は通信・認可・Providerを必要とする部分を明示する。offlineの保存済み値/投稿を閲覧できても、外部取得や公開送信の成功とは表示しない。

Notionの確認時の制限例はMapで同時に100pin、Chartで200group/50subgroup、Dashboardで12widget/1行4widget。Greivaの上限は性能試験とUIから決定し、無限表示や超過分の無言切捨てを約束しない。契約する差異は対応表へ残す。

## 5. プロパティの提供対象

[Notionのプロパティ一覧](https://www.notion.com/help/database-properties)と、[Formulaの型・構文](https://www.notion.com/en-gb/help/formula-syntax)を基準とする。Name/Titleはレコードを識別する必須プロパティで、表示名の変更と内容の変更を分ける。

| 型 | 値と設定の対応目標 |
| --- | --- |
| Name / Title | 各Recordのタイトル。Pageのタイトルとbindingする場合は同じ正本を編集 |
| Text | 書式付き文字列、改行、リンク。本文全体の代わりにしない |
| Number | 数値、桁数、数値/通貨/割合、progress bar/ring等の表示設定。表示書式と数値を分離 |
| Select | 安定option IDによる単一選択、名前・色・順序 |
| Status | 未着手/進行中/完了の分類と、利用者定義の状態・順序 |
| Multi-select | 複数option ID。追加/除去/置換の操作を区別 |
| Date | date-onlyまたは日時、任意の終了/範囲、timezone、表示形式、reminder設定 |
| Person | Workspace内の利用者/グループ参照、複数選択と表示。未登録の任意文字列を認証済み利用者にしない |
| Files & media | 複数の添付/URL、名前、順序、preview。端末保存・upload待ち・取得不可を区別 |
| Checkbox | Boolean。未設定からfalseへの変換規則を明示 |
| URL | 元のURLと表示、外部を開く導線、無効値の訂正 |
| Email | アドレスとメール作成導線。値編集だけで送信しない |
| Phone | 電話番号の元表記と発信導線。端末が対応しない場合はコピーできる |
| Formula | 数式定義と型付き算出値。式の編集、入力補完、型/構文エラー、preview |
| Relation | 別source/同sourceのRecord参照、単方向/双方向、1件/複数の制約、関連先の表示項目 |
| Rollup | Relation＋対象Property＋集計方法。元値/一意値、count、数値・日付・割合等の型適合する集計 |
| Created time / Created by | 作成記録。自動生成、直接編集不可 |
| Last edited time / Last edited by | 実際の内容変更に対応する記録。自動生成、直接編集不可 |
| Button | ラベル/iconと共通action定義への参照。レコード文脈で実行するUI |
| ID / Unique ID | 接頭辞と一意の番号。利用者は番号を直接編集しない。内部UUIDと分離 |
| Place | 場所名・住所・任意座標、解決状態、Provider識別。場所の文字列だけでも保持可能 |

### 5.1 値の意味と変更

- Property名やoption名を変えても安定ID・既存値・filter・数式・actionの参照が変わらないこと。式の表示名は追随する。
- 作成、複製、名前変更、設定、表示/非表示、順序変更、型変換、削除/復元を提供する。型変換では影響件数・変換不能値・依存するビュー/式/actionを確認し、元値を保持して復旧できる移行を定義する。
- 未設定、空文字、false、0、空の集合を型ごとに区別する。フィルタや保存で一律に同じ値へ潰さない。Formulaのempty等はその言語の契約に従う。
- Dateは日付だけの値をUTC午前0時として保存しない。Task dueをdatetimeへ勝手に変更しない。日時の開始/終了/timezoneは整合性を守る一つの値として検証する。
- Created/Editedの端末時計は同期の順序を決めない。offlineの作成者と保存時刻、サーバー受理記録、最終内容変更の表示契約を分けて確定する。pull・cache再計算だけでEditedを更新しない。
- Unique IDの全端末で一意な整数はofflineで無条件に確定できない。offlineでは内部UUIDと採番待ちを保持し、受理後に一度だけ番号を確定する案。発番範囲・再利用禁止・prefix変更は実装前に確定し、UUIDを数値互換と表示しない。
- Placeの住所検索/現在位置取得はProvider・端末許可を経由する。保存済み住所をview切替だけで外部へ送らない。

### 5.2 Relation・Rollup・Formula

[NotionのRelation/Rollup](https://www.notion.com/help/relations-and-rollups)を基準に、双方向の関連、件数制約、自己参照、関連先からのプロパティ表示と集計を維持する。

Relationの両方向は同じリンクを参照し、二重の独立した値にしない。リンクの追加/除去とRecord削除を分け、権限のない関連先の名前・値を漏らさない。表示候補のロード失敗を空Relationとして保存しない。

FormulaはNotionの関数・演算子・型・メソッド形式・list/Person/Page参照を比較対象にし、関数別の対応表とgolden caseを作る。文字列連結・条件・算術・日付・list・let/lets・空値・書式等を含める。小さな独自式だけで互換を名乗らない。関数未対応/型不一致は値を0や空文字へ置換せず明示する。

式は任意JavaScriptとして実行しない。Property IDへの参照、型付きAST、評価上限、依存graph、循環検出を設ける。Property名変更後も式が壊れない。RollupのRollupなど元仕様が許さない組合せは、対応契約が決まるまでは有効として保存しない。

算出値は再生成可能であり、算出するだけでoperationをenqueueしない。未取得・権限制限・循環・評価失敗を空の正常値と区別する。now/todayの基準timezoneと評価時点を示し、Formula再計算自体をプロパティ変更automationのtriggerにしない。日時関数・丸め・正規表現・文字位置・null等の厳密な互換性は関数別試験で確認する。

## 6. レコードページのレイアウト

[NotionのLayouts](https://www.notion.com/help/layouts)に合わせ、タイトル周辺の固定表示、プロパティ群/セクション、本文、右の詳細パネル、Simple/Tabbed構造と関連DBのタブを対象にする。レコード詳細共通の配置と各ビューのカード表示を独立して保存する。

- 同じDataSourceのレコードへ共通配置を適用する。新規項目にも適用する。
- 配置のpreviewと適用を分け、リセットしても値や本文を削除しない。
- 常時表示/空なら非表示/非表示、プロパティの検索・並べ替え、本文と関連Task等の表示を設定できる。
- 関連ビューのfilterに現在のRecord IDを束縛できる。特定のプロジェクト・科目名を定義へ固定してコピーしない。
- Mobileでは詳細パネルをsheet等へ再配置し、閲覧・編集機能を保つ。高度な配置エディタのplatform別範囲は要決定。

## 7. 汎用Boardとカード内の操作

### 7.1 縦横の分類

Groupに任意の対応Property、Subgroupに別の対応Propertyを指定する。横の列と縦の区分、順序・色・空区分・未設定区分・折りたたみを設定できる。一つのセルに複数Recordを許し、大学の時間割の1コマを前提に件数制限しない。

分類対象にはSelect、Status、Person、Multi-select、Relation等の対応する型を含める。Date/Numberの区切り、Text/算出型のgroup化は元仕様と照合し、型別の対応表へ明記する。読み取り専用の算出値で分類できても、移動で式の結果を直接書き換えない。

複数値による分類では同じRecordが複数セルに現れても正本は一件。Dragの文脈を元セルと移動先で保持する。単一値は置換し、複数値は元セルに対応する値を除去して先の値を追加し、他の値を保持する案。複数軸の変更は一つの論理操作として検証・保存し、片方だけ成功しない。曖昧なRelation/グループや読み取り専用軸では、編集内容を確認する導線を出す。

セルからの作成では、書き込み可能なgroup/subgroupと明確な等値filterだけを初期値へ反映する。OR条件・算出値・相対日付を無断で具体値へ変換しない。保存直後にfilter外へ移る場合は移動先/詳細を案内する。

### 7.2 カード表示とaction

カードのタイトル、任意プロパティ、tag、画像preview、密度、表示順、Buttonプロパティをビューで設定する。ボタンはhoverに依存せずkeyboard/タッチから実行でき、カードを開く操作と分ける。

Buttonの処理は[ボタン・自動処理仕様](BUTTON_AUTOMATION_SPEC.md)に従い、現在のRecord、実行者、日時、作成したRecord等を参照できる。表示名「課題追加」や「講義ノート追加」は利用者が付ける設定値とする。同じ仕組みで顧客→案件/商談記録、案件→Task/議事録、備品→点検/履歴などを作れる。

### 7.3 提示画像を再現する設定例

以下は汎用機能の受入シナリオであり、専用domainの固定schemaではない。

| 設定 | 時間割の利用例 | 別の利用例 |
| --- | --- | --- |
| タイトル | 科目名 | 案件名/作業名 |
| 横Group | 曜日 | 担当者/状態 |
| 縦Subgroup | 時限 | 優先度/部署 |
| Filter / View tab | 年度・学期・期間 | 四半期・チーム・進行状況 |
| カード表示 | 区分、教室、対象期間 | 種別、場所、期限、担当 |
| Button 1 | 関連Task作成を「課題追加」と表示 | フォローアップ作成 |
| Button 2 | 関連Page作成を「講義ノート追加」と表示 | 議事録/点検記録作成 |

テンプレートを提供する場合も編集・複製・名称変更できる通常の設定として保存する。ユーザーの提示画像は参考資料としてのみ扱い、画像そのものや個人のレコードを配布物へ含めない。

## 8. Calendarと汎用定期予定の接続

単純なDB Calendarは選んだDateプロパティを表示する。曜日tagを設定するだけで毎週の予定を生成しない。定期予定として登録したRecordにはSchedule bindingを設け、繰り返し規則・例外を正本にする。

- 一つのRecordに複数開催パターンを関連付けられる。曜日と時間帯の組合せを独立した多値プロパティの直積から勝手に推測しない。
- Boardで原則パターンを扱う場合は表示単位がRecord/パターンであることを設定と詳細に示す。同じRecordの複数カードには元RecordとPattern IDを保持する。
- 原則のBoard配置と、Calendar上の特定の回の実日時・取消・振替を区別する。Boardに例外表示がなくても取消は消えず、Calendarで有効な回を重複生成しない。
- Boardから原則の曜日/時間帯を変更する操作はSchedule commandへ接続し、変更範囲と例外への影響を確認する。「この回だけ」は特定Occurrenceを選んだ場合のみ使う。原則カードだけから任意の回を推測しない。
- 学期や時限は設定例。案件の定例会、シフト、備品の点検も同じRecord・Schedule bindingを使う。

## 9. Local-first・同期・権限

定義・値・ビューの確定した変更はローカル保存とoperation追加を同時に行う。ACK再送やpull再適用でレコード、Relation、Button実行が増えない。本文はYjs、プロパティはstructured syncという責務を維持する。

異Propertyの値はmergeし、同Propertyの意味的競合はbase/local/remoteを保持する。定義変更と旧型の値編集、option削除と値追加、Relation制約と同時追加は専用の検証/Conflictを定義する。schema変更を受けた端末で未送信の旧型入力を黙って破棄しない。

Number・Date range・集計定義・Board両軸など整合性が必要な境界をSYNC仕様へ明記する。UI配置の同時編集も操作またはConflictの契約を定義し、意味のある設定を無言のLWWで消さない。派生表示は正本が一致した後に再計算して収束する。

データ編集、定義/ビュー編集、automation設定/実行、共有/公開を別権限にする。認可はUIに加え保存・同期・実行で検証する。offlineの未取得データは欠落を示し、全件計算やautomation対象が完全であると偽装しない。

## 10. 受入条件の案

| ID | 操作・条件 | 期待結果 |
| --- | --- | --- |
| DB-01 | 同じDataSourceへTable/Board/List/Gallery等を作り編集 | 同一Recordへ反映し、切替/複製でデータが増えない |
| DB-02 | 任意のSelect×Selectで二軸Boardを設定 | 列/行・空/未設定・折りたたみ・複数カードを扱い、固有の曜日/時限が不要 |
| DB-03 | Group/Subgroup両方を変更するカード移動を失敗させる | 両方保存または両方保全。片方だけ更新せず入力/選択を維持 |
| DB-04 | 同じRecordが複数値で複数セルに現れる | 重複したRecordを作らず、移動で無関係な値を消さない |
| DB-05 | 時間割例と、担当者×優先度の案件例を構成 | 同じ設定機能・カード・ボタンで作成でき、専用コードが不要 |
| DB-06 | 各ビューのfilter/sort/表示項目を変え、詳細から戻る | 他ビューへ設定を漏らさず、元scroll・選択・focusを復元 |
| DB-07 | Property/optionを名前変更、型変換、削除/復元 | ID参照を維持し、不能値と式/actionへの影響を示し、元データを保全 |
| DB-08 | 0/false/空/未設定、Date-only/range/timezoneを保存し同期 | 型別の意味を保持し、Task dueをdatetimeへ変えない |
| DB-09 | Relationの双方向編集・1件制約・tombstone・権限制限 | 同じリンクへ収束し、関連先の未取得/不可視を空値として上書きしない |
| DB-10 | Formula関数別golden case、Rollup集計、依存のrename/循環/未取得 | 契約した出力/エラーを返し、派生値更新だけで書込みやtriggerを増やさない |
| DB-11 | Chart/Dashboardでfilter・drilldown・複数sourceを使う | 同じ認可対象を集計し、ページ内だけの集計/名前だけのfilter対応をしない |
| DB-12 | Formをoffline送信し、再起動/再送する | 端末の回答を保持し、送信IDで一件に収束。受領前に送信完了と表示しない |
| DB-13 | Mapの未解決住所・offline・pin上限を扱う | 元のPlace値を保持し、未表示件数と外部依存を明示 |
| DB-14 | RecordLayoutを適用/リセットし、本文・関連タブを開く | データを消さず、全Recordへ同じ配置を適用し、現在Recordで絞れる |
| DB-15 | Boardの原則とCalendarの休講/振替/追加を切り替える | 例外の正本を保持し、有効な各回は一件。原則変更の範囲と影響を確認 |
| DB-16 | offline編集→強制終了→再接続、同Propertyの同時編集 | 保存を復元し、異fieldを保持、同fieldのConflictを明示 |
| DB-17 | keyboard/タッチだけで分類変更・セル編集・Button実行 | Drag/hoverに依存せず操作でき、日本語IMEを中断しない |

これらは将来の受入条件であり、現PoCのPass件数へ含めない。各ビュー・型・関数の対応表の検証が済むまで全互換と表示しない。

## 11. 後続の詳細化と提供順

実装順の案は、PoC Gate完了後に型付きRecord/Property・認可・structured syncを定め、Table/Listと参照ビュー、Board/Gallery、Relation/Rollup/Formula、共通action・Button、日時/Calendar/Timeline、Form/Chart/Feed/Map/Dashboardへ展開する。依存する共通actionは先に設計し、全対象は保持したままリリースを分割する。

要決定: 初期提供順・時期、物理schemaと索引、既存Task/Schedule binding、複数DataSource、型変換/Trashの復元期間、正確な関数互換と制限、計算/描画上限、Unique ID採番、コメント/閲覧数、公開Form、地図Provider、platform別詳細操作。各公式仕様との差異は記録し、未決定を実装者の独断で恒久化しない。
