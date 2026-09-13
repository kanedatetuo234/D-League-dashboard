# D-League Forge

麻雀リーグ「D-League」のSupabase移行・強化版です。

## 移行方針

- 公開URLは現行のCloudflare環境を維持する
- 現行のGoogleスプレッドシート・GASは移行完了まで停止しない
- SupabaseのPostgreSQLを対局・予定・設定データの正本にする
- Supabase Storageを上がり牌写真の保存先にする
- 登録・修正・ポイント計算はSupabase Edge Functionsへ移す

## 現在の状態

- `supabase/migrations/` に初期DBと監査テーブルのスキーマを追加済み
- Supabaseプロジェクト作成、基本テーブル作成、Storage作成まで完了
- 画面は現行版を複製した移行用ベース
- アプリのSupabase API切替、データ移行、本番切替は未完了
- 詳細な進捗は `docs/SUPABASE_MIGRATION_CHECKLIST.md` を参照

## ディレクトリ

```text
app/                 # 将来の画面配置先
css/ js/ assets/     # 現在の画面資産（移行中）
supabase/migrations/ # DBスキーマ
supabase/functions/  # 登録・修正・計算API（これから追加）
scripts/             # Sheetsからの移行処理（これから追加）
tests/               # 移行前後の比較テスト（これから追加）
```

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
