# Native offline起動・編集画面 — v0.98.0

2026-10-16。[実装契約](../../../docs/development/NATIVE_OFFLINE_SCREEN.md)。v0.97.0の専用handle/local gateへ起動選択・端末Page一覧・Editorを接続した。実account/私的本文を使用していない。

- 本番native entryは起動時に状態を読み取り、接続方法を表示する。選択前のrefresh/bootstrapはない。offline復帰失敗でonline fallback、Page作成、credentialの自動再試行をしない。
- offline adapterはlocal executeだけを持ち、Page sessionにも送受信の能力を渡さない。controllerと画面もsend/read/catalog/許可準備を拒否/非表示にする。local Pageの作成・保存・表示・再表示を検証した。
- nativeの期限再確認で失効すると、本文composition中はDoc/DOM/focusを維持してlockし、確定後にscope付きmemory下書きとして保持する。新Pageタイトルも全contextに束縛し、変換確定まで入力DOMを外さず、別accountへ流用しない。画面破棄時にmemory下書きを破棄する。
- 保存応答喪失時に結果不明のappendを再送しない。同scopeで明示復元した場合はYjs mergeによりcommit済み本文を重複させない。online復帰は旧Editor/handleを終了してからrefresh/bootstrapし、全context一致時だけ選択Pageを開き直す。送信/取得は引き続き明示操作。
- logout/disposeが未完了offline openに勝ち、遅着結果の旧offline handleだけを閉じ、一覧/Editorを復活させない。

## 検証

- Docker型検査Pass。最終追加E2Eコードも`tsc -p tsconfig.tests.json`でPass。
- 全単体575件/66 files Pass。新controller8件を含み、起動時無refresh、欠損lease、local-only能力、期限中composition、保存応答喪失、同scope復帰/別scope拒否、遅着logout、タイトル分離を検査。
- 最終desktop/mobile-dark-reduced-motion画面60 Pass/0 Fail/0 Skip/0 retry。offline新規Page作成/端末保存/reopen、keyboard起動/online復帰、body/titleの変換中失効とfocus、未確認保存の明示復元を追加。既存online保存/送受信/catalog/reconnectも回帰確認。PNGを視覚確認し、両viewport内に収まることを検査。
- Windows候補0.98.0をDockerでbuild。SHA256 `184f4f5df698449154308b15fe78db32fa7ea71ab7d21702c17414a5a273e75a`、PE x86_64、host/buildのnative/auth/Editor/build script/manifests一致を確認。CRLF/LFだけのtext差を区別し、外部依存版は不変。非GUI inspectorはexit 0、native-only/旧command遮断/SQL plugin無効/署名pin未設定を確認。

初回画面回帰は57 Pass/3 Fail。2件は旧「画面接続は準備中」という説明の期待値で、新しい説明へ更新した。残り1件はremote応答を反映する前に、Home/word移動のキー操作で選択範囲を作れなかった失敗。同じテスト/厳しい本文・selection・focus・Undo期待を変えずdesktopで3回繰り返してPass、最終全60件でもPassした。単発の選択準備失敗の根本原因は未特定であり、製品不具合を修正したとは扱わない。元ログ`ui-first.log.gz`、再確認`selection.log.gz`と各result JSONを保持する。

build/型検査の完了後にVite画面試験を実行した。SDK PDB/chunk-sizeや非GUI inspectorの既知icon警告はrawログに保持。gzipの元byte/展開後SHAを`log-hashes.json`へ保存した。表示画像・ログは合成fixtureだけで、token/grant/秘密鍵/配備credentialを含めない。

## 未確認の境界

今回の画面はIPC double/合成composition。実nativeの署名context復元・SQLite/pending/wire・本文/vectorは[v0.97.0の別試験](../native-offline-resume-20261016/SUMMARY.md)を参照し、今回再実施した結果として数えない。候補は署名pin未設定でoffline準備無効。実Windows GUI/WebView offline invoke/実Credential Managerと実Microsoft IMEでのこの画面の受入は未実施。memory下書きはアプリ終了/強制終了を越える保存保証を持たない。

次は署名設定済み候補での実offline起動・既存本文復元/編集・保存後強制終了/再起動・明示online復帰、実IME/再変換の受入を進める。既存の再変換Failと性能・Android・最終Gateは未解決のまま維持する。
