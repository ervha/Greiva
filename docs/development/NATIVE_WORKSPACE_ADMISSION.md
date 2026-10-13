# Native認証とlocal workspace admission

v0.85.0。[HTTP provider](NATIVE_HTTP_PROVIDER.md)・[session coordinator](NATIVE_SESSION_COORDINATOR.md)・実SQLite registryを接続する新しい`NativeWorkspaceGate`を追加。通常preview/既存IPCの置換はまだ行わない。

## owner・device・世代

入口の`open`に渡すのはUUIDv7のcandidateだけ。nativeのverified identityからownerを作り、devices.sqliteの保存済みclientIdを確認する。raw owner/context/DB pathを受け取らない。既存device情報の破損や、workspace DBがあるのにdevices.sqliteが欠落した状態は従来どおり拒否する。

固定APIの`POST /v1/workspaces/bootstrap`へBearer＋`{clientId}`だけを送る。serverは署名sessionと実PG transactionでworkspace/deviceを登録・照合する。protocolVersion/UUID/返却clientIdを検査し、verified ownerと返却workspace/epochからcontextを構成する。

`WorkspaceAdmission`は公開constructor/Deserialize/Serializeを持たず、native sessionのrandom instance namespaceとmemory generationへ固定する。資格情報の永続generation/owner/期限はopen・実行の前後に再検査する。新しいlogin/restore/logout、別instanceの新世代へ古いadmissionを持ち越さない。bootstrap待ちのcancelや後続openを、gate独自の世代で検出する。遅い旧openが新handleを閉じたり再束縛したりしない。

## local操作と保全

この入口はlocal commandだけを提供する。既存offline gateと同じwhitelistを一箇所で共有し、remote ACK/pull/receiveをcallerから受け取らない。将来の同期はnative authenticated HTTPから得た結果だけを適用する別経路として接続する。

session gateとregistry gateをSQLite commitまで保持する。開始済みcommitはlogoutより先に完了できる。期限切れ・clock/OS検査失敗時は結果を渡さず、handleを閉じるが、確定したpendingを削除しない。invalid local requestでもこの新入口はhandleを閉じ、同じ認証で明示openし直す。拒否されたremote commandは実行せず、既存handleを維持する。

login/restore/logoutは既存handleと待機中openを閉じる。同accountの再認証ではstable device/contextのDBへ戻り、元wireを保持する。異accountは別context/deviceへ固定し、旧handleで閲覧・編集できない。logoutはlocal閉鎖→永続lock→provider確認の順。現在はgateをremote revoke確認まで保持するため、別のopen/loginは最大request timeoutまで待つ。

[証拠](../../tests/evidence/native-workspace-admission-20261013/SUMMARY.md)。実SQLiteのrestart/logout/owner切替/expiry/pending保全と遅着拒否、TLS→署名HTTP→実PG bootstrap→SQLite復帰・device失効を確認。通常IPC/UI、native remote sync/ACK、offline lease同時lockと7日復元、実Windows起動/IMEは次工程。
