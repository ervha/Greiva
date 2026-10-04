# Windows層別診断の自律判断全件

2026-10-05。checkpoint v0.6.26、実行source/製品0.6.25。[結果と再現](../../tests/evidence/windows-profile-20261005/SUMMARY.md)。

1. 残課題のWindows性能を優先し、済んだ4条件CLIや59 E2Eを理由なく再実行しない。アプリsourceは変更せず、旧0.6.17診断を現0.6.25へ適用する再現toolを作る。
2. 6ファイルの一時probeはDocker内だけで挿入し、原本とhashを保存、finallyで原bytesへ復元する。controllerを強制終了した場合の原本復旧を明示する。通常frontendを再buildしてprobe不在、通常exe/125ファイル（checkpoint用VERSIONを除く）の不変を確認する。VERSION更新後の全126 hash期待は一致しないため、意図したcheckpoint差分だけを分けて最終照合する。
3. 新しいidentifier/Page/保存先だけを使い、1,001 journal/1,000段落/250 Taskを実Rustで作る。WALを落とさないonline backupでseedを転送し、既存失敗Page・利用者入力を触らない。
4. SQLite/query/IPC/Yjs/Editor/rAFの時計・区間を分ける。4 sampleだけでp95や通常起動2秒を宣言しない。旧runとのpaired比較でないため改善率を出さない。WebView実ロード版は未記録とする。
5. 自動入力方式をeventで判定する。104文字type_textはCtrl+vの貼り付けだったので、実キー104文字や連続入力として扱わない。実キーabcは個別に追加し、provider未同定・非composition・大きな操作間隔を記録する。
6. 保存表示→終了→process不在→read-only backup→再起動の順序を守る。全journal digest/元byte列/他999段落/全structured table/再起動全tableを独立Yjsで照合する。offlineなのでpeer同期の新証拠と呼ばない。
7. 今回のguard/準備失敗（監査reportのwrite権限、入力直後のUIA遅延）を製品Failに換算しない。旧失敗を消さず、syntheticの選択証拠だけを公開。診断appを終了しComputer Useをresetする。
8. 診断tool/証拠/文書のPATCH26とし、製品manifest/lock/既存exeは実版25を維持する。同じcodex/poc-editorでpushし、未検証Gateを変更しない。独立作業として、次は合意済み要件に基づく本番architecture候補と未決定事項を整理する。恒久実装・外部Provider設定・本番deployは行わない。

応答や操作が必要な残条件は[今回の残事項](../../tests/evidence/windows-profile-20261005/SUMMARY.md)と[前の全13判断](step-8-render-isolation.md)を引き継ぐ。今回新たな利用者操作は要求していない。通常exeの性能合格には別の測定契約が必要であり、診断のrAFと手操作の体感を同一指標にしない。
