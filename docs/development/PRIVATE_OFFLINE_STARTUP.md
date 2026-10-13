# Offline grantの明示起動設定

v0.81.0。通常 `startPrivateApi` に[署名offline grant](NATIVE_OFFLINE_GRANT.md)を接続した。以下4項目をすべて明示した時だけ発行routeを有効にする。

| 環境変数 | 内容 |
| --- | --- |
| GREIVA_OFFLINE_ISSUER | nativeがpinするHTTPS issuer。credentials/query/fragmentなし |
| GREIVA_OFFLINE_AUDIENCE | nativeがpinするaudience、最大256文字 |
| GREIVA_OFFLINE_KID | native公開鍵pinと一致するkid、英数字/underscore/hyphen、最大64文字 |
| GREIVA_OFFLINE_KEY_FILE | 専用Ed25519 private JWK fileの絶対path |

全項目が未指定なら発行機能は無効で、既存APIは従来どおり動く。一部だけの指定はconfiguration errorとし、既定鍵や一時鍵を生成しない。任意request bodyから起動設定を上書きしない。

key fileは4 KiB以下の通常file、group/other権限なし、symlink不可。JWKは `kty:OKP, crv:Ed25519, x, d` の4項目だけとし、x/dはいずれも32 byteのcanonical base64url。import後のprivate keyはnon-extractableで保持する。起動時に型の異なる検査用署名をpublic xで確認して、x/d不一致も拒否する。読み取ったbyte bufferをzero化するが、JSON/runtime内の全コピー消去を保証しない。

鍵読取/検証はDB pool/listener作成前に行う。エラーは固定configuration分類だけを返し、path/JWK/署名/本文/例外causeを出力しない。設定objectは従来のDSN同様にprivateな起動情報として扱い、丸ごとログへ送らない。

配備時は鍵をsecret管理で供給し、対応するpublic x/kidをnativeへpinする。公開するのはpublic keyだけで、private JWKをWebView/Vite公開変数やgitへ渡さない。通常previewへのnative認証接続と鍵配布/rotationは後続。今回の実行中v0.75.0接続プレビューへ鍵設定を勝手に追加・再起動しない。

Docker unit3＋実runtime/PG1で、未設定/部分設定/不正権限/symlink/大きすぎるfile/不正・不一致key、DB接続前の拒否、認証→bootstrap→署名発行と未設定時404を確認した。[証拠](../../tests/evidence/private-offline-startup-20261013/SUMMARY.md)。
