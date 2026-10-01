# Step 5の修正・検証記録

2026-10-01。[最終Docker検証](../../tests/evidence/step-5-page-store-20261001/SUMMARY.md)と[実機の独立証拠](../../tests/evidence/step-5-native-recovery-20261001/SUMMARY.md)。

- SQLite書込みのatomicityはRust repositoryの実際のtransactionに故障triggerを入れて検証し、binary update挿入とmetadataのupdatedAt変更が両方rollbackされることを確認した。
- browser SIGKILL後にtitleが空になった初回runでは、localStorageのtest device UUIDが変わり別DBを読んでいた。元DBにはtitle/updateが残っていた。nativeの固定DB pathと同じ試験条件にするため、fixture identityを起動ごとに明示し、再起動は`/`からlast opened Pageを選ばせた。titleだけでなくvector/full JSON/XMLも比較した。
- native復元画面で「別画面」リンクが既定Pageを指していた。loaded sessionのIDから導線を作り、Page IDをfactoryごとのclosureへ固定した。修正候補の実機画面とDocker E2Eで復元Page UUID一致を確認した。
- status更新の多い状態でnested Toggleの移動buttonが無効になるrunを観察した。Editor extension/NodeView構成をmemoizeし、不要なeditable変更を避けた。選択前提を実snapshotで確認し、focused repeatと最終全件がPass。個々のstatus rerenderが失敗を起こしたとまでは断定しない。
- crash repeatではclick直後の編集位置が別段落で、消す予定の段落が残るrunがあった。delete前にselection.parent、Home後のoffset、選択range長を確認し、移動対象も確認するようにした。調整後の3回と最終41件がPass。
- Rustの`raw_sql`からasync Tauri commandを作る際のSend制約に対応するため、固定schema statementをtransaction内で個別queryとして実行した。任意SQLのfrontend APIを追加せず、Linux locked checkとWindows buildを確認した。
- 制限付き起動でWebView windowが生成されず、cache・起動モード・plugin登録を変えても解消しなかった。通常のWindows権限で同じ候補を起動すると解消し、実機保存・復元が成立した。OS/security設定やhost toolchainは変更していない。
- IME候補のfooterでGoogle日本語入力と確認した。実キーによる変換・候補選択・確定は記録するがMicrosoft IMEのPassへ置換しない。残るnative項目・最終Gateは未判定。
