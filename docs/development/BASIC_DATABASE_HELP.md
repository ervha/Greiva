# 基本DBの同梱ヘルプ

2026-10-12 / v0.73.0。[既存ヘルプ](WORKSPACE_HELP.md)の端末内検索・modal・元選択の復帰を使い、[初期DB画面](PRIVATE_DATABASE_BROWSER.md)、[行操作](PRIVATE_DATABASE_RECORD_EDIT_SCREEN.md)、[View設定](PRIVATE_DATABASE_VIEW_SCREEN.md)に対応する。

「基本DBを作成・表示する」「DBの行を作成・編集する」「DBのView設定を保存・解決する」の3記事と基本DBカテゴリを追加し、計12記事とする。stable ID、日本語・preview availability・desktop/touch、関連記事を持つ。既存start/save-sync/local-saveは改訂2へ更新し、基本DBを未提供とする案内を外す。

説明はName/Text/Number/Checkbox/Select/Date、Table/List、PageタイトルとしてのNameと未取得、読み込み範囲の条件・並べ替え、独立したSource/行/View保存・送信、未設定/null/0/false/空文字、候補と元拒否を扱う。新しい条件は平坦なAND/OR最大20、並べ替えは1列、未変更の複合設定保持と初期subsetを明記する。削除/高度なDB/復元・backup取り込みを提供済みとは案内しない。

個人workspaceの基本DB操作付近から3記事を直接開く。draftやunknown保存中でも説明を読めるが、composition中の移動を止める。記事閲覧はDB store読取/更新、送信・再試行・ACKを実行しない。検索対象は同梱の文章だけで、Page/行/メール/認証情報を検索しない。記事を閉じると元のinput/focus/selectionとdraftへ戻る。

unknown enqueueは元入力をコピーできるまま同操作で再確認し、HTTPの同操作再送と元ACK pair再保存を区別する。未確認0件だけではunknownを解除しないこと、known busyで新入力を保存していないこと、端末候補の読み直しがサーバー最新取得ではないことを案内する。

[証拠](../../tests/evidence/basic-database-help-20261012/SUMMARY.md)。文章とヘルプ入口の変更で、schema/HTTP/native store/認証方針を変更しない。Docker fixtureのoffline/選択復帰はWindows実IMEや実Supabase正常系の証拠ではない。次はP4の個人workspace候補の起動設定・隔離した成果物と再開手順を整える。