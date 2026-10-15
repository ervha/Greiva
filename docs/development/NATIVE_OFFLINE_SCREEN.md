# Native offline起動・編集画面

v0.98.0。[native復帰とlocal gate](NATIVE_OFFLINE_RESUME.md)を起動選択・端末一覧・Editorへ接続する。署名設定と有効な端末保存許可が必要であり、設定のない候補でoffline編集を提供する意味ではない。

## 起動と操作

- 本番native entryは認証状態の読み取り後に接続方法を表示する。onlineを明示する前にrefresh/bootstrapを開始しない。offlineは引数なしの復帰後、返されたcontextの端末一覧だけを読む。復帰失敗でonlineへfallbackしたり、空の保存先/Pageを作らない。
- offline local adapterは元offline proofとworkspace handleを保持する。Page sessionのlocal executeだけを提供し、send/readの能力は持たない。controllerも送信/取得/catalog/許可準備を拒否し、画面に送受信操作とサーバー一覧を出さない。
- 端末保存済みPageの表示・作成・追記と一覧の続きを利用する。local commandはnative側で操作前後の署名許可/世代/期限を検査する。本文・pending・wireの保存契約は変更しない。

## 期限と入力保全

- 表示する期限は前回確認値。JS timerはnativeへ再確認する契機であり、JS時刻から編集権限を生成/延長しない。時計差で連続確認しないようoffline timerは最低1秒間隔。local操作は別途nativeで毎回検査する。
- 許可確認/保存失敗で結果不明のwriteを再送せず、表示を成功にしない。画面をlockし、本文composition中は同じDoc/DOMを維持、確定後にscope付きmemory下書きとして保持して閉じる。部分的にcommitされた変更も、同scope再接続後の明示復元でYjs mergeし、二重入力にしない。
- 新Pageの未作成タイトルも全contextごとのmemory下書きとし、変換中の期限切れで入力欄を外さない。確定後に接続選択へ戻り、同scopeで再表示する。別scopeへ流用せず、画面破棄で本文/タイトルのmemory下書きを破棄する。下書きの永続保存は約束しない。

## online復帰と遅着

「onlineへ接続」はcomposition/保存中を避け、旧Editorの終了とoffline handle閉鎖後に明示refresh/bootstrapする。全context一致時だけ選択Pageを開き直す。変更時は旧Page/下書きを新scopeへ出さず、workspaceを確認する。失敗時もpending/wireを削除せず、自動送信/自動retryしない。

logout/disposeは未完了のoffline openも無効化し、後から成功した旧handleだけを閉じる。遅着結果から一覧/Editorを復活させない。通常のworkspace closeはoffline grantを消さず起動選択へ戻し、logout/再認証ではnativeの既存lease lock方針に従う。

[検証記録](../../tests/evidence/native-offline-screen-20261016/SUMMARY.md)。DockerのIPC doubleによる画面/合成compositionと、既存nativeの実HTTP/SQLite/OS custody doubleの証拠を分ける。Windows候補のbuild/非GUI検査は実GUI invokeや実Microsoft IMEの受入ではない。設定済み候補での実offline起動・編集・再起動・online復帰、Android、性能・最終Gateは別途必要。
