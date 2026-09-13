# Cloudflare公開手順

公開先は既存の次のURLを維持する。

`https://d-league-dashboard.kanedatetuo234.workers.dev/`

## 事前確認

- Cloudflare Dashboardで対象Worker名が`d-league-dashboard`であることを確認する。
- Forgeの`wrangler.toml`の`name`は対象Worker名と一致させる。
- 現構成ではブラウザがSupabase公開APIとEdge Functionへ直接接続するため、Cloudflareへ`SUPABASE_SERVICE_ROLE_KEY`を登録しない。
- `service_role`キー、DBパスワードはCloudflare・ソース・ブラウザへ配置しない。
- `.assetsignore`でSQL・Edge Functionソース・移行資料・Workerソースを公開対象から除外する。

## デプロイ

ForgeフォルダでCloudflareへログインし、既存Workerへデプロイする。

```powershell
npx wrangler login
npx wrangler deploy --config wrangler.toml
```

## 確認

1. 公開URLを開く。
2. 画面下部が`Powered by Supabase`になっていることを確認する。
3. 総対局数・ランキング・予定・写真がSupabaseの件数と一致することを確認する。
4. 対局登録をテスト用または実運用の1件で実行し、Edge Functionの200応答と画面反映を確認する。
5. 失敗時は旧GASを停止せず、`?source=gas`で旧APIへ戻せる状態を維持する。

または、Forgeフォルダで次の検証スクリプトを実行する。

```powershell
node scripts/verify-production.mjs
```

## 切替後

- Cloudflare公開URLで読み書きが確認できるまで、旧GASの停止や旧データ削除を行わない。
- 切替日時をチェックリストへ記録する。
