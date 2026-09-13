import fs from 'node:fs/promises';
import path from 'node:path';

const args = new Set(process.argv.slice(2));
const inputIndex = process.argv.indexOf('--input');
const inputDir = inputIndex >= 0 ? (process.argv[inputIndex + 1] || 'scripts/import-data') : 'scripts/import-data';
const gasIndex = process.argv.indexOf('--from-gas');
const gasUrl = gasIndex >= 0 ? (process.argv[gasIndex + 1] || '') : '';
const execute = args.has('--execute');
const supabaseUrl = process.env.D_LEAGUE_SUPABASE_URL || '';
const serviceRoleKey = process.env.D_LEAGUE_SUPABASE_SERVICE_ROLE_KEY || '';

function parseCsv(text) {
  const rows = [];
  let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && text[i + 1] === '"' && quoted) { value += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(value); value = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value); value = '';
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      continue;
    }
    value += char;
  }
  if (value || row.length) { row.push(value); if (row.some(cell => cell !== '')) rows.push(row); }
  const headers = (rows.shift() || []).map(header => header.trim());
  return rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || '').trim()])));
}

const asBool = value => ['true', '1', 'yes', '可', '○'].includes(String(value).toLowerCase());
const asNumber = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const readCsv = async name => parseCsv(await fs.readFile(path.join(inputDir, name), 'utf8'));

function groupMatches(results) {
  const groups = new Map();
  for (const row of results) {
    const gameId = String(row.game_id || '').trim();
    if (!gameId) throw new Error('results.csvにgame_idがない行があります。');
    if (!groups.has(gameId)) groups.set(gameId, []);
    groups.get(gameId).push(row);
  }
  return groups;
}

async function supabase(pathname, options = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${pathname}`, {
    ...options,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${pathname}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function uploadPhoto(storagePath, sourceUrl, matchId, originalName) {
  const photo = await fetch(sourceUrl);
  if (!photo.ok) throw new Error(`写真取得失敗: ${photo.status} ${sourceUrl}`);
  const contentType = photo.headers.get('content-type') || 'image/jpeg';
  const upload = await fetch(`${supabaseUrl}/storage/v1/object/match-photos/${storagePath}`, {
    method: 'POST',
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: await photo.arrayBuffer(),
  });
  if (!upload.ok) throw new Error(`写真保存失敗: ${upload.status} ${await upload.text()}`);
  await supabase('match_photos?on_conflict=storage_path', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ match_id: matchId, storage_path: storagePath, original_name: originalName }]) });
}

let settings = {};
let members;
let results;
let schedules;
if (gasUrl) {
  const response = await fetch(gasUrl);
  if (!response.ok) throw new Error(`GAS API: ${response.status}`);
  const payload = await response.json();
  members = payload.members || [];
  results = payload.results || [];
  schedules = payload.schedule || [];
  settings = payload.settings || {};
} else {
  members = await readCsv('members.csv');
  results = await readCsv('results.csv');
  schedules = await readCsv('schedules.csv');
}
const groups = groupMatches(results);
const plan = { source: gasUrl ? 'GAS API' : 'CSV', members: members.length, matches: groups.size, matchPlayers: results.length, schedules: schedules.length, ruleSets: Object.keys(settings).length };
console.log(JSON.stringify({ mode: execute ? 'execute' : 'dry-run', inputDir, plan }, null, 2));
if (!execute) { console.log('ドライランです。書き込む場合は --execute を指定してください。'); process.exit(0); }
if (!supabaseUrl || !serviceRoleKey) throw new Error('D_LEAGUE_SUPABASE_URL と D_LEAGUE_SUPABASE_SERVICE_ROLE_KEY が必要です。');

await supabase('members?on_conflict=player_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(members.map(row => ({ player_id: row.player_id, display_name: row.display_name || row.player_name, active: row.active === '' ? true : asBool(row.active), color: row.color || null, icon: row.icon || null }))) });
for (const [gameType, rules] of Object.entries(settings)) {
  if (!['hanchan', 'tonpu'].includes(gameType)) continue;
  await supabase('local_rules?on_conflict=game_type', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ game_type: gameType, rules }]) });
}
for (const [legacyGameId, rows] of groups) {
  if (rows.length !== 4) throw new Error(`${legacyGameId}: 4人分ではなく${rows.length}行です。`);
  const first = rows[0];
  const [match] = await supabase('matches?on_conflict=legacy_game_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify([{ legacy_game_id: legacyGameId, played_on: first.date, game_type: first.game_type === 'tonpu' || first.game_type === '東風' ? 'tonpu' : 'hanchan', yakuman: asBool(first.yakuman), comment: first.comment || '' }]) });
  await supabase('match_players?on_conflict=match_id,player_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows.map(row => ({ match_id: match.id, player_id: row.player_id, rank: asNumber(row.rank), score: asNumber(row.score), seat: row.seat_order || row.seat, chips: asNumber(row.chips), yakitori: asBool(row.yakitori), point: asNumber(row.point), point_breakdown: row.point_breakdown ? JSON.parse(row.point_breakdown) : (row.breakdown ? JSON.parse(row.breakdown) : {}) }))) });
  const photos = [...new Set(rows.flatMap(row => Array.isArray(row.photo_urls) ? row.photo_urls : []))];
  for (const [index, sourceUrl] of photos.entries()) {
    await uploadPhoto(`${legacyGameId}/${index + 1}.jpg`, sourceUrl, match.id, `${legacyGameId}-${index + 1}.jpg`);
  }
}
for (const row of schedules) {
  await supabase('schedules?on_conflict=schedule_date,player_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ schedule_date: row.date || row.schedule_date, player_id: row.player_id, status: row.status || (asBool(row.available) ? '可' : ''), comment: row.comment || '' }]) });
}
console.log('移行が完了しました。件数を旧データと照合してください。');
