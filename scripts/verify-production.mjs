const publicUrl = process.argv[2] || 'https://d-league-dashboard.kanedatetuo234.workers.dev/';
const supabaseUrl = 'https://hdemiwbnjnmihmiwvgaq.supabase.co';
const publishableKey = 'sb_publishable_TpZnc6GzAtJwvXr2f4D3OQ_SBeY9hO8';

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

const page = await fetch(publicUrl, { cache: 'no-store' });
if (!page.ok) fail(`公開URL HTTP ${page.status}`);
const html = await page.text();
if (!html.includes('Powered by Supabase')) fail('Forge版の表示を確認できません。旧GAS版または別Workerの可能性があります。');
else console.log('OK: Forge版HTML');

const headers = { apikey: publishableKey, Accept: 'application/json' };
for (const table of ['members', 'matches', 'match_players', 'schedules', 'local_rules', 'match_photos']) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, { headers, cache: 'no-store' });
  if (!response.ok) fail(`${table} 読み取りHTTP ${response.status}`);
  else console.log(`OK: ${table} 読み取り`);
}

const functionResponse = await fetch(`${supabaseUrl}/functions/v1/match-write`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ players: [] }),
});
const functionBody = await functionResponse.json().catch(() => ({}));
if (functionResponse.status !== 400 || functionBody.ok !== false) fail(`Function検証応答が想定外です（HTTP ${functionResponse.status}）。`);
else console.log('OK: Function公開呼出し・入力検証');

if (process.exitCode) process.exit(1);
