# Windows VMでのTauri・Microsoft IME検証

目的: ホストWindowsへ開発ツールを追加せず、POC_SPEC Section 12のWindows 11 P0試験をWindows VM内で行う。

## このPCに作成したVM

2026-09-30、ユーザーがこのPCへの仮想化ソフト導入を明示的に許可したため、VirtualBox 7.2.20を導入した。インストール対象は`VBoxApplication`のみ。ブリッジ/host-onlyネットワーク、USB、Python連携は追加せず、自動再起動・デスクトップショートカット・ファイル関連付けも抑止した。

[VM作成スクリプト](../../scripts/create-windows-vm.ps1)で`Greiva-IME-Win11`を作成済み。RAM 4096MB、4 CPU、EFI、TPM 2.0、96GBの動的VDI、NAT。共有フォルダ、clipboard、Drag & Drop、外部向けport forwardingは設定していない。VMは電源OFF、OS未インストール。

VM registry、ディスク、ISOはプロジェクトの`.data/windows-vm/`配下に置く。操作時は同じPowerShell内で次を設定する（プロセス内だけ）:

```powershell
$env:VBOX_USER_HOME = Join-Path (Get-Location) '.data\windows-vm\registry'
$vmManager = 'C:\Program Files\Oracle\VirtualBox\VBoxManage.exe'
& $vmManager list vms
```

日本語Windows 11 Enterprise評価版ISOを[Microsoft公式配布](https://www.microsoft.com/en-us/evalcenter/download-windows-11-enterprise)から取得中。90日評価版であり、永続利用の環境とはしない。取得完了後、[Microsoftの公式ハッシュ資料](https://aka.ms/VerifyWindowsISO)とSHA-256を照合してからVMへ接続する。2026-09-30の日本語x64 ISOの公表値は`8FB2CC19C8AEE87A688C1CB73E726816C01F0C6EE9A17BB2FB73E4533837E698`。

ホストはRAM約16GBで空きメモリが少ないため、Dockerの試験終了後に余力を確認してVMを起動する。ホストのDocker/セキュリティ設定を無効化する手順は行っていない。VirtualBoxの導入・空のVM作成はWindows/Tauri/IME試験の成功を意味しない。

## VMの前提

1. 利用可能なWindows 11 VMを用意し、初期状態のsnapshotを保存する。Windowsのライセンスと仮想化基盤はユーザーが保有する環境を使用する。
2. guest側でMicrosoft日本語IME、WebView2、Visual Studio C++ Build Toolsの「Desktop development with C++」とWindows SDKを用意する。
3. ソースはコピーして使う。ホストの`.tools/`、`node_modules/`、`.git/`、`.env`、DBをguestへ共有しない。host filesystem全体や認証情報を共有する必要はない。
4. 固定版Node 24.19.0、npm 11.9.0、Rust 1.98.1をguest内に配置する。[guest専用セットアップ](../../scripts/setup-windows-vm.ps1)はVMであることを検査し、guestプロジェクト内`.tools/`だけに配置する。C++/SDK/WebView2のインストールはこのscriptでは行わない。

guestのPowerShellで:

```powershell
.\scripts\setup-windows-vm.ps1
. .\scripts\use-tools.ps1
npm.cmd ci
npm.cmd run desktop
```

Node/npm/Rustを独自のguest管理方法で用意済みの場合は、固定版を確認して`npm.cmd ci`と`npm.cmd run desktop`から開始できる。PowerShellで`--`以降のCLI引数を渡す際は`npm.cmd`を使う。

## Step 3: 初回のIME試験

実施した操作、候補・未確定文字のスクリーンショット、期待/実結果、Windows/IME/WebView2/アプリ版を記録する。

| ID | 操作 | 期待結果 |
| --- | --- | --- |
| IME-01 | Microsoft IMEで「にほんご」をキー入力し、変換候補を選んで確定 | 1回だけ確定、文字欠落や二重入力なし |
| IME-02 | 確定文字を選択して再変換 | 再変換でき、選択とカーソルが維持される |
| IME-03 | composition中・確定後に選択、削除、Undo/Redo | 意図した内容へ復元でき、入力不能やクラッシュなし |
| IME-04 | Slash/Mention候補表示中に日本語を入力・確定 | composition用Enterや矢印を候補UIが誤消費しない |
| IME-05 | 必須ブロック、Drag & Drop、Toggle入れ子、Todoを操作 | 編集可能で、構造やchecked状態を失わない |

文字列の貼付け、Unicodeの直接挿入、合成CompositionEventだけではMicrosoft IMEの試験成功としない。

Step 3の初回記録ではlocal editorの結果だけを判断する。Section 5.3の「別clientからのYjs updateがcomposition中に届く」試験はStep 4の接続後に追記する。Gate Aの最終Passにはこの試験も必要。Fail時は`docs/failures/`へ最小再現と原因候補を残して止める。

## ネットワークを含む後工程

Step 4以降、VMからDocker側API/Hocuspocusに到達させる方法を、使用するVMのnetwork構成に合わせて設定する。現時点のComposeのhost公開は127.0.0.1のみで、別VMからの到達は保証しない。host adapterの固定アドレス、VM側のサービス配置、SSH tunnel等から実際の環境に合う方式を選び、無条件にLAN全体へ公開しない。

Step 5以降のSQLite耐久化・強制終了復旧もguestの実プロセスを終了して試験する。証拠はguestで保存してから選んだファイルをhostプロジェクトの`tests/evidence/`へコピーする。

現在: VM未接続、P0/IME未検証。Linux containerの試験や切替前のhost Cargo checkで代替しない。
