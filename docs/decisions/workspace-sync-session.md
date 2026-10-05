# Workspace同期sessionの全判断

2026-10-05、v0.13.0。P1のaccount/workspace切替・遅着応答を外部設定なしで検証する自主判断。

1. 新wire専用のportable WorkspaceSyncSessionを追加し、旧PoC engine/queueを変更しない。
2. issuer、subject、workspace、client、epochとtransport/store関数を生成時に捕捉する。tokenはcontextへ入れず、これは認証証明ではない。
3. sessionはclose後に再開できず、同じaccountへ戻っても新instanceを作る。ID比較だけで古い応答を復活させない。
4. closeはAbortSignalを止め、transportがabortを無視して返した場合もstore適用前に拒否する。closeでpending/cursorを削除しない。
5. 同時push/pullをbusyで拒否し、1応答の保存が終わるまで次の要求を始めない。poll/retry/active UIとの統合は別工程。
6. pushは既に耐久化されたJSON wireを前提に、送信時のbyte列（文字列）を変えない。同じID/内容のretryを維持する。prepared耐久化自体は未実装。
7. outbound workspace/client、inbound workspace/epoch/protocol/ACK identityを検査し、誤所属をstoreへ渡さない。
8. pullはlimit、cursor進行、hasMore/head、operation ID重複、strict昇順bigintを検査する。opaque cursorをclientで復号/推測しない。
9. JSON responseをコピーしてからfreezeし、transport所有objectを凍結しない。context/request/responseをimmutableにして元storeへ渡す。
10. transport/protocol/storage/closed/busyを固定errorにし、body/token/SQLをcause/messageへ出さない。未知commit結果や未送信intentを勝手に成功/破棄にしない。
11. close前に開始済みのcommitは捕捉した旧storeで完了し得る。closeがrollbackしたとは扱わず、close後にactive成功を返さない。native adapterのatomic receipt/cursor/所属検査は別ゲート。
12. 追加9条件はdeferred transport/storeによる非同期race検査として保存する。実Auth/HTTP workspace stream/SQLite保存/GUIの新証拠へ転用しない。次はこのportを受けるworkspace別durable prepared/receipt/cursor adapterが必要。

[検証証拠](../../tests/evidence/workspace-session-20261005/SUMMARY.md)。同期基盤の認証/metadata/bootstrapは別の実PG証拠を維持する。改善送信や規約同意のUIは設計だけで今回実装しない。
