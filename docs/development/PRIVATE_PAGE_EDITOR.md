# 認証付きPage本文の編集接続

2026-10-07 / v0.26.0。既存のverified `PrivateWorkspaceConnection`、captured `NativeWorkspaceStore`、`PageSyncSession`へ、1つのlive Y.Docと既存のPageEditorを接続する。通常アプリのlogin/navigationへmountする工程は残っている。

## 開く・閉じる

`PrivatePageEditorSession.open(connection, store, pageId, source)` は、storeが同じconnectionの現在generationに属することを確認する。

- `local` は保存済みmetadata/journalを検査して復元する。欠落・破損時に空Pageを作らない。
- `remote` は明示HTTP readを行い、native commit完了後のjournalを復元する。
- `create` は明示titleと既存schema1のempty binaryをnativeへ保存し、bootstrapをqueueへ積む。HTTP送信はまだ行わない。

どの入口も、復元・downloadだけで「同期済み」としない。旧PoC DB、Hocuspocus、browser storeへのfallbackはない。titleは初期値の読取専用で、rename/delete/metadata同期は追加しない。

connectionのAuth generation、Page sessionのabortを監視する。refresh/close/同Page置換でUIとruntimeを閉じ、遅着応答をlive Docへ適用しない。別Pageへ移るときはruntime.closeを待ってから元storeを閉じる。すでに受け付けたlocal appendは元Pageへ完了させる。Auth失効時はcaptured native handleのguardが働き、開始済みcommitが完了しても閉じたruntimeの成功として返さない。共有connection/storeをPage runtime自身は閉じない。

## 保存・同期

local Yjs updateをコピーし、直列Promiseでnative appendする。UIは開始時から保存中、commit後に保存済み/未送信件数を表示する。append失敗後は以後のqueueと送信を停止し、live本文をコピー可能な読取専用として残す。toolbar経由の変更も無効化する。エラーにnative原因・path・tokenを表示しない。

同期ボタンの1周期は、先行local commitを待ち、開始時に観測した有限のpending件数を正確なprepared wireで送信し、native ACK commit後にpendingを減らす。続いてlive state vectorからreadし、remote diffをnativeへcommitしてからDocへ適用する。ACK喪失はqueueを保持し、次の明示同期で同じwireを再送する。自動retry、timer、背景のrealtime接続は導入しない。

周期中の追加入力をrevisionで検出する。保存中/未送信/error/未反映remoteがなく、開始時からlocal revisionが変わっていない成功周期だけ「サーバーと同期済み」とする。この表示はその周期の確認で、以降のserver変更の常時監視を保証しない。並行syncはbusyとして拒否する。

compositionstartから、compositionend後にProseMirrorのcomposingが解けるまで、保存済みremote binaryをbufferする。その後まとめて反映し、remote updateを送信queueへechoしない。同じDocの本文DOM/Editorを保存状態の更新ごとに作り直さない。Docの切替ではeditorを再生成し、イベント解除はcaptureしたDOMで行う。遠隔text変更のrelative selectionを保持し、buttonから本文へfocusが戻る時にもPMの選択をDOMへ戻す。変換中のfocus補正はしない。

## 検証と残工程

unit doubleは保存順序、ACK喪失、composition待機、Auth遅着、Page切替、保存失敗/破損、別connection拒否、同Page置換、同期中入力を検査する。実HTTP＋署名fixture＋PostgreSQL＋Rust registry/SQLiteでもruntimeのedit/commit/sync/refresh/restart/reopenを検査する。Docker browserのinvokeはdoubleであり、実Tauri command起動の証拠ではない。

再現はDocker内で `npm run typecheck`、`npm test`、`npm run test:postgres`、`npx playwright test --workers=1`。native/crash driverは既存と同じRust libraryを `cargo build --locked --manifest-path apps/client/src-tauri/crates/page-store/Cargo.toml --examples` で各targetへbuildする。検証専用 `/private-editor.fixture.html` はtest hooks=1のDocker Viteから使い、通常frontendのbuild entryへ含めない。

通常アプリへの認証/一覧/編集接続、実ユーザーAuth、native credential/grant、失効後のoffline保持、metadata変更、継続認可付きHocuspocus、実Windows Microsoft IME/Android Gboardは未完成・未検証のまま残す。過去のnative証拠を今回のruntimeの合格へ読み替えない。

[判断](../decisions/private-page-editor.md)、[検証記録](../../tests/evidence/private-page-editor-20261007/SUMMARY.md)。
