# Page CRDT本番契約候補

v0.22.0：workspace別Rust SQLiteのPage binary/queue/receipt/remote保存を追加。[耐久化と未接続範囲](../development/PRIVATE_PAGE_DURABILITY.md)。意味的Yjs検査/captured client session/通常Editor・IPCは次工程。

v0.21.0の実装：認証付きHTTP binary保存基盤/初期metadata/明示schema3を追加。[手順と未完成範囲](../development/PRIVATE_PAGE_DOCUMENTS.md)。Hocuspocus/WebSocket・端末耐久化・Editor/通常UI接続、snapshot/compactionはこの実装に含めない。

2026-10-05、設計案。中核はYjs/Hocuspocus、EditorはTiptap/ProseMirror。[採用条件](../decisions/poc-technology-selection.md)を維持する。

## 正本とschema

document所属はworkspace/Page metadataで管理し、本文正本はbinary update/snapshot。PoCの`body` XML fragmentと`page:{pageId}`名を基準にするが、名前だけで認可しない。Editor/Y.Doc schema versionとapp/storage/wire versionを分離し、未対応block/attrsの変換で内容を無断に落とさない。

projectionは本文JSON/plain text/preview/search。source document/clock/schemaを付けて再生成可能にし、projection欠落で本文を空にしない。Docのstate vector一致は同期収束の指標で、metadata/Task/Relationの同期一致を兼ねない。

## 耐久化と編集

1. Editor操作からYjs updateを生成し、端末commit完了まで対応送信frameを保留する。
2. 保存失敗は後続送信を遮断し、未保存の内容と復旧案内を保持する。
3. remote updateも同じ端末耐久境界を通す。送信待ちcoalescingはmetadata順序を跨がず、debounceで最初の保存を遅らせない。
4. serverはbinaryを耐久化してから対応するsync応答を返す。再起動後にupdateを欠かさず復元する。

Undo/Redoはlocal操作とremote操作の境界を維持する。remote-only text更新のselectionはYjs相対位置で復元し、composition/構造変化/UndoRedoへ強制適用しない。native navigation keyupの同期guardを含め、DOM/ProseMirror/Yjs各selectionを別に扱う。Microsoft IME再変換の受入例外はPoCの記録で、製品版全IMEの免除へ自動継承しない。

## snapshotと履歴

snapshot化は全updateをapplyしたbinaryと整合manifestをatomicに保存し、検査完了前に旧journalを消さない。snapshot後のupdateも順序/digestを検査し、journal破損を空Docへ置換しない。ユーザー向けVersion Historyと技術compactionを分離する。

閾値/保持期間/削除、offline peer、schema変換、新旧clientの混在、pending updateと削除済Pageの扱いは実装前に確定する。GCや全文JSONからのrebuildを単なる性能修正として先行しない。

## platform/受入

Nativeは実SQLite/IPCを利用し、WebはWASM/OPFS・IndexedDB/y-indexeddbの正本/commit契約を別途確定する。test-only HTTP Rust bridgeはWeb永続化の製品実装ではない。

全文/構造/clock/digest、offline kill/restart、同時編集、server再起動、remote composition、選択・Undo/Redo、schema非互換拒否、snapshot途中kill、workspace認可を検証する。初期Windows/Androidと後続Apple OSを分け、Docker browserを実IME/native lifetimeの代替証拠にしない。
