# Native workspace IPCの全判断

2026-10-05、v0.24.0。利用者の継続開発/自律判断委任に基づく。追加手操作を求めずnative保存先の接続境界を先行する。

1. native保存rootはアプリconfig/private-workspacesに固定し、WorkspaceContextのcanonical JSON SHA-256をファイル名にする。frontendに任意path/SQL/root指定を許さず、旧greiva.sqliteと分離する。
2. local handleは保存先/世代のbindingで、native JWT grantやoffline権限ではない。trusted applicationが検証済み登録からopenする前提を明記し、caller contextだけでnative認証を完成扱いにしない。
3. registryごとのinstance namespace＋単調generationでhandleを再利用しない。instanceはtimestamp/pid由来の一意性用で、CSPRNG/秘密capabilityではない。古いinstanceをAuth/権限の証明にしない。
4. openは旧handleを失効させてから新bound DBを開く。次のcontextがinvalid/不通でも旧storeへ復帰しない。同ID再open/別account/issuer/workspace/client/epochでもnative bindingを照合する。
5. registry mutexをadmissionからDB commitまで保持する。close/openは開始済み旧store処理の終了を待ち、遅着handleを現在storeへ再解決しない。closeはDB/queueを削除しない。
6. Tauriにworkspace_open/close/executeだけを追加し、executeはstrictな既存structured/Page command whitelistに限定する。unknown command/extra path/raw SQLを拒否し、秘密やpathをerrorへ含めない。既存PoC command/SQL plugin capabilityは保持する。
7. JSON-lines registry driverは同じRust library/whitelistを呼ぶtest-only adapterとする。並行requestでadmitted commitとcloseの待機を検査する。driver起動root指定を製品UIへ公開しない。
8. connectionは有効な登録時のgenerationSignalだけを公開する。これはAuth generationの取消通知であり、serverで後続queryに使える認可leaseの交付ではない。tokenを返さない。
9. NativeWorkspaceStore.openは現在のverified connection/context/generationをcaptureし、native open後にも照合する。Auth refresh中の遅着handleはcloseして採用しない。Webではnative代替storeへfallbackしない。
10. Native invokeの応答型はunknownに固定し、handle/context/metadata/bytesをruntimeで検査する。任意Tのcastで安全としない。初回TS2345のgeneric mock不一致と試験protocolVersion型を修正し、compiler flagsを緩めない。
11. executeのrequestをawait前にJSON分離し、native handle/command/Page IDをfixed compositionから付ける。fieldsでPage ID/commandを上書きさせず、前後でcurrent generationを照合する。
12. Page create/appendはframe/title/schemaとYjs V1構文をnative呼出前に検査する。loadはmetadata/binding/head/pending/binary構文を照合し、欠落を空本文へ作り直さない。prepareは正確なnative wireを返す。
13. Page/structured ACK/read portは同じcaptured native handleへ接続する。Auth取消後はlocal portも閉じ、すでに開始済み旧commitは完了し得るがclosed adapterから成功を返さない。offline grantをこの挙動から推定しない。
14. closeをcoalesceし、native cleanup失敗も安全なstorage categoryで返す。cleanup失敗でportを再開したりpendingを消さない。abort時の非同期cleanupをnative logout確認済みとは表示しない。
15. 新native5＋port6、既存実PG case拡張、実Docker Browser2、型/frontend/Windows cross-build/source114/外部lockを検証。実registry/Rust SQLite＋signed fixture HTTPでPage保存/remote/refresh/reopen/pending保持を確認する。browser native invokeはport double、Tauri command登録はcompile証拠で実Windows invokeとは区別する。
16. 所有版0.24.0、server3/local6/wire1を保持する。通常画面にlogin/store切替はまだmountしない。実Auth/native credential/失効後offline保持契約/実Tauri invoke/Hocuspocus継続認可は未完成として残し、旧Page/DB/IME・専用API v0.21/schema3・telemetry未収集を保持する。

[契約と残範囲](../development/NATIVE_WORKSPACE_IPC.md)、[証拠](../../tests/evidence/workspace-ipc-20261005/SUMMARY.md)、[全判断索引](../plan/AUTONOMOUS_DECISIONS.md)。次はPage一覧/metadata同期を先行し、normal UI/実Native Authは既存の未決定事項と分けて接続する。
