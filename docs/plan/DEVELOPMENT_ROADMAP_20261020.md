# 現状確認と開発ロードマップ

2026-10-20。基準は **v0.98.1 / main `ec0537e`**、最新Windows機能候補は **v0.98.0**。この文書の更新は計画だけで、新たな機能追加・配備・実機受入を行ったものではない。

## 現在地

合意済みの初期範囲は、**個人利用・自分の端末間同期、Windows/Android、Page/Task/Relation、基本DBのTable/List**。基本DBはName/Text/Number/Checkbox/Select/Dateから始める。[PoCの順序](POC_SPEC.md)と[条件付き技術採用](../decisions/poc-autonomous-review.md)を維持する。製品仕様の存在だけでPoCを拡張しない。

現在は「機能基盤と複数の検証用画面があり、初期製品として一つのnative利用経路に統合し、実機で受け入れる作業が残る」段階。版番号やテスト件数から総合完成率・公開日を推定しない。

| 領域 | 確認できる実装・証拠 | 残る差分 |
| --- | --- | --- |
| 開発運用 | main、PR/CI必須の保護、マージ後の同一SHA検証とタグ公開。[PR #1](https://github.com/ervha/Greiva/pull/1) | 変更領域ごとの関連検証を継続追加 |
| CI | [mainの結果](https://github.com/ervha/Greiva/actions/runs/39363639681)：型・unit575・画面60・レポート検証器12、skipゼロ | 基準CIはJS/IPC double中心。Rust/実PG/Windows/IME/Android/性能を代替しない |
| 新native入口 | OS credential、署名session、workspace認可、Page作成/保存、明示送受信・一覧・再接続、offline許可/復帰と画面 | 最新Windowsで一連の経路を受け入れる。署名設定済み候補のoffline再起動・期限/失効確認 |
| タイトル・Task/Relation・基本DB・ヘルプ | 旧workspaceプレビューと保存/API/同期/競合の実装・証拠がある | 新native認証入口への接続・認可再点検・画面統合。旧経路をそのまま公開しない |
| offline | native gateと画面は実装済み。署名context、元世代/期限、pending/wireを検査 | v0.98.0候補は署名pin未設定で準備無効。memory下書きは強制終了を越える保存保証を持たない |
| 実機 | 旧v0.82.0で実登録・保存後kill/復元・同期、v0.82.1で通常MS IME入力の限定証拠 | 最新native入口の受入とは別。Android browserの旧成功もnative Android完成を意味しない |
| 提供・復旧 | 暗号化backup CLI/復元リハーサル等の基盤 | 配備先、鍵、保持/削除、移行、署名配布、更新/復旧の運用決定と実証 |

コード確認対象：`apps/client/src/auth/native-main.tsx`、`NativeAuthScreen.tsx`、`native-session-port.ts`、`apps/client/src-tauri/src/lib.rs`。旧機能画面は`apps/client/src/workspace/`、`help/`。local whitelistにはstructured/DB操作もあるが、その存在だけで認証付きremote送受信・画面統合を完了としない。

根拠：[offline画面](../../tests/evidence/native-offline-screen-20261016/SUMMARY.md)、[native復帰基盤](../../tests/evidence/native-offline-resume-20261016/SUMMARY.md)、[旧実機確認](../../tests/evidence/private-signup-20261013/SUMMARY.md)。版と試験層を分けて参照する。

## 開発順序と完了条件

| 優先段階 | 実施内容 | 完了条件 |
| --- | --- | --- |
| M1 最優先：Windows経路の受入 | テスト用署名設定を明示した隔離候補・手順を準備。login/restore/refresh、保存→再起動、offline起動/編集→再起動→online復帰、期限/既知失効/logoutを確認 | 端末DB・pending・元wire・本文/vectorを独立照合。commit済み変更を失わず、未保存入力を保存済みと表示しない。別owner/workspace/device/epoch拒否。build/非GUI inspector/合成compositionを実機合格にしない |
| M2：native機能統合 | ①タイトル/metadata変更受信、②Task/Relationの保存・送受信・三値Conflict、③基本DBの定義/Record/View・queue/差分・Table/Listを順次接続 | 既存実装を再利用し、元admission/世代に通信・ACK・cursorを束縛。raw tokenをWebViewへ戻さず、旧caller-owned認証/ACKを再開放しない。互換性・結果不明・遅着・scope変更を各単位で検証 |
| M3：日常利用UI | navigation、Page/Task/DB、ローカル検索の範囲表示、ヘルプ、接続/未送信/Conflictの案内を新入口へ統合。白/グレー中心の既存方針で整理 | 一つの利用経路で主要操作を完結。pointer/keyboard、focus/selection、IME、mobile幅、dark/reduced motionを確認。未取得範囲を検索済み・同期済みと呼ばない |
| M4：Android native | OS資格情報保管/SQLite/lifecycle、background・kill・回線切替、Windowsとの同期を確認 | 実AndroidアプリでPage/Task/Relation/基本DBの保存・復帰・Conflict・収束、実Gboardを受け入れる。browser成功でnative保管を免除しない |
| M5：性能・耐久性 | 通常候補で1,000 block復元/連続入力、代表Task/DB量、長時間、disk-full/保存失敗/kill/応答喪失、schema移行・backup/restoreを測定 | cold/restore/編集可能時刻・IME・保存を分け、既存基準/Conditionalと比較。元Failと再確認を分け、版/hash/試験条件を記録する |
| M6：限定提供の準備・判断 | 配備/TLS・保存時暗号化・鍵管理、保持/削除、backup運用、署名package/更新rollback、確認メール導線、規約/窓口を整備 | 決定済み環境で復元リハーサルと公開前チェック。配備・費用・旧データ移行を未決定のまま実行しない。初期範囲の実機証拠・残リスクで提供可否を判断 |

基本順序は **M1 → M2 → M3 → M4/M5 → M6**。M6の設計/選択肢整理、M5の計測fixtureは早期に準備できる。M1の実入力・端末操作待ちでも、独立した契約・fixture・回帰整備は先行する。受入未了の経路を公開入口へ昇格させない。

M2は一括移植せず、①〜③をそれぞれ保存・通信・画面の確認済みPRへ分ける。自動同期/自動再接続を加える場合は、別PRで再試行・回線/電源・結果不明・入力保護の契約を先に定める。Pageの明示送受信を黙って自動化しない。

## 直近の着手順

1. **受入候補の再現性**：署名設定済み隔離build、対応API/OS保管namespace、成果物hash、既存データを壊さない手順を揃える。配備用秘密鍵をrepo/チャット/証拠へ出さない。
2. **Windows offline通し試験**：保存完了後の強制終了→通信なし起動→追記保存→online復帰を照合。期限境界・時計逆行・不正/破損許可・OS保管失敗・既存DB欠損・既知失効・logout永続lock・別account・保存結果不明を含める。
3. **最新Windows入力受入**：通常MS IME、合成中の遠隔更新、選択/Undo/再接続を確認。代行不能な実キー操作だけを一括依頼する。
4. **統合契約とCI拡張**：タイトル/Task/Relation/DBの未接続箇所をcommand/transport/画面単位で一覧化。変更するRust/PGの関連試験をDockerで実施し、継続的に必要なものをCIへ追加。実accountをCI secretへ安易に持ち込まない。
5. **最初の機能統合**：安全境界を保ち、nativeタイトル/metadataから小さく接続。その後Task/Relation、基本DB、日常画面へ続ける。

これは着手順であり、固定バージョンや公開日の約束ではない。M1で新しいデータ損失・scope越境を再現した場合は、その経路の修正・再検証を優先し、機能追加で隠さない。

## 維持する判断と利用者の協力

- **IME再変換**：window移動後の再変換による選択外削除は既知Fail・原因未確定。[当該環境の受入例外](../decisions/step-8-ms-ime-exception.md)を維持し、解消済み/Passにせず、全開発を止める前提にも戻さない。通常変換と他の必須操作は確認する。
- **プライバシー**：[合意方針](ACCOUNT_PRIVACY_ENCRYPTION_SPEC.md)どおり、メール等をGreiva DB/ログへコピーしない。Auth側保管は許容。TLS・DB/backup保存時暗号化とログ抑制を実証し、server復号は許容、E2EEを必須へ戻さない。端末内検索・明示範囲だけのAI送信も維持。
- **必要時だけ依頼**：実accountへの安全な手動ログイン、APIで代行不能な実IMEキー、Android実機接続/確認。現時点で資格情報提出や即時操作を求めない。試験準備を完了してから操作をまとめる。
- **提供前の判断**：接続/配布先と費用、署名/鍵管理、保持/削除、旧PoC取り込み、復旧、運営者/窓口。自律検証と分け、[未決定設定](PENDING_PRODUCTION_CONFIGURATION.md)を更新する。

初期提供後に、基本DBの追加view・Relation/Rollup/Formula、Calendar/時間割、Button/Automation、AIを段階検討する。全機能を初期完成条件にしない。AI provider・費用・保持・送信先は未決定で、契約/課金/本文送信を勝手に開始しない。macOS/iOSはWindows/Android先行範囲と分ける。

## 各段階の完了の定義

[開発手順](../development/versioning.md)に従い、変更範囲のDocker試験と実機試験を分けて記録。作業ブランチでcommit、main向けPR、最新CI/関連試験/blocking review解消、merge、local main同期まで行う。実際のmain commitのActions/関連試験成功後、その同じSHAへタグを付ける。skip/未実施/未確認をPassへ換算しない。

計画更新はPATCH、機能追加は規模に応じて版を決める。試験追加時はCI baselineも同じPRで点検する。各段階で実装・証拠・残条件・次の一手を更新し、PR作成やcommit自体を完了としない。
