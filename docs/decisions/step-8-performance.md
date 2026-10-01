# Step 8: 性能の測定と実機検証の範囲

2026-10-01。POC_SPEC.md Section 13／18 Step 8の性能・互換性の証拠を収集する。測定値とデータの正確性を別に評価し、全GateのPassや技術選定結論はまだ確定しない。

## 再現方法

Docker内で`npm run test:performance`、通常の回帰も含める場合は`npm run evidence:container`を実行する。実PostgreSQLの接続が必要。実行ごとに専用schema、Rust SQLiteの端末別DB、collaboration journalを作り、schemaは最後に削除したことを確認する。開発DBや利用者のPageは初期化しない。

クライアントはVite production bundle、保存層はlocked Cargo release buildの実Rust repository。通常のdev serverを測定せず、preview serverへ試験専用transportを接続する。観察用の読み取りhookが含まれるため、Windows Tauri releaseの起動時間やnative IPCの性能へ読み替えない。通常ビルドは試験フラグを有効にしない。

## データと判定

| 対象 | 実際の負荷と証明 | 数値の扱い |
| --- | --- | --- |
| 空DB起動の補助測定 | 空の実SQLite、新しいbrowser context、navigation開始から編集可能まで3回。既に起動済みのbrowser／サービス | 3秒目安との比較はWeb補助値。Windows実行物の起動は未測定 |
| Page復元 | 1,000 paragraph、初期の1,001 journal updateを実保存。Rust processをSIGKILLして3回開き直し、全本文／構造／Yjs clock一致 | 2秒目安との比較と全sampleを記録。context間でbrowser process／OS cacheは共有する |
| 連続入力 | 上記Pageの500番目のblockへ104文字を実keyboardイベントで入力。文字／構造と保存された全updateの復元を完全比較 | keydown→DOM input、keydown→次のframe機会、frame間隔、long task、keydown→commit ACKを記録。IME・実際のpaint完了は未証明 |
| Yjs | A/Bで各50回の実キー編集をoffline保存し、再接続後に両clientの全本文／構造／clockとpending=0を確認 | 収束は30秒以内を要求。100文字の保持も確認 |
| Task queue | 250 Task × create／状態変更／名前・期限変更／完了の4操作＝1,000操作。SIGKILL後のoffline snapshot完全保持、実React TaskPanelのengineで個別push、ACKとpull | 所要時間を記録。local／peer／server全Task、1,000 unique operation、cursor/headと再接続後の一件性を確認。240秒は試験の観測上限で製品SLOではない |

入力の保存時刻は、bridgeへ実送信したYjs差分をdecodeし、seedに存在しないclientの文字構造を入力順へ対応させてcommit ACKへ結び付ける。104文字すべてに対応することを要求する。`inputToCommitAckMs`はcaptureしたkeydownを起点とする。bridgeのHTTP往復を含み、SQLiteのfsync時間単独ではない。最初の差分が処理中なら、後続差分が待機batchへまとまる現在の保存経路をそのまま測定する。

最初の測定ではframe間隔の初回sampleに負値があった。rAFが渡すtimestampとcallback登録時の時刻を差し引いた観測処理の問題で、以後は最初のrAFを基準として次回以降の間隔のみを計算した。初回の証拠を保持し、修正後の測定と混同しない。

## 性能上の残課題

初回／計測補強後の2 runでは復元とYjs収束が目安内だったが、[最終run](../../tests/evidence/step-8-performance-20261001/SUMMARY.md)の1,000 block復元は3回中1回が2,472.85msで、2秒目安を超えた。中央値1,165.44msだけで達成扱いにしない。全データの正確性は保持し、回帰12項目はPassだが、性能目安全達成を意味しない。

最終runの104文字ではkeydown→次のframe機会のp95が162.9ms、keydown→commit ACKのp95が961.7ms、最大1,319.4ms。frame間隔のp95は133.4ms、最大433.4msだった。Yjs 100回編集の再接続収束は1,286.08ms、Task 1,000操作の同期は106,527.07msで、全内容と一件性は保持した。全sampleは[測定値](../../tests/evidence/step-8-performance-20261001/performance-metrics.json)とraw reportに残す。Docker上限2 CPU／4GiB、共有browser／OS cache、host負荷が未固定であり、Windows native IPCやIMEの値へ読み替えない。

次にrendererの入力処理、toolbarの可否判定、block decoration／placeholder更新、保存通知によるrender、Rust／HTTPのcommit待ちとstructured snapshotの繰り返しを切り分ける。計測から原因を確認してから、保存契約・Undo・focus・IME・Conflict規則を保つ改善を行う。予測文字列の先行確定や保存保証の変更で数値を良くする対応はしない。

## 実プラットフォーム

[Windows実機の限定的な操作記録](../../tests/evidence/step-8-native-smoke-20261001/SUMMARY.md)はDockerの測定と別に保持する。

Windowsホストの既存0.6.0実行物をSHA-256照合し、computer-useで新規Page、title／本文のliteral入力、保存／同期表示、Task作成と実APIで一件の確定を確認した。新しく選び直したwindowでは、以前の起動物の操作APIエラーは再現しなかった。原因が判明した扱いにはせず、履歴を保持する。0.6.0を現在の候補番号へ付け替えず、Microsoft IMEや全Editor／crash操作の成功へ拡張しない。

この環境ではWindows＋Linux Dockerのみを確認した。macOS、実iOS、実Androidの接続された試験端末は確認できていないため、P1/P2実OS・実IMEはNot run。Desktop Chromiumのviewport変更やLinux WebKitを実iOS／Android試験のPassに数えない。P0の最新候補、Microsoft IMEの残る組み合わせ、Windows release起動と大きなPageの実機入力を確認してからGate A/B/Cと技術選定結論を作成する。
