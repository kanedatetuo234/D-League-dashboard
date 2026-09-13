# Supabase / Cloudflare デプロイ手順

## 現在の公開方針

- ダッシュボード閲覧：ログイン不要
- Supabaseの公開テーブル：`anon`は読み取り可能
- 対局・予定・メンバーの書き込み：公開Edge Function経由
- 写真：公開Storageバケット
- 厳密な利用者識別：行わない（社内娯楽用途）

## Edge Function

Forgeの `supabase/functions/match-write` は、対局登録・修正・削除、予定、メンバー、ルール設定を処理します。
`supabase/config.toml` でJWT検証を無効化しているため、利用者ログインなしで呼び出せます。入力検証、ポイント計算、ルールスナップショット、監査ログはFunction内で実行します。

Supabase CLIをログイン済みの端末で実行します。

```powershell
npx supabase login
npx supabase functions deploy match-write --project-ref hdemiwbnjnmihmiwvgaq
```

Functionが `SUPABASE_SERVICE_ROLE_KEY` を要求する場合は、Supabase DashboardのEdge Functions > Secretsへ登録します。値はソースコードやチャットへ貼り付けません。

## Cloudflare

現在のForgeフロントはブラウザからSupabaseの公開読み取りとEdge Functionを直接利用するため、Cloudflare WorkerにSupabase秘密鍵を置く必要はありません。Cloudflareは静的ファイル配信を担当します。

WorkerをSupabaseの中継サーバーとして使う構成へ変更する場合だけ、Cloudflare側で次を登録します。

```powershell
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
```

秘密鍵は `wrangler.toml`、JavaScript、ブラウザへ記載しません。
