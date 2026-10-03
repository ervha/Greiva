# Windows 0.6.17: 全必須block・保存照合とdrag診断

2026-10-04、記録・製品checkpoint 0.6.17。通常版で同一Pageの必須11種類のblockと保存照合を確認。native pointer dragと最新実Microsoft IME、最終Gateは未確認のまま。以下の0.6.11失敗・0.6.17準備履歴は原結果として保持する。

2026-10-03。v0.6.16 commitの後に通常0.6.11でWIN611-ALL-OPS（01a1021e-b82a-7528-aa1f-064c12de483e）を作成。`##`＋実SpaceのMarkdown shortcutでH2を挿入・本文編集、Slashの見出し3候補をpointer選択してH3本文を編集した。[原観測](observations.json)。文字入力はliteralで実IMEの証拠ではない。UIAのtreeは直後に前の状態を返すことがあり、画面と次の観測・停止DBを分けて扱う。

H3 handleからH2前へpointer dragを2回行ったが、H2→H3の順序が変わらなかった。[修正前画面](before-drag-fix.jpg)・[失敗記録](../../../docs/failures/step-8-windows-native-drag.md)。修正前の停止SQLiteは `.data/windows-drag-0617/before-copy` に保持。その他のIME fixtureを編集していない。

0.6.17候補では通常main windowの `dragDropEnabled: false` を設定し、WebView2のnative file-drop interceptionを外す。[Tauri公式資料](https://v2.tauri.app/reference/config/#windowconfig)。frontend drag／Yjs／IME codeは変更しない。app所有manifest／lockfileを0.6.17へ整合し、[外部npm314 entryとCargo依存不変](version-audit.json)を確認した。

[Docker build controller](build.mjs)・[1372 inventory file照合／normal frontend／feature／Windows release cross-build](build.json)、[frontend原log](BUILD.log)・[cross-build原log](RELEASE-CROSS.log)。inventoryは過去証拠・文書を含み、現在program/config照合対象はREADMEを除く135ファイル。[Dockerの関連8 E2E](playwright.json)はMarkdown6条件、MOVE・HANDLEで全Pass。これらはnative dragの修正後Passではない。

通常0.6.17 release exeのSHA256は `c96b702c2cac920ef639c140f83b5be3d5f55c3277062d3d6455ffa80a1e70a7`、13,092,864 bytes。identifierは同じ隔離保存先 `dev.greiva.poc.bench20261003v611` を再使用し、Page URLだけWIN611-ALL-OPSへ設定。**保存先名にv611を含むが、実行物の版は0.6.17**。candidate overrideは製品window設定をspreadし、dragDropEnabled=falseを落とさない。

起動後、Computer Useが `failed to activate captured window` を返した。fresh window選択からactivationを1回再試行し、同じエラーだった。[原状態](fix-activation-state.json)・[読み取りだけの画面](fix-activation-state.jpg)。以後native入力を行わずComputer Useを解除した。Greivaは手動確認用に起動したまま。利用者へH3をH2前へdragしCtrl+Zで戻す操作を依頼しており、回答待ち。

準備時点ではcommit／tag／pushを保留した。以下の追加診断・通常版検証を受け、0.6.17を**設定と限定検証のcheckpoint**として記録する。native drag修正完了や全Gate Passを意味しない。0.6.16までの既存証拠とタグは変更しない。

## 画面復帰後のComputer Use再試行（2026-10-04）

利用者がPC画面の消灯を報告し、再試行を依頼した。fresh window選択から0.6.17の前面化・画面取得・本文クリックが成功した。以前のactivation blockerはこの再試行では発生しなかった。ただしH3 handleからH2前へのSendInput dragは、位置を変えた2回とH3本文をクリックしてからの1回、計3回とも順序がH2→H3のままだった。[原観測](retry-observations.json)・[最終画面](retry-final-saved.jpg)。最初の2回は直後と別のcaptureで結果を確認し、3回目も最終captureで順序不変を確認した。

本文移動がなくUndoも無効のためCtrl+Zは送らなかった。最終画面の「端末に保存済み」を確認し、本文・タイトルを変更せずGreivaを起動したままComputer Useを解除した。0.6.17設定だけでnative pointer dragが直ったという証拠は得られていない。SendInputのdragと物理mouseの違い、および実際のdragstart/drop配送はこの観測だけでは区別できず、製品原因を断定しない。native dragのPass／Gate A完了は引き続き保留。

## 配送診断と通常版の追加確認

通常版を保存済み表示後にAlt+F4で閉じ、停止を確認してSQLite／WAL／SHMをコピーした。[copy hash](retry-copy-hashes.json)・[read-only照合](retry-verification.json)では元2 Pageの全文・clock・更新履歴が再試行前と一致。WIN611-ALL-OPSの8更新、H2→H3の順序も不変。[監査script](verify-unchanged.mjs)。

別identifier `dev.greiva.poc.dragprobe617` の**診断専用**artifactをDockerで作成した。[logger・Rust append command・設定・SHA256](diagnostic-build.json)・[controller](diagnostic-build.mjs)・[Rust seed](diagnostic-seed.mjs)。通常版と同じblock code／dragDropEnabled=falseへ観測loggerと単純HTML5対照要素だけを追加し、終了後にDockerの製品sourceを復元した。loggerはイベントを合成しない。初回のlogger Promise型エラーを修正し、root実行によるxwin cache待ちを中止して既存node user/cacheで再buildした。metadataのdirectory copyは既存宛先にnestedになったため、最後に明示file copyでactual artifact hashを照合した。診断は製品合否に混ぜない。

DRAG617-PROBEをofflineにし、Editor drag2回と独立したHTML5対照drag1回を実行。[原native events](diagnostic-events.jsonl)・[画面](diagnostic-final.jpg)。trusted dragstart3回、Editorではcustom MIMEを含むdragenter、長い移動ではdragoverとpreventDefault=trueを確認した。しかし**dropは全3回で0件**。対照でもdragoverはpreventDefault=trueだったがdropが届かなかった。Editor/Yjs固有の欠陥や自動操作層の欠陥を断定できず、物理mouseによる通常版drag／Undoが残る。診断Pageと通常版の旧Pageは変更せず保存、診断appは閉じた。

通常0.6.17でWIN617-NATIVE-MARKDOWN（`01a10266-6277-728d-9e30-63ebe38a7c05`）を作成。literal接頭辞と実SpaceでH1／Bullet／Ordered／Todoを挿入、本文編集、Bulletのpointer indent/unindent、Todo check、本文全選択Delete→Ctrl+Z→Ctrl+Y→Ctrl+Zを確認。[23更新の監査](remaining-verification.json)・[観測](remaining-observations.json)。保存表示後に終了・再起動し、保存したPageを選んで[4種とchecked状態の復元](native-restart-restored.jpg)を確認。接続中再起動で、offline復旧や起動時間測定ではない。

さらに同じPageへSlash＋EnterでH2、H3、Quote、Code、Divider、Toggleを追加・編集。内側ToggleをSlashで作り、本文編集、内側Ctrl+Enter閉／開、外側pointer閉／開を確認。全11種類を全選択Delete→Undo→Redo→Undoで復元した。その後通常ParagraphへMention（demo-page）を挿入・編集し、Ctrl+Shift+Up→Undo→Redo→Undoで順序復元。[最終全block画面](native-all-blocks-key-move-final.jpg)・[最終保存画面](native-all-blocks-final-saved.jpg)。保存後にAlt+F4で閉じ、停止してDBをコピーした。[hash](all-blocks-copy-hashes.json)・[59更新の全文／構造／clock照合](all-blocks-verification.json)・[監査script](verify-all-blocks.mjs)。独立Hocuspocus peerの全文・clock一致、既存2 Pageのtitle／全文／clock不変。move後の末尾detailsへ既存trailing-nodeがempty paragraphを追加するため、初回監査の期待値をこの既存正常化に合わせて訂正した。raw履歴は変更しない。

実IME可否は別Page WIN617-IME-ACCESSで試した。Ctrl+CapsLock→n、Ctrl+CapsLock、Alt+Shift→iで本文はASCII `Ni`、候補ウィンドウも返らなかった。Alt+Shiftをもう一度送り、保存後に閉じた。[画面](native-ime-access-unconfirmed.jpg)。provider／日本語compositionを確認できず、IME失敗・Passへ読み替えない。永続OS設定を変更していない。物理Microsoft IMEによる最新遠隔compositionと1,000 block入力体験は利用者の入力が必要。

全fixture・失敗記録を保持し、Computer Useは解除、Greivaは終了済み。通常exeは既存hashを維持する。診断exeは別hash／保存先であり、通常exeへ置き換えない。[Gateレビュー案](../../../docs/plan/GATE_REVIEW_DRAFT.md)に残る操作・判断をまとめる。

## 過去のスキップを現在の環境で再確認

診断専用buildの最終原logは[frontend](diagnostic-frontend.log)・[Windows cross-build](diagnostic-cross.log)。通常版のbuild log・artifactと区別する。

[再実行controller](skipped-recheck/recheck.mjs)でpackages／servers build後、実PostgreSQLの5 suite・20 testをDocker実行し、全20 Pass、skip／Fail 0。[run](skipped-recheck/run.json)・[JSON](skipped-recheck/vitest.json)・[原log](skipped-recheck/postgres.log)。[照合script](skipped-recheck/audit.mjs)・[結果](skipped-recheck/audit.json)で0.6.11通常runの20 skipのテスト名が旧別実行と今回の成功に全件一致した。初回監査はassertion statusをpendingと誤読し、実際のskippedへ対応して再実行。製品試験結果は変更しない。

host／試験containerのprogram/config135ファイルが通常buildと一致、Windows cross-containerも診断後にinventory一致、通常host exe hash不変を確認。文書の追記は別記。既存ADBでdevices一覧だけを確認しPixel 7接続なし、Greiva process 0。新しい接続／前面化要求は送っていない。[スキップ・未実施の整理](../../../docs/plan/SKIPPED_VALIDATION_REVIEW.md)に補完証拠と残条件を統合し、Gate Passへ読み替えない。
