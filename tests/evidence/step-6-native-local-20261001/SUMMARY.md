# Step 6 Windows候補: 起動観察と操作未検証

2026-10-01。Dockerでcross buildしたembedded debug実行物0.4.0をWindowsで通常権限で起動した。[起動記録](launch.json)。実行物SHA-256は`3B47854AD43EF4FFBCAC1A05126FB7EACB94AD8165A287168D0B4B26594AF57B`。ホストtoolchainは追加していない。

[accessibilityの読み取り観察](startup-observation.json)では、以前のPageタイトル・本文、正しいPageリンク、新しいTask/Relation欄と送信待ち0件を取得した。スクリーンショットでは描画の検証ができず、この観察から実際の編集操作をPassとはしない。

Computer Useのwindow activationが`GetCursorPos failed: アクセスが拒否されました。 (0x80070005)`で失敗した。windowを再選択して一度再試行したが同じ。新しいTask/Relationの実機登録・編集・再起動復元・実機IMEは**Not run**。アクセス拒否の原因は特定していない。今回の実機起動・read-only観察をDocker E2Eや過去のGoogle IME結果と混同しない。Microsoft IMEと最終Gateは未検証。
