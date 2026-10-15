# Native workspace明示再接続 — v0.95.0

[実装契約](../../../docs/development/NATIVE_WORKSPACE_RECONNECT.md)。合成account/本文だけで実行し、実利用のcredential/本文は使用しない。Dockerの画面IPC double、実Rust/SQLite、専用TLS/署名API/Postgres、Windows候補の非GUI検査を区別する。

- 元Editorを閉じてscope付き未確認入力を保持し、1回のrefresh/bootstrap後にissuer/subject/workspace/client/epochを照合する。いずれかの変更で旧Pageの復帰を拒否し、新handleを閉じる。以前のPageが端末一覧の最初のwindowに含まれなくてもIDで検証して開く。
- pending/wireはそのまま残し、自動send/read/create/draft適用を行わない。取得済みのremote一覧だけを新handleで先頭から取得する。未取得ならqueryしない。一覧取得が失敗しても認証が有効なら端末本文を保持し、旧一覧/cursorは使わない。
- refresh/open/list/loadの失敗で自動retryや空Page作成を行わない。restore/open/load/catalog待機中のlogoutは旧結果を破棄し、遅着後に余分な状態確認や復帰を続けない。before/after unknown saveのdraftは明示的に不足分だけmergeでき、独立Yjs vectorと一致する。
- 最終unit556（63 files）Pass。追加の再接続18条件を含む。通常Rust46 Pass/5 ignore。追加Rust/SQLite結合はknown receipt/read cache/catalog進行を保持した旧接続からrestore→openし、元pending/wireが不変、旧cache/cursorが空、旧handle拒否を照合する。新handleの明示read/sendは新HTTP呼出しとなり、同じwireを送る。
- 専用TLS/署名API/Postgresの5件を別実行してPass。既存native refresh/同端末bootstrap・失効device拒否、Page送信4request/2frame・取得5requestとlocal pending1保持・本文/vector一致、一覧21件/20件ずつ・wrong epoch拒否・同じcursor再試行を再検証した。JS controller全体を実Windows invokeで実行した証拠ではない。
- desktop/mobile-dark-reduced-motion画面44 Pass/0 Fail/0 Skip。既存38件に、keyboard再接続・同一本文と端末入力の継続・取得済み一覧の先頭query・title draft保持・composition抑止・待機中二重Enter拒否・logoutの遅着破棄・refresh失敗後の手動ログイン復帰を追加。サーバー本文のsend/readは発生しないことを照合。PNGを視覚確認した。

初回の失敗は成功と分けて保持する。

- `target-first.log.gz`：追加unit17 Pass/1 Fail。catalog待機中にlogoutした後、閉じた旧queryのcatchが余分なstatus IPCを呼んだ。catch直後のrevision検査を追加し、余分な呼出しがない期待を維持して全18件/全unit556を確認。
- `ui-first.log.gz`：42 Pass/2 Fail。desktop/mobileとも再接続ボタンをnative disabledにした時にkeyboard focusが失われた。再接続中はaria-disabledとclick/controllerのbusy guardで二重実行を防ぎ、focusを維持する方式へ修正。変換中と他のbusyはnative disabledを維持。focus期待を外さず、処理中の二重Enter拒否も追加して44件を再確認。
- fixtureの文字列生成とstrict optional型の検査不備も修正。最初の構文検査ログを`type-first.log.gz`、最終型検査を`type-final.log.gz`に保存。型検査→候補build→E2Eの順で実行し、共通packageを書き換えるbuildを画面検査と並行しない。

最終Windows候補は0.95.0をDockerで生成し、hostの非GUI inspectorで版/SHAとnative-only設定・legacy command遮断・SQL plugin無効を確認。hostとbuildのnative/auth/Editor/build script/manifestsは同一（CRLF/LFのtext差を区別）。外部依存版の変更なし。SDK PDB/chunk-sizeと既知の非GUI icon警告はrawログに残す。gzipは元byteと展開後SHAを照合。

実Windows GUI/実Microsoft IME、Android、OSの自動再接続・変更feed/自動同期、offline leaseの画面接続・失効/復帰・性能・最終Gateは未受入。次はoffline leaseの画面接続と失効・復帰、その後実機受入を進める。
