# Supabaseバックアップ・復元手順

## 方針

- 対局・予定・メンバー・ルール・監査ログはPostgresに保存する。
- 上がり牌写真はStorageバケット`match-photos`に保存する。
- 接続文字列、DBパスワード、`service_role`キーはリポジトリ・チャット・ブラウザへ記録しない。
- 復元作業中は公開URLからの登録を停止し、完了後に件数照合を行う。

## 1. データベースのバックアップ

Supabase DashboardのDatabase > Connectから一時的に取得した接続情報を、ローカルの環境変数へ設定して実行する。接続情報はコマンド履歴へ残さない。

```powershell
$env:DLEAGUE_DATABASE_URL = '<Dashboardの一時接続文字列>'
pg_dump --dbname=$env:DLEAGUE_DATABASE_URL --format=custom --file='D:\backup\d-league-forge-YYYYMMDD.dump'
Remove-Item Env:DLEAGUE_DATABASE_URL
```

バックアップ対象は少なくとも次の公開テーブルとする。

`members`, `matches`, `match_players`, `schedules`, `local_rules`, `match_photos`, `match_rule_snapshots`, `match_change_logs`

## 2. 写真のバックアップ

Supabase DashboardのStorage > `match-photos`からファイルを取得し、`match_photos.storage_path`を含む一覧と同じバックアップフォルダへ保存する。ファイル名とメタ情報を別々に扱わず、Storageパスをキーに照合する。

## 3. 復元

1. 公開URLからの書き込みを停止する。
2. 空の復元先または復元対象を確認する。
3. Postgresを復元する。

```powershell
$env:DLEAGUE_DATABASE_URL = '<Dashboardの一時接続文字列>'
pg_restore --dbname=$env:DLEAGUE_DATABASE_URL --clean --if-exists --no-owner 'D:\backup\d-league-forge-YYYYMMDD.dump'
Remove-Item Env:DLEAGUE_DATABASE_URL
```

4. `match-photos`へ写真を戻す。
5. `match_photos`の`storage_path`とStorage上のファイルが一致することを確認する。
6. 次の件数を照合する。

```sql
select 'members' as table_name, count(*) from public.members
union all select 'matches', count(*) from public.matches
union all select 'match_players', count(*) from public.match_players
union all select 'schedules', count(*) from public.schedules
union all select 'match_photos', count(*) from public.match_photos;
```

7. 画面表示、対局登録、写真表示を1件ずつ確認してから公開URLの書き込みを再開する。

## 4. 復元後の受入条件

- `matches`と`match_players`の外部キーが壊れていない。
- `match_rule_snapshots`が各対局に紐づいている。
- 監査ログが公開読み取りできない。
- 写真リンクが404にならない。
- 半荘・東風の設定が2種類とも存在する。
