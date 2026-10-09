# DB Recordの端末保存

2026-10-09 / v0.53.0。[Source cache](PRIVATE_DATABASE_SOURCE_CACHE.md)に属するRecord snapshot/read観測と既知の三値候補を保存する。[判断16件](../decisions/private-database-record-cache.md)、[証拠](../../tests/evidence/private-database-record-cache-20261009/SUMMARY.md)。native9→10、server11保持。View replica、DB差分cursor、作成/更新queue、HTTP runtimeとTable/List画面は後続。

## 原子保存と履歴

bound workspaceを開くtransactionでread receipt、snapshot history、current、候補の4表を追加する。native0/5/6/7/8/9から10へ移行し、bindingを先に検査する。既存Source/Page/title/Task/Relation/pendingを保持し、通常PoC DBの帰属を変更しない。foreign binding/partial DDL/未知schemaはrollbackする。

受信は保存済みSource定義を要求する。read request/responseのprotocol/workspace/epoch/client/Source/schema/Record/Page、canonical UUID、安全な版、6型に照合する。NameはPage由来でRecord値へ複製しない。textはUnicode codepoint65536、有限number、checkbox、既知Select、暦上有効なDate/nullをnativeでも検査する。Page IDはresource参照として保存し、未受信Pageの本文・titleやdefault entityを生成しない。

request/responseをcanonical hash付きimmutable receiptへ保存し、history/current/既知候補と同transactionでcommitする。同一版の内容違い、RecordのPage変更、Source内のPage二重所属、候補IDの内容違いはrollbackする。古い応答は履歴へ追加してもcurrentを戻さない。currentが最大保存版を指し、historyがscope付きreceiptと一致することを読取時も検査する。

候補はbase/local/remoteの型とpresence、版、三値の差異を検査する。readで観測できるresolvedBy:nullだけを受け付ける。候補が古いremote版を参照しても最新値への一致を要求しない。保存済みbase/remote履歴がある場合は候補値を照合する。seed受信で未観測の旧版を作らない。後から旧版を受信すると、それを参照する既知候補を100件ずつ照合し、矛盾した履歴でcacheを汚さないよう受信全体をrollbackする。

## 読取と境界

database_record_loadは未受信Recordならnull、候補はdefault/max20＋1lookaheadで返す。既知候補を追加保持し、空readやページ終端から解決・削除を推論しない。database_record_listはUUID keyset default50/max100＋1lookahead、id/pageId/versionのみを返す。候補/一覧のlookaheadもhistory/receiptへ照合し、不整合を空fallbackや修復で隠さない。

Registry strict IPCとcaptured native storeで保存先/context/ID/件数/継続を検査する。DB path/SQL/profile/tokenを受信commandへ追加できない。Auth refresh/closeで旧世代を拒否する。read cacheはJWT署名/native Auth grant、永続送信queue ACK、server全候補受信、削除ACK、全DB同期の証拠ではない。HTTPへの接続は次工程である。

## 検証

実Rust/SQLite driverの17条件で型/Unicode/暦、restart/retry、候補21件・一覧101件、stale候補とlate baseline照合、scope/raw IPC bypass、history/receipt/projection/候補/lookahead破損、schema9移行、並行再送/世代取消を確認する。COMMIT前後の実SIGKILL2試行でcurrent/history/receipt/候補の原子回復を確認する。旧Source13＋旧native49の初回回帰も保持する。Docker native証拠とWindows actual invoke/MS IME/Android/配備暗号化/native Gateを分離する。
