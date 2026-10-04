# Windows復元・入力の層別診断 — checkpoint v0.6.26 / 実行製品0.6.25

2026-10-05。通常0.6.25 sourceからread-only probeだけを一時挿入した診断release。通常exeの性能合格、最新Microsoft IME、日本語連続入力の証拠とは区別する。[環境](environment.json)、[build](build.json)、[全文/保存と時間の監査](verification.json)、[source/通常exe保持](source-verification.json)。

## 再現と隔離

Dockerの[build controller](../../../scripts/build-windows-profile.mjs)で6 sourceを原byte列へ復元し、追加moduleを除去。原本は出力先に保持。通常frontendも再buildしてprobe不在を確認した。前buildの126ファイルからcheckpoint用VERSIONを除く125ファイルと既存exeは変更なし。VERSIONだけ26へ更新し、アプリmanifestは25を維持。診断exeは13,106,688 bytes、hashはbuildのartifactに記録。hostにtoolchainを追加していない。

identifier `dev.greiva.poc.profile625`、Page `01a10530-0000-7000-8000-000000000001`、別app data/WebView profile。診断の接続だけを停止し、既存user Pageを開かない。[seed](../../../scripts/seed-windows-profile.mjs)は1,000段落/1,001 journal/250 pending Taskを実Rust経由で作り、SQLite online backupを使う。初回profile作成後3回再起動した。OS disk/GPU cacheと他appの負荷は制御していない。実ロードWebView2版は今回採取していない。

## 復元の観測

ms。4起動の個別観測で、p95やcold OS条件の保証ではない。

| 起動 | journal | SQLite open | Page query | JS Page IPC | Yjs復元 | Editor render→effect | navigation→Editor 2回rAF | navigation→Task 2回rAF |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 新profile | 1001 | 25.2 | 2.6 | 14.0 | 36.2 | 226.3 | 621.2 | 1180.5 |
| 同profile再起動 | 1001 | 15.6 | 3.2 | 18.4 | 25.2 | 187.7 | 608.0 | 798.1 |
| 入力前の再起動 | 1001 | 19.5 | 3.4 | 20.1 | 27.3 | 194.2 | 644.7 | 846.3 |
| 入力後・無編集再起動 | 1005 | 18.1 | 3.3 | 12.7 | 27.6 | 168.9 | 559.3 | 764.5 |

Page query/SQLite openはRust側、JS IPCはinvokeから解決まで。差分を純serialization時間とはしない。Editorは初回component renderからeffectで、Tiptap constructor単独ではない。2回rAFは内部frame境界であり、実画面presentation/編集応答時刻の保証ではない。navigation起点はprocess起動/WebView準備を含まず、native時計と合算しない。旧0.6.17とfixture/source/負荷が違うので改善率を出さない。通常Windows復元2秒条件は未確認のまま。

## 入力・保存・再起動

本文のHome選択を観測して末尾へ戻り、Computer Useの`type_text`で104 ASCII文字、続いて`press_key`でa/b/cを個別に送った。104文字の実イベントはControl+vで、通常input eventは0件。**貼り付けworkload**として記録し、連続キー入力へ換算しない。貼り付けのappend IPCは68.0ms、v keydown→append解決115.8ms。

実キーa/b/cは各trusted keydown/beforeinput/input、insertText、composing=false。間隔は約19.1秒/14.3秒で人の連続入力ではない。

| キー | keydown→2回rAF | append IPC | keydown→append解決 | input event→append解決 |
| --- | ---: | ---: | ---: | ---: |
| a | 46.3 | 16.2 | 47.1 | 34.2 |
| b | 35.8 | 18.3 | 37.3 | 28.8 |
| c | 25.9 | 12.0 | 26.5 | 20.3 |

listener到達後の時間で、OS注入からのlatencyやMicrosoft IME provider判定ではない。[保存画面](final-saved.png)を確認してAlt+F4、process不在後にread-only online backup。さらに再起動し、[復元画面](reopened.png)・保存表示を確認して無編集で終了した。Computer Useはreset済み。

DockerのYjsで全1,005 updateのdigestと全文を再構成。元1,001 updateはbyte-exact、先頭に104文字＋abcが各1回、他999段落不変。250 Task/pendingとstructured全table保持、無編集再起動前後の全table一致。診断はofflineで、peer/server同期の新合格ではない。

## 再監査

同directoryの`seed-tables.json.gz`、`after-input-tables.json.gz`、`reopened-tables.json.gz`、`reopened-reports.jsonl.gz`はsyntheticだけを含む。Docker rootに配置したdirectoryを指定して以下を実行できる。圧縮のまま読める。

```sh
node scripts/audit-windows-profile.mjs /tmp/copied-profile-evidence /tmp/new-profile-verification.json
```

初回監査はDocker copy先ownerがrootでreportのwriteだけがEACCESになり、nodeが書ける別/tmp出力へ変更して完了。検査内容や元reportは変更しない。本文UIAは入力直後に古い内容を返す場合があり、再観測・画面・停止DBを照合した。準備/観測の問題を製品データ欠落と混同しない。

最新実IME/物理drag、通常exeの連続入力・復元性能、Android/macOS/iOSの実環境を引き続き残す。[全判断](../../../docs/decisions/windows-profile-followup.md)。
