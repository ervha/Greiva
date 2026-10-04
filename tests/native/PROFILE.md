# Windows復元/入力のread-only診断

既存Docker Windows cross-build環境のrepository rootで、正常sourceを確認して実行する。global host toolchainは不要。通常テスト/buildと同時に実行しない。

```sh
node scripts/build-windows-profile.mjs /tmp/new-profile-build
node scripts/seed-windows-profile.mjs /tmp/new-profile-seed
```

buildは6 sourceの原本を保存し、一時観測コードを入れたreleaseを生成後、全sourceを復元して追加moduleを削除する。controllerをSIGKILLした場合は出力先の`original-0`〜`original-5`をmetadataの順に戻し、差分を検査してから通常buildする。生成済みdist/exeは診断版なので、通常frontendも再buildする。診断を通常releaseとして配布しない。

既存outputを両toolとも拒否する。fixtureは1,000段落/1,001 update/250 pending Task。`complete.sqlite`はonline backupであり、稼働DBのmainファイルだけをcopyしない。

固定identifier `dev.greiva.poc.profile625`、Page `01a10530-0000-7000-8000-000000000001`を使う。Windowsの当該app config/WebView profileが未作成であることを確認し、complete.sqliteを新しい当該保存先にだけ配置する。既存のprofileへ上書きしない。Windows packaged processではRoamingのvirtualized保存先も確認する。

Computer Useで診断exeを起動し、本文・保存状態を確認する。初回と同profileの再起動を記録。各reportは起動5秒後、入力イベントの1秒後に隔離DB横のprofile.jsonlへ追記される。保存確認後終了し、process不在後read-only online backupを採る。入力方式はeventで判定する（type_textはCtrl+vとなる場合がある）。

seed/入力後/無編集再起動後の全table exportとraw reportを[監査tool](../../scripts/audit-windows-profile.mjs)で照合する。所定ファイル名と実行例は[証拠](../evidence/windows-profile-20261005/SUMMARY.md)を参照。実IME/連続入力/通常native SLOは別検証。診断終了後はComputer Useをresetする。
