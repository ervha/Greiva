# 個人workspace Page本文保存の全判断

2026-10-05、v0.21.0。利用者の継続開発/判断委任に基づく自主判断。実Authの追加手操作を求めず、P1の本文保存と認可を先行する。

1. Pageは既存Task/Relation operation wireへ混ぜず、独立protocol1のbinary bootstrap/append/read契約を追加する。PoCの未認可Hocuspocusを公開用として転用しない。
2. これは認証付きHTTPの保存基盤で、最終collaboration transportの置換ではない。WebSocket/Hocuspocus、Editor、通常UI、端末耐久queueへの接続は後続工程にする。
3. owner/device/live Page認可、本文journal/head更新を同一PostgreSQL transactionで行う。期限切れ/失効/削除時に読取・書込を拒否し、署名を先に検証する。
4. Hocuspocus接続時は初回Authだけでなくinbound/outbound・expiry・失効・room cache/broadcastも検査する必要がある。HTTP試験だけで継続接続の認可完了とはしない。
5. schema2から3への明示upgradeのみを許す。既存Page resourceがあれば本文の帰属/取り込みが不明なので拒否し、空本文を創作しない。structured data/key/epochは保持する。
6. schema版行のFOR UPDATEとmetadata排他を用い、同時認可処理の終了を待つ。通常startupはread-only readinessだけで、欠落表やjournalを修復しない。
7. Page IDをclientの安定bootstrap identityにする。同じparsed requestは再送可能、client/title/initial binaryを変えた同IDは409、foreign owner/issuer/device/Pageは403とする。
8. 初期title/id/yDocId/createdAtを保持する。新しい本文frameではheadとupdatedAtを同じtransactionで更新し、重複frameでは更新時刻を進めない。bootstrap再送は現在のmetadataを返すため、後の本文変更後まで応答全体の不変性を宣言しない。
9. metadata rename/deleteの同期・三値Conflictは未実装。初期title保存をPage metadata同期全体の完成と表示しない。
10. binaryはV1 Yjs updateをappend-onlyで保持する。JSON/plain text projectionから本文を再構築せず、gc:falseで未知block/attrs、clock、未到着依存、delete setを保存する。
11. 各frameのSHA-256と実bytesを照合し、同frame再送は元serverOrderを返す。ACKは現在のhead/state vectorを含むため、他更新後の応答全体は不変ではない。
12. Page単位のhead row lockで順序を直列化する。decimal string/bigintを使用し、上限で保存しない。frame/headは同一commitで、結果不明時は同bytes再送で重複を防ぐ。
13. readはheadをFOR SHAREで固定し、全journalの連続order/digest/bytesを検査して復元する。欠落/破損/orphanは503で空Docへresetしない。
14. state vectorは差分計算の入力で、認可証明/cursor/端末保存済み証明ではない。読み取り応答は全server vectorと差分digestを返す。
15. 宣言Editor schema1だけを受け、未知版は409とする。binaryの内容をEditor JSON schemaへ変換しないため、意味的Editor互換性の検証とは区別する。
16. 診断用の入力上限はupdate512KiB/title65,536文字/vector65,536 base64文字。合成したread update/vectorへ入力上限を適用して保存済み本文を取得不能にしない。製品の最大Doc/性能/retention契約ではない。
17. 固定Yjs13.6.33の公開decoderで全bytes消費を検査する。decodeUpdateだけが許す末尾garbageを拒否し、vectorもcanonical re-encodeで検査する。APIの依存宣言は既存固定版を再利用し、外部lockを更新しない。
18. pg query portにはprimitive hexを渡してbyteaへdecodeする。mutable Buffer/toPostgres hookを認可leaseへ持ち込まず、caller requestはparse後の値を捕捉する。
19. Repository内のprivate認可/ledger/binary SQLはparameterized node-postgresで同じlease clientへ固定する。Drizzleを全面廃止しないが、別pool/別transactionによる認可後writeを避ける。要件/architecture/技術stackへこの例外を明記する。
20. 実worker SIGKILLをCOMMIT直前/直後で行い、同frame再送後journal/headが一度だけ増え、本文/vectorが復元することを確認する。製品へcrash hooksを追加しない。
21. 初回の期限切れ試験は、構築時に捕捉済みDate.nowへ後付けspyが届かず失敗した。mutable clockを構築前に設定してlock待機後rollbackを再確認した。Windows build初回EACCESはコピーしたlockfileの所有権をrootで修正し、non-root buildを再実行する。権限/型検査を緩めない。
22. 通常/実PG/型/frontend/Windows cross-build、source/所有版/外部lockを確認する。UI変更なしで既存v0.18回帰証拠を保持し、専用local API/previewだけ明示schema3へ更新。旧PoC/DB/実機IMEデータ・実Auth・telemetryは変更しない。

[導入手順](../development/PRIVATE_PAGE_DOCUMENTS.md)、[検証証拠](../../tests/evidence/private-page-20261005/SUMMARY.md)、[全判断索引](../plan/AUTONOMOUS_DECISIONS.md)。次はworkspace/Pageごとの端末耐久化と固定されたclient sessionを進める。
