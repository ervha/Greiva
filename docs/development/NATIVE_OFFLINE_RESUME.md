# Native offline復帰の保存・実行境界

後続v0.98.0：[offline起動・編集画面](NATIVE_OFFLINE_SCREEN.md)を接続。以下のv0.97.0時点の未接続記録を保持し、画面検証と実Windows受入を区別する。

v0.97.0。[許可の準備](NATIVE_OFFLINE_PREPARATION.md)に続き、OS保管済み許可からのcontext復元、offline専用handle、local-only実行をnative/IPC/client portへ接続した。起動時のoffline選択画面とEditorのmode切替は次工程。現行画面のオンライン自動復元を、この実装だけでoffline対応へ読み替えない。

## 復元と保管

- `native_offline_open` は引数を取らない。OS recordの署名・全scope・時刻/high-waterとSQLite markerを同じcredential transactionで検査し、署名subjectとmarkerのowner hashが一致してからcontextを返す。callerからowner/context/時刻/鍵/DB pathを受け取らない。
- markerが欠損/locked、OS recordが破損、不正署名/owner不一致、期限切れ/時計逆行、OS更新失敗なら許可を返さない。OS recordだけからmissing markerを復活させない。
- 復元したauth issuerは、このnative deploymentのAuth issuerにも一致させる。署名の正しい別Auth issuerでも保存先を開かず、leaseをlockする。
- 既存workspace DBだけを`create_if_missing(false)`で開く。version 0のblank DBも拒否し、欠損/破損時に空のworkspaceやPageを作成しない。現在のcontext binding/schema検査を維持する。

## offline専用操作

- openの応答は `{workspace:{handle,context},expiresAt}`。署名grant/nonce/鍵は返さない。native側でhandleと署名許可の永続generation/期限を束縛する。
- `native_offline_check(handle)` と `native_offline_execute(handle,request)` は、同じlease世代・context・期限/high-waterを毎回確認する。local実行の前後でも確認し、commit中に期限をまたいだら成功を返さずhandleを閉じる。開始済みSQLのpending/元wireを消さない。
- 許可するのは既存local command whitelistだけ。ACK/receive/pullは拒否し、通常のnative send/read/catalog/prepareやオンラインlocal executorへoffline handleを流用できない。
- 新しい同owner grantでも旧handleを復活/延長しない。別processの再発行・logout・scope変更には、新しい復元とhandleが必要。世代不一致で旧handleを閉じても、新しい正当なleaseをlockしない。
- onlineのstatus確認や旧online cancelでoffline handleを巻き込まない。`native_offline_close(handle)` は一致するoffline handleだけを閉じ、別offline/onlineの新handleへ遅着closeを適用しない。通常closeは署名許可を消さず、logout/再認証は既存方針どおりleaseをlockする。

## client portと後続接続

`NativeOfflinePort` はオンラインportとは別クラス/入れ子のhandle型で、JSのverified Auth snapshotへ昇格させない。resumeはcaller引数なし、executeは元handleとimmutable requestだけを送る。期限変更や不正shape、実行失敗では閉じ、遅着成功を保存完了として返さない。dispose後のopen応答は、その応答のoffline handleだけを閉じる。オンラインfallbackや自動retry、send/read操作を持たない。

[検証記録](../../tests/evidence/native-offline-resume-20261016/SUMMARY.md)。実API由来grantを使ったnative再起動・offline追記の本文/vector照合と、Docker OS custody doubleの証拠を区別する。Windows候補の実GUI/実IMEや、offline Editorでの入力中draft/selection・composition確定後の閉鎖は未受入。

次は、署名設定済み候補で起動時にオンライン更新/保存済みoffline許可を選ぶUIを接続する。オンライン更新は旧leaseを無効化するので、offlineを選ぶ前に自動refreshを開始しない。local専用Page session、期限時のdraft保全、オンラインへ戻る際の同scope照合を接続してから、offline起動・編集を提供する。
