# v0.80.0 OS offline leaseと保存gate

2026-10-13。[契約](../../../docs/development/NATIVE_OFFLINE_LEASE.md)。UI/native provider接続前のnative local境界。

| 検証 | 結果 |
| --- | --- |
| Rust | 最終12 Pass。credential5/grant3/lease4。OS doubleの再起動・clock・期限・書込み/cleanup失敗、実SQLite registryのpending保持と不正ACK拒否 |
| Windows実機 | 3プロセスでOS grant保存→再起動し元pending wire復帰→logout→再起動lockedを確認。専用架空credentialのみ、cleanup成功 |
| 通常回帰 | unit484 Pass、型/servers/frontend/Windows build Pass。test hooks0、通常0.80.0 PE/SHAをhost照合 |
| Source | Host/Docker392件一致（raw382、改行のみ10）、対象外5件はverification.json |
| 依存 | npm315/Cargo506・135の外部entry不変。既存getrandom0.2.17を直接参照 |

Windows probe SHA-256 `422e9defe48f3c4d9be19b6240f2bb8648e44127c6c092d3dfc1fbe62017b4fc` はDockerとhostで一致。pending hashも保存時と復元時で一致。token/key/本文は証拠へ含めない。native-unit.logは保存gate接続前の11件、native-final.logが接続後の12件。Windows linker warningを保持。

今回追加したgateはpreviewの既存IPCにまだ登録しない。全PG228はv0.79.0、SIGKILL7はv0.78.0の証拠を保持し、この版で再実行したとはしない。実Auth・UI/draft閉鎖・IME・Android・最終Gateは残る。
