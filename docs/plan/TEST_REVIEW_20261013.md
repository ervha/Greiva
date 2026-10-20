# テスト項目と未合格事項の整理

2026-10-20補足：[現状と受入順](DEVELOPMENT_ROADMAP_20261020.md)。N-01/N-03のnative認証・offline復帰/入力保全はコード/IPC/画面まで接続済み。基準CIは型・unit575・画面60・検証器12がPassだが、新入口の実Windows/IME/offline通し受入とは別。F-01は既知Fail・受入例外を維持。PR #1ではremote反映前のselection準備を本文末尾基点へ変更し、同じ保持/Undo期待で10回と全回帰を確認した。製品/IME不具合の修正とは扱わない。以下の旧版表は履歴として保持する。

v0.82.1追記：[最新候補の通常Microsoft IME入力](../../tests/evidence/windows-ms-ime-20261013/SUMMARY.md)を利用者の実キー入力/確定とnative保存/実同期で限定確認。正確な2段落、全文/vector一致、未ACK0・ACK履歴76を確認した。再変換Fail・受入例外、remote composition/再接続、長時間/native性能とoffline未確認は消さない。

v0.82.0追記：[新規登録と実Windows検証](../../tests/evidence/private-signup-20261013/SUMMARY.md)で実Supabase正常ログインとworkspace開通、保存済みPage/pending2の強制終了復元、実同期pending0/receipt2・全文/vector一致を確認した。N-02の正常loginは補完したが、refresh/失効は未実施。N-05はオンライン手動再認証を伴う保存完了後の1境界だけを補い、offline無認証復元や内部全停止点をPassにしない。確認メール後のlocalhost接続エラーは[新しい未整備事項](../failures/private-signup-confirmation-redirect.md)。以下はv0.81.0時点の整理として保持する。

2026-10-13。対象ソースv0.81.0（8b43799）。利用者の「通るテストじゃなくて、通らないテストはない？」に対する確認。成功件数、既知の失敗、未実装、未実施、受入例外を区別する。

## 判定の読み方

- **Pass**：その実行版・条件・層の期待結果に一致した。
- **Fail／未解決**：実際に期待結果から外れた。例外受入や別試験の成功で原Failを消さない。
- **未実装**：必要な処理の接続がない。通る受入試験がまだ成立しない。
- **Not run**：実行していない。失敗とも成功とも断定しない。
- **Conditional／受入例外**：残る条件や既知Failを明記して採用した判断。修正・無条件合格とは別。

不正署名や期限切れを拒否する試験のPassは「異常を正しく拒否した」という意味。正常系だけの成功ではない。ただし、その失敗注入をOS doubleやfixtureで行った場合、実OS・実provider・実IPCでの保証まで広げない。

## 実装と検証の層

| 区分 | 何を検査するか | 最新記録と限界 |
| --- | --- | --- |
| 単体（57 files） | 入力/型/認可契約、状態遷移、通信取消、UI controller、暗号/設定の拒否条件 | v0.81.0で487 Pass。画面やnative実行まで含む数字ではない |
| 非PG統合（30 files） | 実Rust/SQLite、queue/pending/wire/ACK、再起動・SIGKILL、保存とcontroller連携 | 今回v0.81.0で311 Pass。OS doubleを含み、Windows実OSは別 |
| 実PostgreSQL統合（37 files） | 認証付きHTTP、owner/device/epoch、transaction競合・失効、再送/cursor、API終了復旧 | v0.81.0で229 Pass。実Supabase正常ログインはfixture署名で代替していない |
| 通常Editor E2E | block、pointer/keyboard、選択/focus/composition、保存・peer、画面 | Vitest外。`test:e2e`で実行。Chromiumとtest hooksを使用する |
| 個人workspace／login E2E | 行/View/Conflict/ヘルプ、取消・draft、狭い画面/dark/reduced motion、認証画面 | `test:workspace-e2e` / `test:auth-e2e`。通常E2Eから除外される別suite。fixtureと実Windows IPCの差を残す |
| structured／crash E2E | 実PG＋画面＋保存の冪等性、通信境界/強制終了 | `test:structured-e2e` / `test:crash`。通常E2Eから除外される別suite |
| Rust内部／Windows OS probe | 署名検証、資格情報保管、lease/clock/store gate | v0.80.0 Rust12、Windows架空値の保存/別process復元。通常画面の認証機能を検査したものではない |
| 実provider／native受入 | 実ログイン/refresh、Tauri IPC、OS lifecycle/IME、通常アプリの全操作 | 正常実ログインは未実施。v0.75.0専用プレビューは未ログイン起動とヘルプまで |
| 性能／他OS | 1,000 block復元・連続入力、native IME/frame、macOS/iOS/Android | Docker性能やAndroid browserの旧証拠を、最新版のnative保証に換算しない |

