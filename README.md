# D-League 戦績表

麻雀リーグ「D-League」の戦績ダッシュボードです。Step 7まで実装済みで、設定済みのGoogle Apps Script APIから対局データを取得します。API未接続時はダミーデータへ切り替え可能です。

## ローカル確認

`index.html` をブラウザで開いてください。Step 1 ではビルドツールや npm は不要です。

## 今後の実装予定

- Step 2: 集計ロジックを `stats.js` に分離（実装済み）
- Step 3: Chart.js によるグラフ実装（実装済み）
- Step 4: 週間・月間・年間の期間切替（実装済み。前期間／次期間移動、0件表示対応）
- Step 5: メンバー対戦成績の集計（実装済み。同一 game_id・順位比較・同順位引き分け）
- Step 6: Google Apps Script API `gas/Code.gs`（実装済み。results／members読込、入力警告、point自動計算、JSON返却）
- Step 7: フロントAPI接続 `js/api.js`（実装済み。URL設定時にAPI読込、未設定時はダミーデータ、失敗時メッセージ）
- 対局登録・メンバー登録（実装済み。ダッシュボードからApps Script経由で登録）
- KPI変更: リーグ全体の総対局数、最新対局のトップ、前回対局のトップを表示
- Step 8以降: エラー処理・公開手順

## Apps Script API

`gas/Code.gs` をGoogle Apps Scriptプロジェクトへ貼り付け、対象スプレッドシートに紐付けます。`results` と `members` シートを要件書の列定義で作成し、ウェブアプリとしてデプロイしてください。発行されたURLは、次Stepで `js/api.js` の設定値として登録します。

API接続時は `js/api.js` の `CONFIG.URL` に発行URLを設定します。現在は発行済みURLを設定済みです。URLを空欄に戻すとダミーデータで起動します。
