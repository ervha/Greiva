# 描画の分離診断

Dockerでpackages/serversをbuildした後、同じcontainerのrepository rootで実行する。

```sh
node scripts/test-render-isolation.mjs /tmp/new-render-isolation-run
```

既存出力directoryは拒否する。通常のE2Eとは別のconfig/testDirで、実Rust試験bridge、1,000段落、250 Taskの送信待ち、実ASCIIキー、下書き保持、タイトル/Relation表示更新を検証する。

controllerは2 componentだけに一時的な呼出counterを入れ、memoなし/ありを同じ操作列で比較する。React Strict Modeのdevelopment描画回数であり、production frame時間やWindows IME/SLOの測定ではない。通常コードへprobeを残さず、`finally`で元のbyte列を復元し、hashを記録する。原本も出力directoryに保持する。controller自体を強制終了した場合はその原本と差分を確認して復旧してからbuildする。診断と同じcontainerでbuildや別E2Eを同時実行しない。