Vitest対象は計124 files（unit57＋integration67）。明示的なskip/todo/fixme/expected-failureとRust ignoreをソース検索した範囲では、37 filesのPG条件付き`skipIf`以外は見つからない。PG flagを付けず通常Vitestだけを実行すると、実DB項目はskipされる。これは未検証を合格件数へ足してよい理由にならない。

## 実際に合格していない・完了していない項目

| ID | 項目・期待結果 | 状態と根拠 | 次に必要な確認 |
| --- | --- | --- | --- |
| F-01 | 選択→window移動→Microsoft IME再変換でも選択外の本文を失わない | **既知Fail・未修正・受入例外**。`MS65 local 日本語`が`MS65 loc日本語`になり、SQLite/peerにも保存・同期。[失敗記録](../failures/step-8-ms-ime-reconversion.md)、[例外判断](../decisions/step-8-ms-ime-exception.md) | 問題が解決したとは扱わない。現在版/現在OSでの再現性は今回未確認。他アプリでの利用者報告を上流原因の証明にしない |
| F-02 | native dragで余分なblockを増やさない | **旧観測の原因未確定**。最初の物理dragで空段落1つ増加。その後の修正版移動/Undoは正常。[Gate A](../decisions/gate-a.md) | 同じ余分な段落を最新で再現したとは断定しない。物理mouseと自動入力の結果を分ける |
| P-01 | Windows 1,000 blockの編集可能な復元が2秒目安内 | **達成未確認／Conditional**。旧main UI観測上限3,567.4msはhelper等込みで単独復元時間ではない。[Gate B](../decisions/gate-b.md) | 通常releaseで編集可能時刻、cold/restore/入力を層別測定。3.567秒をそのまま製品復元Failと断定しない |
| N-01 | 起動復元→native provider認証→refresh→offline利用→logoutが通常画面で成立 | **native provider/UI/通常IPCの接続未実装**。各基盤の単独検査はPass。[checkpoint](CHECKPOINT_20261013.md) | 接続実装後に実際のTauri入口で全経路を検査。現在の基盤Passで製品受入Passにしない |
| N-02 | 実Supabase正常login/refresh/失効が端末保存・送信まで通る | **Not run**。実JWKS/無効署名拒否/未ログイン表示のみ確認。[実候補](../../tests/evidence/private-preview-live-20261013/SUMMARY.md) | 利用者が操作可能な時点で正常系を確認。fixtureのsigned sessionだけでは埋めない |
| N-03 | 期限到達/既知失効/logout中でも入力中draftを保全し、画面・handleを閉じる | **画面への接続と受入未完了**。leaseの保存済みpending保持は検査済み | 期限直前/境界、composition中、保存失敗/終了、同account/別account復帰を通常UIで検査 |
| N-04 | lease high-water書込みと実OS資格情報失敗でも再起動後に許可を延長しない | **限定検証**。clock/破損/書込失敗はOS double、Windows3processは正常保管/復元/logout | lease high-water更新の途中終了、実Windows保管の障害注入と復旧を別証拠で確認。credential markerのSIGKILL7だけで全lease境界完了にしない |
| N-05 | 最新Windows Tauriで全保存/通信/ACK境界を検証 | **Not run／旧版の部分証拠**。Docker SIGKILLと旧nativeの保存済み・ACK前終了は確認済み | 実IPCと内部transaction停止点を同一試験と呼ばず、対象版と未実施境界を列挙する |
| O-01 | macOS/iOSで起動・編集・IME・再接続、Android nativeで保管/復旧 | **Not run**。旧Android Chrome/Gboardの検査はnative SQLiteとは別 | 提供対象OSの実環境で受入。旧browser成功をnative/他OSへ換算しない |
| O-02 | 本番backupの鍵供給・更新・保持/廃棄・定期実行と復旧が成立 | **運用未実装／未受入**。架空DBの暗号化backup/別DB復元は確認済み | KMS/保管/スケジュール/rotation/復旧手順を配備後に検証。リハーサルを本番稼働保証にしない |

