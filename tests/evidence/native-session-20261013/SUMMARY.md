# Native session coordinator — v0.83.0

2026-10-13。[実装契約](../../../docs/development/NATIVE_SESSION_COORDINATOR.md)。Docker内の実SQLite＋架空OS/provider doubleで検証。実ユーザーcredential/メール/本文は取得・送信していない。

## 確認結果

- Rust全24 Pass / Fail・skip 0。新しいsession12＋既存credential5/grant3/lease4。`rust.log.gz`に実行結果を保持。
- 正常login→memory access admission→close/reopen→restore/rotation→logout。DB/WAL/SHMに架空email/password/subject/access/refreshが存在しない。
- issuer/response subject/復元owner不一致、期限到達、verify中のclock rollback、OS commit直後の期限切れを拒否。
- 回転refresh失敗・OS書込み応答不明・実15秒timeout後のrestoreはproviderを再呼出ししない。新しい明示loginは可能。
- login/refresh/verify/authorized待機中のlogoutでfutureを破棄し、buffered結果を渡さない。二重loginを拒否。
- 別instanceのlogout、OS削除失敗後もlock。同ownerの新しいlogin世代を古いaccessが使わず、古いlogin失敗cleanupは新しいmarkerを解除しない。
- Docker型検査/frontend build・通常Windows cross-build。`type.log.gz`/`build.log.gz`/`windows.log.gz`と`artifact.json`/`host-exe-inspection.json`を参照。gzipは元byteとのhash一致を確認し、出力の空白も保持した。native source/manifest/lockはhostとDockerを照合。外部npm315/Cargo506・135を変更せず、アプリ版だけを揃えた。frontendの既存chunk-size warningとWindows linkのSDK debug PDB不在warningは残る。

## 証拠の限界

providerはdoubleで、実HTTP/署名session adapter/実Supabase refresh/revokeの証拠ではない。Windowsはbuildのみで、起動・自動ログイン・IMEを再試験していない。現行0.82.0の専用検証候補や実API設定は置換していない。UI/通常IPC/handle/7日offlineは未接続で、既知IME再変換Failや確認メールlocalhost導線も残る。

初回Rust19、その後の追加境界22/23、最終24がPass。実装を拡張したため最終版で再検証した。Rust整形toolは既存Docker toolchainに未導入で呼出しが失敗したが、新しいtoolchainは追加していない。製品テスト失敗として扱わない。test実行の成功を全製品の受入成功へ拡張しない。
