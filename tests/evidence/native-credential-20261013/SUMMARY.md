# v0.78.0 Native資格情報・永続lock

2026-10-13。[実装契約](../../../docs/development/NATIVE_CREDENTIAL_CUSTODY.md)。現行previewへのログイン復元接続は後続。

| 検証 | 結果 |
| --- | --- |
| Rust unit | 5 Pass。実SQLite＋OS double。再起動/owner固定/別instance・DB ticket/応答喪失/削除・読取失敗/破損・scope拒否/SQLite秘密値不在 |
| 実SIGKILL | 7 Pass。logout lock commit前/後、OS書込み後/active commit後、restore lock後/書込み後/active後 |
| Windows OS adapter | Docker cross-buildしたprobeをWindows hostで実行。専用架空targetのread/write/replace/delete、存在しないtarget、削除再送とcleanupを確認。既存資格情報の列挙なし |
| 回帰 | 全unit484 Pass、型/servers/frontend/通常Windows build Pass。通常アプリのcrash-test-hooks無効。新規Rust moduleはTauri commandへ未登録 |
| Source | Host/Docker386件一致（raw376、改行のみ10）、対象外5件はverification.json |
| 依存 | npm外部315変更なし。main Cargoの外部501 entry変更なし。page-storeへzeroize1.9.0を1件追加（元の118 entry変更なし）。windows-sys0.61.2は既存lockと同版を直接利用 |

Windows probe SHA-256 `5c4b766e8988975f2fa329b60ad78b394d6d7bdbbae7e2647cc50688ba397101` はDocker実物とhost実行物で一致。通常Windows0.78.0のPE/SHAもhost照合したが、通常アプリGUIは起動しない。Windows buildの既存PDB linker warningはログに保持。

logout永続commit前のkillでは旧activeが残ることを成功条件に含める。commit後のkillや削除失敗と混同しない。OS doubleによるDocker試験はWindows OS保管証拠として数えず、Windows probeは実provider/ログインUI/IMEの証拠として数えない。

API/schema/UIに変更はなく、全PG/画面E2Eを再実行したとはしない。native provider transport・署名offline grant・7日期限のstore/表示lock・Android adapter・実Auth/IME/最終Gateは残る。
