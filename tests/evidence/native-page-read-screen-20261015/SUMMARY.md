# Native Page取得画面 — v0.93.0

[実装契約](../../../docs/development/NATIVE_PAGE_READ_SCREEN.md)。実account credential/本文を使用せず、合成の実Yjs journalとIPC doubleで検証した。

- 対象unit初回36。追加で保留中handle取消の試験を入れ、最終全unit533（62 files）を確認。
- 同じY.Docへlocal＋remoteをmergeし、独立peerの全文/vectorと一致。受信echoのappendなし、反復取得で二重表示なし。
- composition中の受信はnative journalへ保存されても画面へ反映しない。確定後だけmergeし、保留中にhandleが閉じた場合は反映しない。未送信local本文を保持する。
- read_unknown/store_pendingで表示を変えず自動retryしない。received後のload failureと不正journalを区別し、不正frameの部分適用を防ぐ。表示の明示再確認は追加read IPCなしで行う。
- desktop/mobileでprefix挿入後のtext selection/focus、local Undoがremoteを残すこと、合成composition保留、保存再確認のnetworkなし復帰、HTTP待機中logoutを検査する。
- 初回画面は32 Pass/2 Fail。editor DOMのtextContentにdrag装飾「⠿」が含まれた比較失敗。意味内容を表すeditor JSONで本文を照合するよう試験を修正し、元Failログを保持する。

最終画面回帰・型・Windows候補build/host版/SHA/source比較は回収ログ/JSONを参照。API/Rust本体は変更せず、v0.92.0の通常Rust42/専用TLS・署名API・PG4の証拠を保持する。本checkpointでそれらを再実行した意味ではない。native取得画面の実Windows invoke/実IME、remote構造変更の全ケース、一覧/catalog・offline lease・性能の受入は残る。

最終は型/全unit533、desktop/mobile画面34 Pass・Fail0。Windows候補のDocker buildとhost版0.93.0/SHA/compiled設定、native/auth/Editor/build script/manifestのsource一致を確認した。desktop/mobileの最終PNGを視覚確認。外部依存版は変更なし。SDK PDB/chunk-sizeと非GUI inspectorの既知icon警告をログに保持。gzipは元byte/decompress後hashを照合した。
