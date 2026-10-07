# Page編集接続の全判断

2026-10-07 / v0.26.0。利用者の開発再開指示に従い、v0.25.1で保留したPage本文の接続を進める。以下は既存契約内の実装判断で、追加のproduct回答や新しいAuth grantではない。

1. 通常アプリの入口を一括置換せず、verified connection/storeを受けるruntimeと再利用可能なviewを作る。
2. storeとconnectionのinstance所属を確認し、別connectionのAuthで元storeを開かない。
3. local復元、明示download、明示createを分け、欠落/破損を空Pageへ作り直さない。
4. native journalのbinaryを新しいgc=falseのlive Docへ復元し、JSONを正本にしない。
5. local updateをコピーして直列commitし、保存中と保存済みを分ける。
6. append失敗はterminal storage状態にし、未保存本文のコピーを可能にしてbody/toolbar/送信を停止する。
7. 同期開始は先行commitを待つ。有限のpending snapshotをdrainし、連続入力で送信周期が終わらなくなることを避ける。
8. native prepared wireをそのまま再送し、ACK lossでpendingを消さない。
9. read diffはnative commit後にlive適用し、private originで送信queueへのechoを避ける。
10. composition中もremote commitを先に済ませ、live反映は変換終了とPM composing解除を待つ。
11. generation/同Page置換のabortをruntimeへ伝える。古いruntimeが新しいPageのDoc/storeへ応答を適用しない。
12. Page closeは開始済みlocal commitを元Pageへdrainする。Auth失効をoffline grantへ置き換えない。
13. revisionとpending/error/remote bufferで同期済みを判定する。復元だけでは未確認、同期中入力も未確認に戻す。
14. metadata変更は未実装なのでtitleを読取専用とし、初期titleをrename済みと表示しない。
15. session prop切替で旧状態を新Docへ表示せず、Doc境界でeditorを再生成する。composition effectはDOMをcaptureし、破棄済みviewを参照しない。relative PM選択は正しかったが、buttonからelement.focusするとDOM caretが先頭へ戻る不備を画面試験で発見。非compositionのfocus時にview.focusで選択を再照合し、既存全画面回帰で確認する。
16. Browser invoke doubleと実HTTP/PG/Rust SQLiteのruntime試験を分ける。合成compositionを実Microsoft IMEの証拠にしない。初回fixture経路/選択失敗を保持する。
17. Dockerの既存image/cacheを再利用する。npm symlink所有権/未cache依存を解決し、host global toolchainを追加しない。Windows buildも既存debug cacheを使い、release artifactとは区別する。
18. 新しい編集接続なのでMINOR 0.26.0。所有manifest/両lockを揃え、外部依存、旧DB、既存専用API/previewを保持する。追加手操作を求めず、次は通常アプリの認証/一覧/編集compositionと残るnative認証境界を進める。

[契約と残範囲](../development/PRIVATE_PAGE_EDITOR.md)、[証拠](../../tests/evidence/private-page-editor-20261007/SUMMARY.md)。
