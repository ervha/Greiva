# ローカル署名JWT＋発行元別owner — 0.10.0

2026-10-05、Docker内。jose6.2.12をAPIにexact pinし、session検証→workspace/resource/issuer owner照合を接続する。[全16判断](../../../docs/decisions/signed-session-verification.md)。

| 確認 | 結果 |
| --- | --- |
| 型/通常frontend/Windows release cross-build | Pass |
| 通常unit/integration | 105 Pass、実DB専用22 skip。Auth14/owner11含む |
| 専用PG | 22 Pass/skip0。新署名JWT＋SQL1を含む |
| JWT14 | EC/RSA実署名、issuer/aud/exp/nbf/sub、誤署名/kid/alg/critical header、header形式/改行/長さ、token指定鍵源拒否、設定capture、不通category、session前の無DB read、target capture、別issuer同sub拒否 |
| 実JWT＋PG | 正しいowner、偽workspace/roleを含む別subject拒否、不正session前の無metadata read、owner変更・同sub別issuer拒否、fresh schema清掃remaining0 |
| 版/依存/source | 所有0.10.0、joseだけ追加（npm315）、他314/Cargo外部不変、normal build source82ファイルhost一致 |

JWT署名と公開JWKS処理は実library。HTTPS transportはserver-owned fixture fetchで、実Supabase project/login/refresh/鍵rotation/失効/ネットワークを検証した結果ではない。秘密鍵は試験process内だけ、token/鍵を原reportやgitへ保存しない。SQL read-modelはfixture tableで、production migration/viewは未完成。

issuer＋subjectをownerに必須追加したため、旧read-modelへ既定issuerを補わずfail closedとする。旧PoC DBは変更しない。105はissuer境界追加後の最終再実行で、途中103は最新版の合格件数に使わない。

[集約](verification.json)、gzipのVitest原report、build原log/hashを保持。旧HTTP/CRDT routes/UIへまだ配線していない。画面59/実同期2は[0.7.0](../production-foundation-20261005/SUMMARY.md)の歴史的結果。今回を新Native IME/Androidアプリ/全本番認可/初期製品のPassへ換算しない。
