(function (global) {
  'use strict';
  const CONFIG = {
    // Google Apps ScriptをウェブアプリとしてデプロイしたURLを設定します。
    GAS_URL: 'https://script.google.com/macros/s/AKfycbycroeNJuDlI-RFGmHkmlU7Hip3RhEgk_30NaBbe452MlFQLZ0roofkt3ml9LFMx1Ci/exec',
    URL: location.hostname.endsWith('.workers.dev') ? '/api' : 'https://script.google.com/macros/s/AKfycbycroeNJuDlI-RFGmHkmlU7Hip3RhEgk_30NaBbe452MlFQLZ0roofkt3ml9LFMx1Ci/exec',
    DATA_SOURCE: 'supabase',
    SUPABASE_URL: 'https://hdemiwbnjnmihmiwvgaq.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_TpZnc6GzAtJwvXr2f4D3OQ_SBeY9hO8',
    TIMEOUT_MS: 10000,
  };
  function normalizeMember(member) {
    return { player_id: String(member.player_id || '').trim(), display_name: String(member.display_name || member.player_name || member.player_id || '').trim(), active: member.active !== false, color: member.color || '', icon: member.icon || '' };
  }
  function normalizeResult(result) {
    return { game_id: String(result.game_id || '').trim(), date: result.date || '', game_type: result.game_type === 'tonpu' || result.game_type === '東風' ? 'tonpu' : 'hanchan', player_id: String(result.player_id || '').trim(), player_name: String(result.player_name || '').trim(), score: Number(result.score) || 0, rank: Number(result.rank) || 0, seat_order: Number(result.seat_order) || 0, yakitori: result.yakitori === true || String(result.yakitori).toLowerCase() === 'true', chips: Number(result.chips) || 0, point: Number(result.point) || 0, yakuman: result.yakuman === true || String(result.yakuman).toLowerCase() === 'true', comment: String(result.comment || '').trim(), breakdown: result.breakdown && typeof result.breakdown === 'object' ? result.breakdown : {}, photo_urls: Array.isArray(result.photo_urls) ? result.photo_urls : [], photo_file_ids: Array.isArray(result.photo_file_ids) ? result.photo_file_ids : [] };
  }
  async function fetchData(url = CONFIG.URL) {
    if (url === CONFIG.URL && (new URLSearchParams(location.search).get('source') || CONFIG.DATA_SOURCE) === 'supabase') return fetchSupabaseData();
    if (!url) throw new Error('API URL is not configured.');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
    try {
      const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error(`API request failed: ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.members) || !Array.isArray(payload.results)) throw new Error('API response format is invalid.');
      return { updatedAt: payload.updatedAt || '', warnings: Array.isArray(payload.warnings) ? payload.warnings : [], settings: payload.settings || null, members: payload.members.map(normalizeMember), results: payload.results.map(normalizeResult), schedule: Array.isArray(payload.schedule) ? payload.schedule : [] };
    } finally { clearTimeout(timer); }
  }
  async function supabaseRequest(path) {
    const response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY, Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
    return response.json();
  }
  async function fetchSupabaseData() {
    const [members, matches, matchPlayers, schedules, matchPhotos, localRules] = await Promise.all([
      supabaseRequest('members?select=player_id,display_name,active,color,icon&order=display_name'),
      supabaseRequest('matches?select=id,legacy_game_id,played_on,game_type,yakuman,comment&order=played_on.desc'),
      supabaseRequest('match_players?select=match_id,player_id,rank,score,seat,chips,yakitori,point,point_breakdown&order=rank'),
      supabaseRequest('schedules?select=schedule_date,player_id,status,comment&order=schedule_date.desc'),
      supabaseRequest('match_photos?select=id,match_id,storage_path,original_name&order=created_at'),
      supabaseRequest('local_rules?select=game_type,rules&order=game_type'),
    ]);
    const memberMap = new Map(members.map(member => [String(member.player_id), member]));
    const matchMap = new Map(matches.map(match => [String(match.id), match]));
    const photoMap = new Map();
    matchPhotos.forEach(photo => {
      const matchId = String(photo.match_id);
      const current = photoMap.get(matchId) || { urls: [], ids: [] };
      if (photo.storage_path) current.urls.push(`${CONFIG.SUPABASE_URL}/storage/v1/object/public/match-photos/${String(photo.storage_path).split('/').map(encodeURIComponent).join('/')}`);
      if (photo.id) current.ids.push(String(photo.id));
      photoMap.set(matchId, current);
    });
    const results = matchPlayers.map(row => {
      const match = matchMap.get(String(row.match_id));
      const member = memberMap.get(String(row.player_id));
      if (!match) return null;
      const photos = photoMap.get(String(match.id)) || { urls: [], ids: [] };
      return { game_id: String(match.legacy_game_id || match.id), date: match.played_on || '', game_type: match.game_type || 'hanchan', player_id: String(row.player_id || ''), player_name: member?.display_name || row.player_id || '', score: Number(row.score) || 0, rank: Number(row.rank) || 0, seat_order: row.seat || '', yakitori: row.yakitori === true, chips: Number(row.chips) || 0, point: Number(row.point) || 0, yakuman: match.yakuman === true, comment: String(match.comment || ''), breakdown: row.point_breakdown || {}, photo_urls: photos.urls, photo_file_ids: photos.ids };
    }).filter(Boolean);
    return { updatedAt: new Date().toISOString(), warnings: [], settings: Object.fromEntries(localRules.map(row => [row.game_type, row.rules || {}])), members: members.map(normalizeMember), results, schedule: schedules.map(row => ({ date: row.schedule_date || '', player_id: String(row.player_id || ''), status: row.status || '', comment: row.comment || '' })) };
  }
  async function loadData(fallback) {
    const source = new URLSearchParams(location.search).get('source') || CONFIG.DATA_SOURCE;
    if (source === 'supabase') return fetchSupabaseData();
    return CONFIG.URL ? fetchData() : fallback;
  }
  async function postResult(payload) {
    const source = new URLSearchParams(location.search).get('source') || CONFIG.DATA_SOURCE;
    if (source === 'supabase') {
      const response = await fetch(`${CONFIG.SUPABASE_URL}/functions/v1/match-write`, { method: 'POST', headers: { apikey: CONFIG.SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(`Supabase request failed: ${response.status}`);
      const result = await response.json();
      if (!result.ok) throw new Error(result.error || '保存できませんでした。');
      return result;
    }
    if (!CONFIG.URL) throw new Error('API URL is not configured.');
    const response = await fetch(CONFIG.URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`API request failed: ${response.status}`);
    const result = await response.json();
    if (!result.ok) throw new Error(result.error || '対局を登録できませんでした。');
    return result;
  }
  global.DLeagueApi = { CONFIG, fetchData, fetchSupabaseData, loadData, postResult };
}(window));
