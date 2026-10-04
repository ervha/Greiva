# 今後の開発計画

2026-10-05。利用者の「今後の開発計画を教えてほしい」に対する計画。現在の実施範囲と、後続の製品化案を区別する。PoCの実装権限は[POC_SPEC.md](POC_SPEC.md)、本番設計の方向と未決定事項は[統合要件](GREIVA_REQUIREMENTS.md) §11/12に従う。

## 1. 実施中 — PoC基盤の性能・復旧の補強

- 大量Pageの入力で不要な全体描画を減らす。Editorの内部状態、Taskのフォーム、Pageタイトル、接続状態が引き続き更新されることを確かめる。
- DockerでEditor・選択・同期・Conflictを回帰検証する。失敗したrunは保持し、再実行の成功だけで原因解消を主張しない。
- Windowsの実Rust/SQLiteでtransaction途中の強制終了と再試行を検証する。診断driver、通常Tauri、実IMEの証拠を分ける。
- 通常Windows releaseで大量Page/Task、入力・保存・再起動後の内容を確認する。入力provider未確認のASCII操作をMicrosoft IMEの合格へ換算しない。
- 過去の未実施・Conditionalを更新し、利用者の操作が必要な事項をまとめる。macOS/iOSは利用可能な実OS環境が必要。Windowsの復元時間と長時間入力の性能は追跡する。

完了条件は関連回帰・保存照合・証拠・全自律判断の記録。新たな正確性の失敗は原因を確かめるまで解消済みにしない。[既存の技術採用結論](../decisions/poc-technology-selection.md)のConditionalを無断でPassへ変更しない。

## 2. 実施中 — 製品化の設計と最初の提供範囲

PoC結果を踏まえ、統合要件§11の順序でarchitecture/採用技術、データモデル、structured sync、CRDT、Editor、認可を具体化する。schema移行、backup/restore、履歴/compaction、配布・運用の契約を併せて整理し、リリース単位の実装計画へ落とす。

2026-10-05に利用者が機能優先を委任し、個人利用/自分の端末間同期を先行と回答。初期はWindows/Android、Page/Task/Relationと基本DB Table/Listを選ぶ。[実装順](IMPLEMENTATION_PLAN.md)と[全判断](../decisions/production-foundation-plan.md)に記録した。Home/Inbox、検索の詳細、外部provider/配布/保持等の未確定部分は引き続き分ける。本番deploy・課金・既存DB移行をこの範囲選定だけで開始しない。

## 3. 後続案 — 日常利用する基本画面

Page/Task/Relationを中心に、ナビゲーション、検索、mobile操作、ヘルプを整える。認証/権限が必要な提供形態なら、その境界の実装・試験を先行する。offlineの端末保存とserver同期、送信待ち、エラー、Conflictを区別する。

丸み・滑らかな動き・読みやすさは[共通UI品質基準](../development/ui-quality.md)を継続する。見た目の変更と同時にpointer/keyboard、focus/selection、composition、reduced motion、contrastを確認する。Windows/Androidを優先する。

## 4. 後続案 — 汎用データベースとCalendar

[DATABASE_SPEC.md](DATABASE_SPEC.md)の型付きRecord/Propertyと基本ビューから始める。複数ビューの保存、filter/sort/group、Relation/Rollup/Formulaなどは契約と段階提供範囲を決めて順次加える。Notion全機能の一括完成を前提にしない。

Calendar/時間割・定期予定は[専用仕様](CALENDAR_TIMETABLE_SPEC.md)に従い、繰り返しと取消・振替・追加を分離する。Button/Automationは[共通action仕様](BUTTON_AUTOMATION_SPEC.md)の履歴・冪等性・認可を実装できてから接続する。提供順と初期採用範囲は案である。

## 5. 後続案 — 提供・運用とAI

更新、署名・配布、移行/復旧、監視、基本ヘルプを提供時期に合わせて整える。更新機能やヘルプをAI完成まで待つ計画ではない。

AIは[AI_ACTION_SPEC.md](AI_ACTION_SPEC.md)のPage作成・Task/予定登録・録音整理から段階的に提供する案。通常UIと共通の操作基盤と参照・外部送信・確認の契約を先に定める。Provider、費用、保持期間、提供時期は未決定であり、現段階で外部接続や課金を行わない。

## 進め方の判断

1. 自動化できるDocker/Windows確認を先に進め、利用者の追加操作を最小限にする。
2. PoCの残証拠を保持し、回答済みの初期範囲で本番設計とP0基盤へ進む。製品仕様の存在だけでPoCへ新機能を追加しない。
3. 上記3〜5は依存関係を踏まえた計画案で、リリース時期の約束ではない。未決定の製品判断を恒久実装する前にまとめて提示する。
4. 利用者の指示により、commitや区切りごとの停止は当面の継続理由にしない。停止時は検証結果、判断全件、必要な応答/環境を残す。
