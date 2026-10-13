# Native本文編集画面 — v0.89.0

[実装契約](../../../docs/development/NATIVE_EDITOR_SCREEN.md)。実credential/利用者本文を使わず、合成fixtureで検証した。

- 全unit518/62 files、専用画面E2E20、型検査がPass。target logの23件は隔離profile試験追加前の対象runで、最終全unitに追加試験を含む。
- Page作成・keyboard本文入力・端末保存・local再接続の全文保持、unknown commit後の明示下書き復帰と二重表示防止を確認。
- composition中の操作拒否・focus保持、失効時の本文遮蔽・確定後閉鎖・同account下書き復帰を確認。遅いPage load/旧refreshがlogoutを取り消さず、異accountには下書きを出さない。
- desktop/mobile-dark-reduced-motionの合成画面PNGを視覚確認。Chromiumでsignupのnetwork requestを1回観測、password/refresh fetchはCSPで拒否されnetwork到達0。
- native-only frontendとWindows隔離候補をDockerでbuild。旧HTMLを含むfrontendでのbuildは意図した拒否。host PEの版0.89.0/SHAをartifactと照合。
- 初回Computer Use起動はアプリ承認待ちtimeout。利用者の再試行許可後、隔離候補のWindows windowとnative.htmlの未ログイン画面を読み取り確認した。認証入力や本文操作は実施していない。

ログはgzipで元byteを保持。build警告も残す。isolated-artifact/profile/host JSONは最終隔離候補を示す。artifact/host-inspectionは通常identifierの先行fixture候補で、実接続用候補ではない。

自動画面試験はIPC double、composition eventは合成。Windows起動確認を、実SQLite本文invoke・実Microsoft IME・native同期・7日offlineの合格へ換算しない。過去の実IME再変換Failは維持する。
