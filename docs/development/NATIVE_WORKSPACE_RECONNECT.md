# Native workspaceの明示再接続

v0.95.0。接続済み画面の「workspaceへ再接続」で、現在の認証を一度更新し、workspaceのbootstrapと端末保存を確認して同じPageへ戻る。

1. 本文/タイトルのcomposition、保存・送受信中は開始しない。旧Editorを閉じ、未確認入力は既存のscope付きmemory draftへ残す。
2. refreshは1回、bootstrapは1回。旧handle、remote一覧とcursor、旧read/ACKのmemory cacheを破棄する。通信失敗で自動retryしない。
3. nativeから返った新しいcontextのissuer/subject/workspace/client/epochを以前の値とすべて比較する。どれかが変わった場合は新handleを閉じ、旧Page/一覧を復帰しない。利用者が接続先を確認してworkspaceを開く。
4. 同じcontextなら端末一覧を読み直し、選択していたPage IDのjournal/Yjsを検証して新しいEditorを作る。最初の50件にそのPageがなくても直接読み込む。存在しないPageを空のPageとして作成しない。
5. 以前サーバー一覧を取得していた場合だけ、新しいhandleで先頭から1ページ取得する。以前の続きcursorを使わない。未取得なら自動queryしない。一覧失敗時は認証を確認し、接続が有効なら開き直した端末本文を保持し、remote一覧は未取得/エラーとして扱う。
6. 本文のremote read/sendやdraftの適用はこの操作に含めない。元のpending/wireを保持し、利用者の明示取得・送信・「保持した入力を戻す」で続ける。保存済みのunknown commitに対するdraft復帰はYjsの不足分だけをmergeする。
7. logout/dispose/他の接続操作が先に進んだ場合、各await後のrevision/handle検査で遅着結果を破棄し、作成途中のEditorも閉じる。破棄後に状態確認や接続の再開を続けない。

タイトル作成フォームは再接続中も同じDOMを保持し、未作成の入力を消さない。再接続ボタンは処理中にaria-disabledとclick/controller guardで二重実行を防ぎ、keyboard focusを保持する。ほかのbusy/変換中はnative disabledにし、compositionを強制終了しない。

[検証記録](../../tests/evidence/native-workspace-reconnect-20261015/SUMMARY.md)。DockerのIPC doubleとRust/SQLite・実HTTP/API/PG、Windows候補buildの境界を区別する。OSによる自動再接続、変更feed/自動同期、offline leaseへの切替、実Windows GUI/実Microsoft IME・Androidの受入は別工程。失効後のログイン/認証更新は従来の操作を使う。

検証は型検査→候補build→画面E2Eの順に行い、同じworkspaceのpackage/distを書き換える処理をVite画面テストと並行実行しない。
