# Native auth screen — v0.87.0

[画面契約](../../../docs/development/NATIVE_AUTH_SCREEN.md)。実accountや本文を扱わず、Dockerのnative IPC doubleで画面を検証。

- controller5/全unit507（60 files）、型検査 Pass。
- desktop/mobile-dark-reduced-motionの画面10 Pass。起動復元1回、失敗後再送なし、composition submit/mode変更抑止、keyboard login、password clear、local一覧とpending表示、logout provider未確認/永続lock不明、foreign context非表示、登録response非認証、browser製品entryのfallback拒否を確認。
- desktop/mobile fixture PNGを視覚確認し、button間隔と初回案内をneutral表示へ調整。横overflowなし。これはbrowserの合成compositionで、実Microsoft IMEではない。
- Docker build CLIでnative.html専用Windows候補を別出力へ生成。版0.87.0/PE/SHA、native profileのentry/identifier/CSP、auth modeの旧command/SQL plugin無効をhost非GUI inspectorで確認。test hook/SQLite bridge/crash hookなし、fixture HTMLなし。
- host/Dockerのnative/auth source、専用build script、HTML/config、manifest/lockを照合。外部依存版は変更しない。

初回controller試験はnative restore開始を待つ前にlogoutしたfixture待機raceで4 Pass/1 Fail（`controller-initial.log.gz`）。実requestのentered通知を待つように修正し、専用5/全507 Passを再確認した。受入条件を弱めず、late verified resultの拒否を検査する。

`type.log.gz`/`controller.log.gz`/`unit.log.gz`/`e2e.log.gz`/`preview.log.gz`/`frontend.log.gz`/`windows.log.gz`、artifact/profile/host inspection/source comparison/version-audit、desktop/mobile PNGを参照。gzipは元byte hashと一致。既存chunk-size/SDK PDB warningと非GUI profile inspectorのdefault icon resource警告を保持する。配布installer/署名の受入ではない。

既存実API・実機0.82.0候補を置換しない。候補のGUIは起動しておらず、実Tauri invoke/実user復元/refresh/失効、本文editor・native remote sync/ACK・7日offline・Android/既知IME再変換Failは未完了。
