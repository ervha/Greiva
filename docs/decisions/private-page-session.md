# 認証付きPage sessionの全判断

2026-10-05、v0.23.0。利用者の自律継続指示に基づき、追加手操作なしでP1/P2のclient保存境界を接続する。

1. protocolにnative prepared Page sequence/kind/digest/wireのstrict型を追加し、portable PageSyncSessionを独立実装する。Task/Relationの既存WorkspaceSyncSessionを置換しない。
2. issuer/subject/workspace/client/epoch/Page/doc名/schemaを構築時にcapture/freezeする。Page wireのepoch追加/resetは今回は導入せず、登録済みworkspace/現在のAuth leaseとnative bindingで固定する。将来epoch resetには別protocol判断が必要。
3. Pageの送信元は端末commit済みprepared要求だけにする。kind別strict request/client/schema、V1 bytes完全消費/構文、SHA-256とprepared digestを送信前に照合し、元wireの空白も含めそのまま送る。
4. client codecはBuffer/Node cryptoを使わず、atob/btoaとWebCryptoを使用する。public Yjs decoderとgc:false scratch Docで構文検査し、JSON/plain text projectionへ変換しない。未知XML/attrsや未到着依存を残す。
5. cryptoは非同期なので、構文検査/hashの前にcallerから値を分離し、hash後/transport呼出前/response後/保存前にもcloseを確認する。validation中に閉じたsessionから新しいnetwork要求を出さない。
6. responseはstrict parseとJSON copy後にfreezeし、foreign scope/Page/doc/schema、bootstrap title/digest、append digest/order/canonical vectorを検査する。Page read head0もprotocolで拒否する。
7. read updateのcanonical bytes、V1完全消費/構文、SHA-256、metadata/vectorを検査してからdurable receiveへ渡す。合成diffに入力frame上限を流用せず、600k/未知block保持を検証する。server vectorは端末保存・全peer同期完了の証明にしない。
8. 同一Page session内の処理をbusyで直列化する。別Page sessionは独立し、同Pageを開き直すと古いinstanceだけ閉じる。closeしたinstanceは同IDで作り直しても復活しない。
9. transport/storeのmethodを構築時にbindする。await後にcurrent UI/storeを再解決せず、callerがportを差し替えても元store以外へcommitしない。
10. close時はAbortSignalを発火し、遅着ACK/readは保存しない。すでに始まったcaptured旧storeのcommitは完了し得るが、成功として復帰せず新storeへredirectしない。commit後のEditor applyは通常IPC/UI工程で別のactive guardを持つ。
11. PrivateWorkspaceConnection.openPageを登録済みAuth generationに固定する。refresh/close/401/403で全Page sessionを閉じ、同Page置換では他Pageや共有Authを閉じない。現在のAuth/owner/leaseを保存前後にも照合する。
12. 外部fetchは関数として呼び、connectionをnative browser receiverにしない。既存固定API origin/timeout/no credential redirect/cache/安全なerrorを継承し、Pageごとのpathをtrusted compositionから作る。
13. errorはclosed/busy/protocol/transport/storageに限定する。token/SQL/private path/response causeを返さず、network/保存失敗で元pending wireを置換・削除しない。
14. test-only workspacePagePortで実Rust/SQLiteのPage ACK/receiveへ接続する。signed fixture HTTPの実PGケースを拡張し、追加local編集/remote受信、Auth refresh旧session拒否、再登録/403でpending保持を検証する。通常Tauri IPC/Editor/native Authの完成証拠ではない。
15. 新Page12＋connection3のunit、既存実PG66、型/frontend/Windows cross-build/source111/外部lockを検証する。実Docker Chromium1ケースでsecure context、WebCrypto hash/base64、正確なwire/commit/不正digest拒否を確認する。実WebView2/Androidのcrypto/IME証拠とは区別する。
16. backend schemaは3、端末6、wire1を保持し、所有版を0.23.0へ合わせる。UI変更なしで既存画面回帰を保持し、旧PoC/SQLite/IMEデータを変更しない。継続WebSocket認可、metadata editing、通常UI/IPC、実Auth/OS credential/telemetryは未完成として残す。

[契約](../development/PRIVATE_PAGE_SESSION.md)、[証拠](../../tests/evidence/private-page-session-20261005/SUMMARY.md)、[全判断索引](../plan/AUTONOMOUS_DECISIONS.md)。次はnative workspace/Page repositoryの安全なIPC handleと通常アプリへの接続を進める。
