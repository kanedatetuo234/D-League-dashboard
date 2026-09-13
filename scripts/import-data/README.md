# Supabase移行用CSV

このフォルダに以下のUTF-8 CSVを置いてから、まずドライランを実行します。

- `members.csv`：`player_id,display_name,active,color,icon`
- `results.csv`：`game_id,date,game_type,player_id,player_name,score,rank,seat_order,yakitori,chips,point,point_breakdown,comment,yakuman`
- `schedules.csv`：`date,player_id,status,comment`

```powershell
node scripts/import-sheets-to-supabase.mjs --input scripts/import-data
```

件数を確認してから、Supabaseのサービスロールキーを環境変数へ設定し、`--execute` を付けて実行します。サービスロールキーはファイルやブラウザへ保存しません。

旧GAS APIから直接確認する場合は、読み取り専用のドライランを実行できます。

```powershell
node scripts/import-sheets-to-supabase.mjs --from-gas "https://script.google.com/macros/s/発行済みURL/exec"
```