## 既存の異常系テスト

現在のテストには、別owner/device/epoch、不正/期限切れ署名、nonce違い、旧challengeの遅着、clock逆行、credential書込み/cleanup失敗、logout前後のSIGKILL、ACK喪失、同操作再送、COMMIT前後終了、cursor不一致、同field Conflict、oversize/不正UTF-8 wire、署名鍵fileの不正権限/symlink/鍵ペア不一致、backup改ざん/旧key/上書き拒否が含まれる。

代表例：[credential SIGKILL](../../tests/integration/native-credentials.test.ts)、[offline grant実PG](../../tests/integration/private-offline-grant-postgres.test.ts)、[署名設定](../../tests/unit/private-offline-configuration.test.ts)、[実SQLite Record更新](../../tests/integration/private-database-record-update-store.test.ts)。異常系のassertionがあることと、組合せ・実OS・UIまで漏れなく網羅したことを区別する。

## 過去Failと報告上の問題

初回の型/fixture/selector/権限/cache不備と修正後Passは各SUMMARYで両方保持する。古いFailログの存在だけで最新版でもFailすると断定しない。一方、F-01のように解決証拠がなく例外にしたものは未修正として残す。

v0.79以前のPG runner固定一覧は5 suites（33 tests）を漏らしていた。自動検出へ修正し、v0.79で全228、v0.81で全229を実行した。[原195と再確認228の別記録](../../tests/evidence/native-offline-grant-20261013/SUMMARY.md)。通常の単体件数だけを「全テスト」と報告しない。

過去PoCのGate A Pass（例外あり）/B Conditional/C Passは製品0.6.20時点の判断。v0.81.0の全機能へ再判定済みとは扱わない。[現行の開発checkpoint](CHECKPOINT_20261013.md)と版を分けて読む。

## 再確認の結果

全124 filesを実PostgreSQL flag付きDockerで再確認し、**1,027 Pass／0 Fail／0 skip**。単体487＋非PG統合311＋PG229。所要291.64秒。個々のassertionと124 filesの層別対応を[証拠](../../tests/evidence/test-review-20261013/SUMMARY.md)へ保存した。結果を得るためにテストを削除・期待値変更・retryしていない。

この再確認ではブラウザーE2E、Rust内部unit、Windows GUI/IME、実provider正常認証、性能を再実行していない。これらを1,027件へ加算しない。source395件一致（raw385＋改行のみ10）、対象外5件はverification.jsonに列挙した。

結果回収の初回はDockerにhost保存済みinventoryがなくENOENTだった。manifestを渡して回収を再実行し、アプリ試験は再実行していない。回収エラーを製品テストFailとして数えない。

## 今後の試験と報告

1. 次のnative接続実装ではN-01/N-03を最優先に、通常入口からの全経路と失敗時のdraft/pending保全を受入条件にする。ライブラリの単独Passだけで完了しない。
2. N-04/N-05は実OSと終了境界、OS doubleと実adapterの違いを列挙する。期限・clock・logout・refresh・旧account遅着の組合せを扱う。
3. F-01は既知Failの受入例外として常に残す。利用者の既存例外判断を変更せず、未修正を完了扱いにしない。
4. 毎回の報告は未解決Fail、未実装の受入経路、Not run/skip、実行した異常系とその限界、修正後Passの順で整理する。成功件数はunit/統合/画面/nativeを分ける。

今回は項目整理・全Vitest再確認だけを行い、新機能開発へは再開していない。
