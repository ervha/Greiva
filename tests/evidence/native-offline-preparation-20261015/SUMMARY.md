# Native offline許可の準備 — v0.96.0

2026-10-15–16。[実装契約](../../../docs/development/NATIVE_OFFLINE_PREPARATION.md)。オンラインでのlease準備・期限確認までを新runtimeへ接続した。offline起動/編集のadmission/画面は未提供。実credential/本文・配備用秘密鍵を使用していない。

- nativeがchallengeを生成し、元admissionのclient/epochで固定APIへPOST。署名pin、nonce、scope、native時計と期限、元session/handle/世代を検証し、OS保管の確認後に期限だけを返す。grant/nonce/鍵/JS時刻/任意contextをIPCへ出さない。
- statusは署名・scope・期限/high-water・OS更新を再検査する。準備結果不明の再確認でHTTPを呼ばない。再認証/logoutで旧leaseをlockし、lease lock失敗なら認証sessionも閉じ、永続logoutは未確認と返す。本文/pending/wireは保持。
- 単体560（64 files）Pass。strict status shape、token混入/不正日時拒否、未設定時prepare拒否、未知の準備結果のstatus-only確認、logout後の遅着破棄を含む。
- 通常Rust53 Pass/専用6 ignore。public pinの弱鍵・非canonical hex・不正URL、署名/nonce/scope/未来iat/未知claim拒否、準備の並行拒否、close/logout/expiry/reauth遅着拒否、期限直前/ちょうど、lease OS書込み応答喪失時の非ready、reauth/logoutでlease無効かつ元pending wire不変を確認。lease marker tableを壊した追加試験で、logoutの永続結果を未確認とし、login/restoreを継続せずsessionを閉じることを確認した。
- 実TLS provider→Rust native→署名session/実API→Postgres→Ed25519 grant→native verifier→OS custody doubleの専用6件Pass。新offline準備は4 HTTP requestで不正protocol/応答喪失を非採用、毎回新nonce、status-only確認、reauthで無効化と再準備、logoutを照合。既存Page送受信/本文vector/21件catalogの回帰も同runで確認。実Windows Credential Managerでこの新経路を実行した意味ではない。
- 画面desktop/mobile-dark-reduced-motionで50 Pass/0 Fail/0 Skip。未設定と未確認を区別し、configured fixtureの未知結果→期限確認、合成composition中の操作抑止/focus保持、準備待機中の本文入力・端末保存、logout後の非表示、既存編集/再接続を検査。PNGを視覚確認。
- buildのpublic pinは4項目の明示指定だけを受ける。一部だけの設定を実cargo-xwinで拒否するexpected rejectionを保存。全項目未設定の最終Windows候補はbuild成功し、非GUI inspectorでofflinePreparationConfigured=falseを確認した。実APIや配備の鍵は変更していない。

最終レビューの追加試験では、OS保管中に認証期限をまたぐと成功返却を拒否してもleaseが残る1 Failを再現した。保管後のsession確認失敗でもleaseをlockするよう修正し、通常Rust53件で再確認。元の失敗は`expiry-first.log.gz`に保持。

初回Rust compile 2runで、Arcをnative sessionのasync境界へ渡すためのS/Cのstatic lifetime bound不足が出た。必要なnative型境界を明示して修正し、元compileログ2本を保持。runtime検査やテスト期待を緩和していない。最終型/単体/Rust/HTTP/画面は上記のとおりPass。

Windows候補の版0.96.0/SHA、PE x86_64、native-only/legacy command遮断/SQL plugin無効、host/buildのnative/auth/Editor/build script/manifestsソース一致を照合。CRLF/LFのtext差を区別し、外部依存版は不変。SDK PDB/chunk-sizeと非GUI inspectorの既知icon警告をrawログへ保持。gzipの元byte/展開後SHAを照合した。型→build→Vite E2Eを直列化した。

残るのは、保管contextのnative復元、offline専用handleと各local操作でのlease gate、起動復帰/期限時の入力保全、実Windows GUI/実Microsoft IME、Android、性能・最終Gate。画面の期限は前回確認値であり、offlineで編集できる証拠や権限として使わない。
