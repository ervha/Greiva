# Native Page取得基盤 — v0.92.0

[実装契約](../../../docs/development/NATIVE_PAGE_READ.md)。合成account・実TLS/署名API・隔離PG schema・実SQLiteを使用し、実accountの本文/credentialは使わない。

- 型、全unit527（62 files）＋既存Page store13/registry9＝549（64 files）がPass。取得portの追加2件でstrict status/余分な本文/token拒否、取消後の旧handleを確認。
- 通常Rust42 Pass/Fail0。専用HTTP fixture4件は通常runでignored、専用runnerでは4 Pass/Fail0として実行した。
- 追加gate5件で、不正workspace/digest/document/schema/vector/余分fieldの無書込み拒否、反復取得のdedup、pending/wire/titleの保持、commit前後の保存未確認を検査。保持responseの明示再確認ではprovider呼出し1回のままであることを確認。
- HTTP待機中のclose/logout/expiry/account変更で旧responseを保存しない。保存待ちresponseも次のadmissionへ持ち越さない。
- 初回Rustは41 Pass/1 Fail。別account試験が旧ownerのdevice候補を再利用して拒否された。fixtureを別候補へ修正し、認可実装を緩めず最終42 Pass。元ログを別保存する。
- 実APIでwriterとreaderの別native session/deviceを同workspaceへ登録。writerの2frameを保存し、readerは不正scope、不正digest、応答喪失を順に拒否してからfull stateを保存した。
- readerのlocal未送信1件を残して再取得。同じ元pending/wireを維持し、SQLite再openでも本文journalとpendingが一致。独立Y.Docでremote＋localの本文/vector完全一致。read request5回は同じnative生成requestであることを確認した。
- 既存の送信・bootstrap/restart/device revoke・認証/TLS拒否fixtureも再実行した。取得と受領/ACKを混同しない。

型・全unit/既存保存層回帰、Windows候補build・host版/SHA/compiled設定・source比較は回収したlog/JSONを参照。新しい取得画面やeditorへのremote mergeはまだ接続していない。実Windows本文invoke/実IME・実provider・native offlineの合格ではなく、既知IME再変換Failは残る。

Windows候補のDocker build、host版0.92.0/SHA/compiled設定、native/auth/Editor/build script/manifestのsource一致を確認した。外部依存版は変更なし。SDK PDB/chunk-sizeと非GUI inspectorの既知icon警告はログに保持。gzipは元byte/decompress後hashを照合した。画面は変更していないため新しい画面E2E/スクリーンショット/実機GUIの受入を主張しない。
