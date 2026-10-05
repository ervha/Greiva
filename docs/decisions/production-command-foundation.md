# Domain/Application基盤 — 自律判断全件

2026-10-05、v0.7.0。利用者の機能優先委任と個人/自端末同期先行の回答、[提供範囲判断9件](production-foundation-plan.md)に続く実装。[証拠](../../tests/evidence/production-foundation-20261005/SUMMARY.md)。

1. 最初の恒久実装をTask/RelationのDomain intentとportable Application portに限定する。既存PoC UI/HTTP/SQLiteへworkspaceを仮付与しない。
2. 入力規則をprotocolからdomainへ移し、旧exportを維持する。titleの空白/空文字、date-only、partial update、Conflict/predecessor等の既存wire挙動を変えない。
3. subjectはAuth providerのopaque ID、workspace/clientはUUID v7として区別する。clientIdを認証の証明にしない。実session/resource検証はadapterの責務。
4. 入力のparse/cloneとcontextのcaptureを非同期認可より先に行い、request全体をfreezeする。actor/intentの後からの書換えを保存へ混入させない。
5. 非同期認可中に呼出側がportを差し替えても開始時のstoreを用いる。adapter自身もworkspaceへ束縛される必要があり、参照固定だけで本番account切替の受入とはしない。
6. 拒否/認可不通時にcommitを呼ばず、storeのdurable promise完了まで保存成功を返さない。entity＋operationの原子的保存/冪等性はstore契約に明記する。
7. commit reject時は「未保存」と断定せず結果不明としてoperationIdを返す。実際には保存済みでresponseが失われる場合があるため、同じID/内容で復旧または再試行する。
8. Applicationの9条件はcontract doubleで検証し、本番SQLite/JWT adapter完成とはしない。既存Rust/HTTP/PostgreSQLの回帰と証拠を分ける。
9. npm workspaceを継続し、追加2package以外の外部npm314records/Cargo依存を変えない。build順はshared→domain→protocol→sync→application。
10. 新機能基盤のMINORとして所有manifest/lock/Cargo/TauriとVERSIONを0.7.0へ揃える。製品初期版全体が完成したという番号ではない。通常Windows buildを作り、診断hookを含めない。
11. 既存画面59、実同期/Conflict2、通常64＋別実DB20、型/通常buildを検証し、無関係なnative IME/性能の再試行をしない。既存DB/IME失敗資料を保持する。
12. Docker workspace symlinkの権限エラーは所有directoryだけを修正して再実行する。製品障害とは区別して記録する。
13. commit/tag/pushを完了後の停止理由にせず、次の個人workspace認可へ進む。実provider/endpoint/署名/保持/旧DB importの未決定事項は残す。

今回の追加ユーザー操作は不要。Computer Useは解除済み。旧試験Page/DBを編集・移行しない。本番認証・旧pending/cursor移行・Android通常アプリ・配布/復旧は[P1以降](../plan/IMPLEMENTATION_PLAN.md)で受入する。
