# Microsoft IME再変換のA/B・C/D再確認

2026-10-03。実キー操作は利用者、保存データと診断ログの解析はCodex。途中のチャット返信をせず各2条件を続けて実施した。新しい製品の合否と、旧診断候補のイベントを分ける。

| 条件 | 実行物／入力欄 | window移動 | 最終本文 | 結果 |
| --- | --- | --- | --- | --- |
| A | 通常0.6.9／Page | なし | `MS65 local 日本語` | 本文保持 |
| B | 通常0.6.9／Page | 選択後Alt+Tab往復 | `MS65 loc日本語` | `al `欠落 |
| C | 診断0.6.5／素のtextarea | なし | `MS65 local 日本語` | 本文保持 |
| D | 診断0.6.5／素のtextarea | 選択後Alt+Tab往復 | `MS65 loc日本語` | `al `欠落 |

利用者の回答は「Bのみ『al 』が抜け落ちました」「Dのみ『al 』が消えました」。二重入力・候補異常について追加の報告はなく、候補画面の独立観察はしていない。ProviderはMicrosoft IMEとの利用者申告。通常0.6.9の起動時に実際に読み込まれたWebView2は154.0.4258.53。通常exe SHA-256 `65edd5c8f629f3acfc7ba3b8ff381938f6bd27a0712532af5726782194d14aca`、診断exe SHA-256 `b9143ddfb6da3c3c997a53606ae9df95cd226061acb5f5a55a71ccd13278247b`。どちらも既存buildを照合して再利用した。

## 保存されたA/B

「端末に保存済み」を待ってPageを編集せず閉じるよう依頼し、利用者は「閉じました」と回答。プロセス終了後にSQLite・WAL・SHMをまとめてコピーし、[原本／コピーのhash一致](sqlite-copy-hashes.json)を確認した。Dockerでコピーをread-onlyに開き、integrity_check=ok、全Yjs updateのdigest照合と順序再生を実施。[本文と更新履歴](sqlite-inspection.json)。原DBは変更していない。

Aの実保存タイトルは `PIME69-A`（依頼名IME69-Aとの差をそのまま記録）、Page `01a10176-5779-7501-8b63-8de20252aae7`。21更新の最終XMLは `<paragraph>MS65 local 日本語</paragraph>`。Bは `IME69-B`、Page `01a10177-58f6-774e-9bd2-4e0ce2a216c2`、42更新の最終XMLは `<paragraph>MS65 loc日本語</paragraph>`。Bのseq63で `MS65 loc`、seq64で日本語の再挿入を確認。UIだけの表示差ではなく欠落が保存されている。通常候補にはnative event loggerがなく、物理キーや候補画面をこのSQLite記録から推定しない。

## C/Dのnative event

実験チェックを外した旧[診断ソース](../step-8-ime-focus-20261002/focusguard/build/native-ime-trace.ts)を使用。probe-switch／probe-selection-directionは0件。閉じた後の[stderr](diagnostic-stderr.log)はSHA-256 `a3e5987b317137c8ae7260ae0b8e2b93e66b4b820504b3f2e3b3361f8eac918c`、266記録・parse errorなし・seq欠落なし。[全解析](diagnostic-full-analysis.json)・[C/D抽出](diagnostic-analysis.json)。

Cはseq127で[11,14] backward選択、seq131でその範囲のcomposition開始、seq141で本文保持。Dはseq243 blur／244 focusまで[11,14] backward（日本語3文字）を保持するが、seq246のtrusted beforeinput/deleteContentBackwardでは[8,14] forward（`al 日本語`6文字）。seq247で `MS65 loc`、seq248 compositionstart、seq251で日本語を挿入し、seq258の確定入力後は `MS65 loc日本語`。compositionendのtrusted=falseも原記録のまま保持する。DOMイベントの観測であり、OS／IMEの内部原因を証明するものではない。

## 利用者判断

利用者は今回「マイクロソフトIME自体のバグなので無視してよさそうです。ほかのアプリ複数で同様の症状が出ました」と回答。この環境の外部IME既知問題として、Greivaの修正待ちから外して他の検証を継続する。複数アプリの名称・版・ログは未採取で、Microsoftの確認済みbugとは断定しない。PoCの本文保持条件で観測したFailは残し、[受入例外の判断](../../../docs/decisions/step-8-ms-ime-exception.md)として扱う。Gateの自動Passや他の未実施条件の免除にはしない。
